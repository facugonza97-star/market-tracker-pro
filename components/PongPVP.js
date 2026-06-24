"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import PusherJS from "pusher-js";
import { useUser } from "@clerk/nextjs";

// ---------------------------------------------------------------------------
// Pong PvP sobre Pusher Channels.
//
// Arquitectura (según especificación):
//  - Un único canal "pong-lobby" para todo (lobby + juego).
//  - Matchmaking por broadcast: al entrar cada quien anuncia "player-joined".
//    El de menor id es el HOST (player1, paleta izquierda) y emite "game-start".
//  - HOST (player1) corre la física de la pelota y emite "ball-update".
//  - Cada jugador emite "paddle-update" con su posición; el rival la aplica.
//  - HOST detecta puntos -> "score-update"; al ganar -> "game-over".
//
// Coordenadas NORMALIZADAS (0..1) en todos los mensajes, para que funcione
// entre pantallas de distinto tamaño. La pelota usa dead-reckoning en el
// cliente no-host (avanza con la velocidad recibida) para verse fluida sin
// mandar un mensaje por frame.
// ---------------------------------------------------------------------------

const CHANNEL = "pong-lobby";
const REF_H = 420;
const POINTS_TO_WIN = 6;       // primero en llegar gana el partido
const MAX_MULT = 2.5;
const MULT_STEP = 0.08;
const BALL_SEND_MS = 50;       // ~20 Hz (NO por frame: cuidaría la cuota de Pusher)
const PADDLE_SEND_MS = 50;     // ~20 Hz
const SERVE_PAUSE_MS = 1200;   // pausa en el centro tras cada punto
const COUNTDOWN_MS = 2400;     // 3·2·1 al arrancar

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const newId = () => Math.random().toString(36).slice(2, 10);

