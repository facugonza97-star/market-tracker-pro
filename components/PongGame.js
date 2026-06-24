"use client";
import { useEffect, useRef, useState, useCallback } from "react";

// --- Resolución lógica del canvas (se escala por CSS al 100% del contenedor) ---
const VW = 800;
const VH = 520;

// --- Medidas de juego ---
const PADDLE_W = 10;
const PADDLE_H = 70;
const BALL = 10;
const PLAYER_X = 24;                       // paleta izquierda (jugador)
const CPU_X = VW - 24 - PADDLE_W;          // paleta derecha (CPU)
const CPU_MAX = 4;                         // velocidad máxima CPU (px/frame) — vencible
const POINTS_PER_SET = 10;                 // puntos para ganar un set
const SETS_TO_WIN = 2;                     // sets para ganar el partido
const BASE_SPEED = 4.6;                    // velocidad base de la pelota
const MAX_MULT = 2;                        // acelera hasta 2x
const MULT_STEP = 0.08;                    // incremento por rebote en paleta
const COUNTDOWN_STEP = 650;                // ms por número del countdown

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function freshMatch() {
  return {
    ball: { x: VW / 2 - BALL / 2, y: VH / 2 - BALL / 2, vx: 0, vy: 0 },
    playerY: VH / 2 - PADDLE_H / 2,
    cpuY: VH / 2 - PADDLE_H / 2,
    pScore: 0,
    cScore: 0,
    pSets: 0,
    cSets: 0,
    mult: 1,
    phase: "countdown",       // countdown | playing | setover | matchover
    serveDir: Math.random() < 0.5 ? -1 : 1,
    countdownStart: 0,        // se fija en el primer frame del countdown
    setOverStart: 0,
    setWinner: null,
    matchWinner: null,
  };
}

export default function PongGame() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(freshMatch());
  const mouseRef = useRef({ y: VH / 2 });

  // Espejo en React de la fase, solo para mostrar overlays HTML (set / final).
  const [uiPhase, setUiPhase] = useState("countdown");
  const [, force] = useState(0); // fuerza re-render de los overlays al cambiar marcador

  const syncPhase = useCallback((p) => {
    setUiPhase((prev) => (prev === p ? prev : p));
    force((n) => n + 1);
  }, []);

  // Arranca un saque con countdown (centro + dirección dada).
  const startCountdown = useCallback((s, dir, now) => {
    s.ball.x = VW / 2 - BALL / 2;
    s.ball.y = VH / 2 - BALL / 2;
    s.ball.vx = 0;
    s.ball.vy = 0;
    s.mult = 1;
    s.serveDir = dir;
    s.phase = "countdown";
    s.countdownStart = now || 0;
    syncPhase("countdown");
  }, [syncPhase]);

  // Rebote en paleta: acelera (cap 2x) y desvía según el punto de impacto.
  const bounce = useCallback((s, who) => {
    s.mult = Math.min(MAX_MULT, s.mult + MULT_STEP);
    const speed = BASE_SPEED * s.mult;
    const paddleY = who === "player" ? s.playerY : s.cpuY;
    const rel = ((s.ball.y + BALL / 2) - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
    const angle = clamp(rel, -1, 1) * (Math.PI * 0.32); // hasta ~58°
    const dir = who === "player" ? 1 : -1;
    s.ball.vx = dir * speed * Math.cos(angle);
    s.ball.vy = speed * Math.sin(angle);
  }, []);

  // Se anotó un punto: actualiza marcador, resuelve set/partido o vuelve a sacar.
  const point = useCallback((s, who, now) => {
    if (who === "player") s.pScore++;
    else s.cScore++;
    force((n) => n + 1);

    if (s.pScore >= POINTS_PER_SET || s.cScore >= POINTS_PER_SET) {
      const setWinner = s.pScore > s.cScore ? "player" : "cpu";
      s.setWinner = setWinner;
      if (setWinner === "player") s.pSets++;
      else s.cSets++;

      if (s.pSets >= SETS_TO_WIN || s.cSets >= SETS_TO_WIN) {
        s.matchWinner = s.pSets > s.cSets ? "player" : "cpu";
        s.phase = "matchover";
        syncPhase("matchover");
      } else {
        s.phase = "setover";
        s.setOverStart = now;
        syncPhase("setover");
      }
    } else {
      // Saca hacia quien recibió el punto en contra.
      startCountdown(s, who === "player" ? 1 : -1, now);
    }
  }, [startCountdown, syncPhase]);

  // --- Loop principal ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function frame(now) {
      const s = stateRef.current;

      // La paleta del jugador siempre sigue el mouse (salvo partido terminado).
      if (s.phase !== "matchover") {
        s.playerY = clamp(mouseRef.current.y - PADDLE_H / 2, 0, VH - PADDLE_H);
      }

      if (s.phase === "countdown") {
        if (!s.countdownStart) s.countdownStart = now;
        if (now - s.countdownStart >= COUNTDOWN_STEP * 4) {
          const a = (Math.random() * 0.5 - 0.25) * Math.PI; // -45°..45°
          s.ball.vx = s.serveDir * BASE_SPEED * Math.cos(a);
          s.ball.vy = BASE_SPEED * Math.sin(a);
          s.mult = 1;
          s.phase = "playing";
          syncPhase("playing");
        }
      } else if (s.phase === "playing") {
        const b = s.ball;
        b.x += b.vx;
        b.y += b.vy;

        // Paredes arriba/abajo
        if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        if (b.y + BALL >= VH) { b.y = VH - BALL; b.vy = -Math.abs(b.vy); }

        // Paleta jugador (izquierda)
        if (b.vx < 0 &&
            b.x <= PLAYER_X + PADDLE_W && b.x + BALL >= PLAYER_X &&
            b.y + BALL >= s.playerY && b.y <= s.playerY + PADDLE_H) {
          bounce(s, "player");
          b.x = PLAYER_X + PADDLE_W;
        }
        // Paleta CPU (derecha)
        if (b.vx > 0 &&
            b.x + BALL >= CPU_X && b.x <= CPU_X + PADDLE_W &&
            b.y + BALL >= s.cpuY && b.y <= s.cpuY + PADDLE_H) {
          bounce(s, "cpu");
          b.x = CPU_X - BALL;
        }

        // IA de la CPU: persigue la pelota con tope de velocidad
        const target = b.y + BALL / 2 - PADDLE_H / 2;
        s.cpuY = clamp(s.cpuY + clamp(target - s.cpuY, -CPU_MAX, CPU_MAX), 0, VH - PADDLE_H);

        // Puntos
        if (b.x + BALL < 0) point(s, "cpu", now);
        else if (b.x > VW) point(s, "player", now);
      } else if (s.phase === "setover") {
        if (now - s.setOverStart >= 2000) {
          s.pScore = 0;
          s.cScore = 0;
          force((n) => n + 1);
          // El perdedor del set saca.
          startCountdown(s, s.setWinner === "player" ? 1 : -1, now);
        }
      }
      // matchover: queda en pausa hasta "Jugar de nuevo"

      draw(ctx, s, now);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [bounce, point, startCountdown, syncPhase]);

  // --- Dibujo ---
  function draw(ctx, s, now) {
    // Fondo arcade
    ctx.fillStyle = "#090912";
    ctx.fillRect(0, 0, VW, VH);

    // Línea punteada central
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.moveTo(VW / 2, 0);
    ctx.lineTo(VW / 2, VH);
    ctx.stroke();
    ctx.restore();

    // Título
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "700 18px 'Courier New',monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let title = "MARKET PONG";
    ctx.fillText(title.split("").join(" "), VW / 2, 34);
    ctx.restore();

    // Marcador (monospace grande)
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 64px 'Courier New',monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText(String(s.pScore), VW / 2 - 50, 54);
    ctx.textAlign = "left";
    ctx.fillText(String(s.cScore), VW / 2 + 50, 54);
    // Sets ganados
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "700 13px 'Courier New',monospace";
    ctx.textAlign = "center";
    ctx.fillText(`SETS  ${s.pSets} - ${s.cSets}`, VW / 2, 126);
    ctx.restore();

    // Paletas
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(PLAYER_X, s.playerY, PADDLE_W, PADDLE_H);
    ctx.fillRect(CPU_X, s.cpuY, PADDLE_W, PADDLE_H);
    // Pelota cuadrada
    if (s.phase === "playing" || s.phase === "countdown") {
      ctx.fillRect(s.ball.x, s.ball.y, BALL, BALL);
    }
    ctx.restore();

    // Countdown
    if (s.phase === "countdown") {
      const start = s.countdownStart || now;
      const step = Math.floor((now - start) / COUNTDOWN_STEP);
      const label = step <= 0 ? "3" : step === 1 ? "2" : step === 2 ? "1" : "GO!";
      ctx.save();
      ctx.fillStyle = label === "GO!" ? "#16c784" : "rgba(255,255,255,0.9)";
      ctx.font = "700 90px 'Courier New',monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, VW / 2, VH / 2 + 30);
      ctx.restore();
    }
  }

  // --- Handlers ---
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.y = (e.clientY - rect.top) * (VH / rect.height);
  }, []);

  const handlePlayAgain = useCallback(() => {
    stateRef.current = freshMatch();
    mouseRef.current.y = VH / 2;
    syncPhase("countdown");
  }, [syncPhase]);

  const s = stateRef.current;

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Market Pong</span>
        <span className="text-xs text-text-sec">
          Mové el mouse para controlar la paleta izquierda · 10 puntos por set · 2 sets gana
        </span>
      </div>

      <div
        className="relative rounded-xl overflow-hidden"
        style={{ background: "#090912" }}
      >
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          onMouseMove={handleMouseMove}
          style={{ width: "100%", aspectRatio: `${VW} / ${VH}`, display: "block", cursor: "none" }}
        />

        {/* Overlay fin de set */}
        {uiPhase === "setover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55">
            <span className="font-mono text-2xl font-bold text-white">
              {s.setWinner === "player" ? "¡Ganaste el set!" : "Set para la CPU"}
            </span>
            <span className="font-mono text-sm text-text-sec mt-2">
              Sets {s.pSets} - {s.cSets} · sigue el próximo…
            </span>
          </div>
        )}

        {/* Overlay fin de partido */}
        {uiPhase === "matchover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65">
            <span className="font-mono text-3xl font-bold mb-1"
              style={{ color: s.matchWinner === "player" ? "#16c784" : "#ea3943" }}>
              {s.matchWinner === "player" ? "¡GANASTE!" : "GANÓ LA CPU"}
            </span>
            <span className="font-mono text-sm text-text-sec mb-5">
              Partido {s.pSets} - {s.cSets}
            </span>
            <button
              onClick={handlePlayAgain}
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