export default function PongPVP() {
  const { user } = useUser();

  // --- UI state ---
  const [phase, setPhase] = useState("lobby"); // lobby | waiting | playing | gameover
  const [nick, setNick] = useState("");
  const [nicks, setNicks] = useState({ player1: "", player2: "" });
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState("");

  // --- Refs de lógica (no provocan re-render) ---
  const meId = useRef(newId());
  const nickRef = useRef("");
  const nicksRef = useRef({ player1: "", player2: "" });
  const phaseRef = useRef("lobby");
  const roleRef = useRef(null);        // "player1" | "player2"
  const gameIdRef = useRef(null);
  const peerRef = useRef(null);
  const startAtRef = useRef(0);

  // Geometría / canvas
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: REF_H, dpr: 1 });
  const pointerRef = useRef({ y: REF_H / 2 });

  // Estado de juego (normalizado 0..1)
  const ballRef = useRef({ x: 0.5, y: 0.5, vx: 0, vy: 0 }); // pos centro + vel/frame
  const ownPaddleRef = useRef(0.5);   // 0..1 dentro del rango jugable
  const oppPaddleRef = useRef(0.5);
  const multRef = useRef(1);
  const scoreRef = useRef({ p1: 0, p2: 0 });
  const serveAtRef = useRef(0);        // host: timestamp para soltar la pelota
  const trailRef = useRef([]);

  // Throttles + Pusher
  const lastBallSent = useRef(0);
  const lastPaddleSent = useRef(0);
  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  const syncPhase = useCallback((p) => { phaseRef.current = p; setPhase(p); }, []);

  const post = useCallback((event, data) => {
    fetch("/api/pong", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: CHANNEL, event, data }),
    }).catch(() => {});
  }, []);

  const geom = useCallback(() => {
    const { w, h } = dimsRef.current;
    const scale = h / REF_H;
    const pw = 10 * scale, ph = 70 * scale, ball = 10 * scale, edge = 24 * scale;
    return {
      w, h, scale, pw, ph, ball, edge,
      playerX: edge,
      cpuX: w - edge - pw,
      baseSpeed: 4.5 * scale, // ~65% del saque anterior (6.9); acelera igual con cada rebote
    };
  }, []);

  // Host: posición central + cuenta regresiva de saque
  const hostServe = useCallback((dir) => {
    ballRef.current = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    multRef.current = 1;
    serveAtRef.current = performance.now() + SERVE_PAUSE_MS;
    ballRef.current._dir = dir;
    trailRef.current = [];
  }, []);

  // ----------------------------- Pusher -----------------------------
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      setError("Falta configurar NEXT_PUBLIC_PUSHER_KEY / _CLUSTER en el entorno.");
      return;
    }
    const pusher = new PusherJS(key, { cluster });
    const ch = pusher.subscribe(CHANNEL);
    pusherRef.current = pusher;
    channelRef.current = ch;

    const seen = new Set();

    const announce = () => post("player-joined", { id: meId.current, nick: nickRef.current });

    ch.bind("player-joined", (d) => {
      if (!d || d.id === meId.current) return;
      if (phaseRef.current !== "waiting" || peerRef.current) return;
      if (seen.has(d.id)) return;
      seen.add(d.id);
      // Respondemos para que el rival nos descubra (por si entró antes que nosotros).
      announce();
      peerRef.current = d.id;
      // El de menor id es host y emite game-start (uno solo).
      const host = meId.current < d.id;
      if (host) {
        const startAt = Date.now() + COUNTDOWN_MS;
        post("game-start", {
          gameId: [meId.current, d.id].sort().join("-"),
          p1: { id: meId.current, nick: nickRef.current },
          p2: { id: d.id, nick: d.nick || "Rival" },
          startAt,
        });
      }
    });

    ch.bind("game-start", (d) => {
      if (!d) return;
      const mine = d.p1.id === meId.current || d.p2.id === meId.current;
      if (!mine || phaseRef.current === "playing") return;
      peerRef.current = d.p1.id === meId.current ? d.p2.id : d.p1.id;
      gameIdRef.current = d.gameId;
      roleRef.current = d.p1.id === meId.current ? "player1" : "player2";
      startAtRef.current = d.startAt;
      scoreRef.current = { p1: 0, p2: 0 };
      setScore({ p1: 0, p2: 0 });
      setNicks({ player1: d.p1.nick, player2: d.p2.nick });
      ballRef.current = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
      ownPaddleRef.current = 0.5;
      oppPaddleRef.current = 0.5;
      multRef.current = 1;
      if (roleRef.current === "player1") {
        // host: programa el primer saque al terminar la cuenta
        serveAtRef.current = d.startAt - Date.now() + performance.now();
        ballRef.current._dir = Math.random() < 0.5 ? -1 : 1;
      }
      syncPhase("playing");
    });

    ch.bind("ball-update", (d) => {
      if (!d || d.gameId !== gameIdRef.current) return;
      if (roleRef.current === "player1") return; // el host es la fuente de verdad
      ballRef.current = { x: d.x, y: d.y, vx: d.vx, vy: d.vy };
    });

    ch.bind("paddle-update", (d) => {
      if (!d || d.gameId !== gameIdRef.current) return;
      if (d.role === roleRef.current) return; // ignorar el propio
      oppPaddleRef.current = d.y;
    });

    ch.bind("score-update", (d) => {
      if (!d || d.gameId !== gameIdRef.current) return;
      scoreRef.current = { p1: d.p1, p2: d.p2 };
      setScore({ p1: d.p1, p2: d.p2 });
    });

    ch.bind("game-over", (d) => {
      if (!d || d.gameId !== gameIdRef.current) return;
      setWinner(d.winner);
      syncPhase("gameover");
    });

    return () => {
      ch.unbind_all();
      pusher.unsubscribe(CHANNEL);
      pusher.disconnect();
    };
  }, [post, syncPhase]);

  // nick siempre fresco para los handlers de Pusher
  useEffect(() => { nickRef.current = nick; }, [nick]);

  // Prefill con el nombre de Clerk si está logueado
  useEffect(() => {
    if (user && !nick) {
      setNick(user.firstName || user.username || (user.fullName ?? "").split(" ")[0] || "");
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----------------------------- Resize -----------------------------
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const applyResize = () => {
      const w = Math.max(320, wrap.clientWidth);
      const h = window.innerWidth < 768 ? 280 : 420;
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + "px";
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applyResize();
    const ro = new ResizeObserver(applyResize);
    ro.observe(wrap);
    window.addEventListener("resize", applyResize);
    return () => { ro.disconnect(); window.removeEventListener("resize", applyResize); };
  }, []);

  // ----------------------------- Loop -----------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function frame(now) {
      const g = geom();
      const playing = phaseRef.current === "playing";

      // Paleta propia desde el puntero (normalizada al rango jugable)
      if (playing) {
        const norm = clamp((pointerRef.current.y - g.ph / 2) / (g.h - g.ph), 0, 1);
        ownPaddleRef.current = norm;
        if (now - lastPaddleSent.current > PADDLE_SEND_MS) {
          lastPaddleSent.current = now;
          post("paddle-update", { gameId: gameIdRef.current, role: roleRef.current, y: norm });
        }
      }

      // Física (solo host)
      if (playing && roleRef.current === "player1") {
        const b = ballRef.current;
        if (now >= serveAtRef.current && b.vx === 0 && b.vy === 0) {
          // soltar pelota
          const a = (Math.random() * 0.5 - 0.25) * Math.PI;
          const sp = g.baseSpeed;
          b.vx = (b._dir || 1) * (sp * Math.cos(a)) / g.w;
          b.vy = (sp * Math.sin(a)) / g.h;
          trailRef.current = [];
        }
        if (b.vx !== 0 || b.vy !== 0) {
          b.x += b.vx;
          b.y += b.vy;
          // paredes
          if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); }
          if (b.y + g.ball / g.h >= 1) { b.y = 1 - g.ball / g.h; b.vy = -Math.abs(b.vy); }

          // px para colisiones
          const bx = b.x * g.w, by = b.y * g.h;
          const leftY = ownPaddleRef.current * (g.h - g.ph);   // host = player1 (izq)
          const rightY = oppPaddleRef.current * (g.h - g.ph);  // rival = player2 (der)

          if (b.vx < 0 && bx <= g.playerX + g.pw && bx + g.ball >= g.playerX &&
              by + g.ball >= leftY && by <= leftY + g.ph) {
            bounceHost(b, leftY, g, +1);
          }
          if (b.vx > 0 && bx + g.ball >= g.cpuX && bx <= g.cpuX + g.pw &&
              by + g.ball >= rightY && by <= rightY + g.ph) {
            bounceHost(b, rightY, g, -1);
          }

          // puntos
          if (b.x + g.ball / g.w < 0) hostPoint("p2");
          else if (b.x > 1) hostPoint("p1");
        }

        // estela
        trailRef.current.push({ x: b.x, y: b.y });
        if (trailRef.current.length > 5) trailRef.current.shift();

        // broadcast pelota (throttle)
        if (now - lastBallSent.current > BALL_SEND_MS) {
          lastBallSent.current = now;
          post("ball-update", { gameId: gameIdRef.current, x: b.x, y: b.y, vx: b.vx, vy: b.vy });
        }
      } else if (playing) {
        // no-host: dead-reckoning de la pelota
        const b = ballRef.current;
        b.x += b.vx;
        b.y += b.vy;
        trailRef.current.push({ x: b.x, y: b.y });
        if (trailRef.current.length > 5) trailRef.current.shift();
      }

      draw(ctx, g, now);
      rafRef.current = requestAnimationFrame(frame);
    }

    function bounceHost(b, paddleY, g, dir) {
      multRef.current = Math.min(MAX_MULT, multRef.current + MULT_STEP);
      const speed = g.baseSpeed * multRef.current;
      const by = b.y * g.h;
      const rel = clamp(((by + g.ball / 2) - (paddleY + g.ph / 2)) / (g.ph / 2), -1, 1);
      const angle = rel * (Math.PI * 0.36);
      b.vx = dir * (speed * Math.cos(angle)) / g.w;
      b.vy = (speed * Math.sin(angle)) / g.h;
      // empujar fuera de la paleta
      b.x = dir > 0 ? (g.playerX + g.pw) / g.w : (g.cpuX - g.ball) / g.w;
    }

    function hostPoint(who) {
      const s = scoreRef.current;
      const next = { ...s, [who]: s[who] + 1 };
      scoreRef.current = next;
      setScore(next);
      post("score-update", { gameId: gameIdRef.current, p1: next.p1, p2: next.p2 });
      if (next.p1 >= POINTS_TO_WIN || next.p2 >= POINTS_TO_WIN) {
        const w = next.p1 > next.p2 ? "player1" : "player2";
        post("game-over", { gameId: gameIdRef.current, winner: w });
        setWinner(w);
        syncPhase("gameover");
      } else {
        hostServe(who === "p1" ? -1 : 1); // saca quien recibió el punto
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [geom, post, syncPhase, hostServe]);

  // ----------------------------- Dibujo -----------------------------
  function draw(ctx, g, now) {
    const { w, h, scale, ball, pw, ph } = g;
    ctx.fillStyle = "#090912";
    ctx.fillRect(0, 0, w, h);

    // línea central
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 4 * scale;
    ctx.setLineDash([14 * scale, 18 * scale]);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.restore();

    // título + marcador
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `700 ${16 * scale}px 'Courier New',monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MARKET PONG · PvP".split("").join(" "), w / 2, 26 * scale);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `700 ${52 * scale}px 'Courier New',monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText(String(scoreRef.current.p1), w / 2 - 40 * scale, 40 * scale);
    ctx.textAlign = "left";
    ctx.fillText(String(scoreRef.current.p2), w / 2 + 40 * scale, 40 * scale);
    ctx.restore();

    if (phaseRef.current !== "playing" && phaseRef.current !== "gameover") {
      return; // lobby/waiting: el overlay HTML va por encima
    }

    // posiciones de paleta (normalizadas -> px)
    const isP1 = roleRef.current === "player1";
    const leftNorm = isP1 ? ownPaddleRef.current : oppPaddleRef.current;
    const rightNorm = isP1 ? oppPaddleRef.current : ownPaddleRef.current;
    const leftY = leftNorm * (h - ph);
    const rightY = rightNorm * (h - ph);

    // estela
    for (let i = 0; i < trailRef.current.length; i++) {
      const tp = trailRef.current[i];
      ctx.save();
      ctx.globalAlpha = ((i + 1) / trailRef.current.length) * 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(tp.x * w, tp.y * h, ball, ball);
      ctx.restore();
    }

    // paletas + pelota con glow
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(g.playerX, leftY, pw, ph);
    ctx.fillRect(g.cpuX, rightY, pw, ph);
    if (phaseRef.current === "playing") {
      ctx.fillRect(ballRef.current.x * w, ballRef.current.y * h, ball, ball);
    }
    ctx.restore();

    // nicks arriba de cada paleta + "TÚ" debajo de la propia
    ctx.save();
    ctx.font = `700 ${12 * scale}px 'Courier New',monospace`;
    ctx.textBaseline = "alphabetic";
    // izquierda (player1)
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(nicksRef.current.player1 || "P1", g.playerX, Math.max(12 * scale, leftY - 8 * scale));
    // derecha (player2)
    ctx.textAlign = "right";
    ctx.fillText(nicksRef.current.player2 || "P2", g.cpuX + pw, Math.max(12 * scale, rightY - 8 * scale));
    // "TÚ"
    ctx.fillStyle = "#16c784";
    ctx.font = `700 ${11 * scale}px 'Courier New',monospace`;
    if (isP1) {
      ctx.textAlign = "left";
      ctx.fillText("TÚ", g.playerX, Math.min(h - 4 * scale, leftY + ph + 16 * scale));
    } else {
      ctx.textAlign = "right";
      ctx.fillText("TÚ", g.cpuX + pw, Math.min(h - 4 * scale, rightY + ph + 16 * scale));
    }
    ctx.restore();

    // cuenta regresiva al inicio
    if (phaseRef.current === "playing") {
      const remain = startAtRef.current - Date.now();
      if (remain > 0) {
        const n = Math.ceil(remain / 800);
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = `700 ${84 * scale}px 'Courier New',monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(Math.min(3, n)), w / 2, h / 2 + 20 * scale);
        ctx.restore();
      }
    }
  }

  // nicks fresco para el dibujo
  useEffect(() => { nicksRef.current = nicks; }, [nicks]);

  // ----------------------------- Handlers -----------------------------
  const movePointer = useCallback((clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.y = (clientY - rect.top) * (dimsRef.current.h / rect.height);
  }, []);

  const join = useCallback(() => {
    const n = (nick || "").trim();
    if (!n) { setError("Ingresá un nick."); return; }
    setError("");
    peerRef.current = null;
    roleRef.current = null;
    gameIdRef.current = null;
    syncPhase("waiting");
    post("player-joined", { id: meId.current, nick: n });
  }, [nick, post, syncPhase]);

  const playAgain = useCallback(() => {
    setWinner(null);
    setScore({ p1: 0, p2: 0 });
    scoreRef.current = { p1: 0, p2: 0 };
    peerRef.current = null;
    roleRef.current = null;
    gameIdRef.current = null;
    syncPhase("lobby");
  }, [syncPhase]);

  const showCanvas = phase === "playing" || phase === "gameover";

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Market Pong · PvP</span>
        <span className="text-xs text-text-sec">Multijugador en tiempo real · primero a {POINTS_TO_WIN}</span>
      </div>

      <div ref={wrapRef} className="relative rounded-xl overflow-hidden" style={{ background: "#090912", minHeight: 280 }}>
        <canvas
          ref={canvasRef}
          onMouseMove={(e) => movePointer(e.clientY)}
          onTouchMove={(e) => e.touches[0] && movePointer(e.touches[0].clientY)}
          style={{ width: "100%", display: "block", cursor: "none", touchAction: "none", opacity: showCanvas ? 1 : 0.25 }}
        />

        {/* Lobby */}
        {phase === "lobby" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
            <span className="font-mono text-lg font-bold text-white">Pong Multijugador</span>
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="Tu nick"
              maxLength={16}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-white outline-none text-center w-56"
            />
            <button
              onClick={join}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#16c784]/20 border border-[#16c784]/50 text-[#16c784] hover:bg-[#16c784]/30 transition"
            >
              Buscar partida
            </button>
            {error && <span className="text-xs text-[#ea3943]">{error}</span>}
          </div>
        )}

        {/* Esperando */}
        {phase === "waiting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="font-mono text-lg font-bold text-white animate-pulse">Esperando rival…</span>
            <span className="font-mono text-xs text-text-sec">Compartí la app y entren los dos a PvP</span>
            <button onClick={playAgain} className="mt-2 text-xs text-text-sec hover:text-white underline">Cancelar</button>
          </div>
        )}

        {/* Fin de partido */}
        {phase === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55">
            <span
              className="font-mono text-2xl font-bold"
              style={{ color: winner === roleRef.current ? "#16c784" : "#ea3943" }}
            >
              {winner === roleRef.current ? "¡GANASTE!" : "PERDISTE"}
            </span>
            <span className="font-mono text-sm text-text-sec">
              {nicks.player1} {score.p1} - {score.p2} {nicks.player2}
            </span>
            <button
              onClick={playAgain}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#16c784]/20 border border-[#16c784]/50 text-[#16c784] hover:bg-[#16c784]/30 transition"
            >
              Jugar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
