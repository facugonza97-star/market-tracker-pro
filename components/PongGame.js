"use client";
import { useEffect, useRef, useCallback } from "react";

// --- Reglas (valores de referencia a 420px de alto; se escalan por dimensión) ---
const REF_H = 420;          // alto de referencia (desktop)
const POINTS_PER_SET = 6;   // puntos para ganar un set
const SETS_TO_WIN = 2;      // sets para ganar el partido
const MAX_MULT = 2.5;       // la pelota acelera hasta 2.5x
const MULT_STEP = 0.08;     // +8% por rebote en paleta (factor 1.08)
const COUNTDOWN_STEP = 650; // ms por número del countdown (3 · 2 · 1)
const SETOVER_MS = 1500;    // overlay fin de set
const MATCHOVER_MS = 3000;  // overlay fin de partido
const FLASH_MS = 300;       // flash blanco al marcar
const TRAIL_LEN = 5;        // frames de estela

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function freshMatch() {
  return {
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    playerY: 0,
    cpuY: 0,
    pScore: 0,
    cScore: 0,
    pSets: 0,
    cSets: 0,
    mult: 1,
    phase: "countdown",      // countdown | playing | setover | matchover
    serveDir: Math.random() < 0.5 ? -1 : 1,
    countdownStart: 0,
    setOverStart: 0,
    matchOverStart: 0,
    flashStart: 0,
    setNumber: 0,            // nº de set recién terminado
    setWinner: null,
    matchWinner: null,
    trail: [],
    placed: false,          // ¿ya centramos paletas/pelota con dims reales?
  };
}

export default function PongGame() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(freshMatch());
  const pointerRef = useRef({ y: REF_H / 2 });
  // Dimensiones lógicas actuales del canvas (ancho real del contenedor, alto fijo).
  const dimsRef = useRef({ w: 800, h: REF_H, dpr: 1 });

  // Geometría derivada de las dimensiones actuales (todo escala con el alto).
  const geom = useCallback(() => {
    const { w, h } = dimsRef.current;
    const scale = h / REF_H;
    const pw = 10 * scale;
    const ph = 70 * scale;
    const ball = 10 * scale;
    const edge = 24 * scale;
    return {
      w, h, scale, pw, ph, ball, edge,
      playerX: edge,
      cpuX: w - edge - pw,
      cpuMax: 6.5 * scale,
      baseSpeed: 6.9 * scale, // 4.6 × 1.5
    };
  }, []);

  const centerServe = useCallback((s, dir, now) => {
    const g = geom();
    s.ball.x = g.w / 2 - g.ball / 2;
    s.ball.y = g.h / 2 - g.ball / 2;
    s.ball.vx = 0;
    s.ball.vy = 0;
    s.mult = 1;
    s.trail = [];
    s.serveDir = dir;
    s.phase = "countdown";
    s.countdownStart = now || 0;
  }, [geom]);

  // Rebote en paleta: acelera (cap 2x) y desvía según el punto de impacto
  // (extremos = diagonal fuerte, centro = casi recto).
  const bounce = useCallback((s, who) => {
    const g = geom();
    s.mult = Math.min(MAX_MULT, s.mult + MULT_STEP);
    const speed = g.baseSpeed * s.mult;
    const paddleY = who === "player" ? s.playerY : s.cpuY;
    const rel = clamp(((s.ball.y + g.ball / 2) - (paddleY + g.ph / 2)) / (g.ph / 2), -1, 1);
    const angle = rel * (Math.PI * 0.36); // hasta ~65° en los extremos
    const dir = who === "player" ? 1 : -1;
    s.ball.vx = dir * speed * Math.cos(angle);
    s.ball.vy = speed * Math.sin(angle);
  }, [geom]);

  const point = useCallback((s, who, now) => {
    if (who === "player") s.pScore++;
    else s.cScore++;
    s.flashStart = now;

    if (s.pScore >= POINTS_PER_SET || s.cScore >= POINTS_PER_SET) {
      const setWinner = s.pScore > s.cScore ? "player" : "cpu";
      s.setWinner = setWinner;
      if (setWinner === "player") s.pSets++;
      else s.cSets++;
      s.setNumber = s.pSets + s.cSets;

      if (s.pSets >= SETS_TO_WIN || s.cSets >= SETS_TO_WIN) {
        s.matchWinner = s.pSets > s.cSets ? "player" : "cpu";
        s.phase = "matchover";
        s.matchOverStart = now;
      } else {
        s.phase = "setover";
        s.setOverStart = now;
      }
    } else {
      // Saca hacia quien recibió el punto en contra.
      centerServe(s, who === "player" ? 1 : -1, now);
    }
  }, [centerServe]);

  // --- Resize: recalcula ancho real y reescala posiciones proporcionalmente ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const applyResize = () => {
      const w = Math.max(320, wrap.clientWidth);
      const h = window.innerWidth < 768 ? 280 : 420; // mobile / desktop
      const dpr = window.devicePixelRatio || 1;
      const old = dimsRef.current;
      const s = stateRef.current;

      if (s.placed && old.w && old.h) {
        // Reescalar lo que ya está en pantalla para que no salte.
        const rx = w / old.w, ry = h / old.h;
        s.ball.x *= rx; s.ball.y *= ry;
        s.ball.vx *= ry; s.ball.vy *= ry;
        s.playerY *= ry; s.cpuY *= ry;
        for (const t of s.trail) { t.x *= rx; t.y *= ry; }
      }

      dimsRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!s.placed) {
        const g = geom();
        s.playerY = g.h / 2 - g.ph / 2;
        s.cpuY = g.h / 2 - g.ph / 2;
        s.ball.x = g.w / 2 - g.ball / 2;
        s.ball.y = g.h / 2 - g.ball / 2;
        pointerRef.current.y = g.h / 2;
        s.placed = true;
      }
    };

    applyResize();
    const ro = new ResizeObserver(applyResize);
    ro.observe(wrap);
    window.addEventListener("resize", applyResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", applyResize);
    };
  }, [geom]);

  // --- Loop principal (arranca solo con countdown al montar) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function frame(now) {
      const s = stateRef.current;
      const g = geom();

      if (s.phase !== "matchover") {
        s.playerY = clamp(pointerRef.current.y - g.ph / 2, 0, g.h - g.ph);
      }

      if (s.phase === "countdown") {
        if (!s.countdownStart) s.countdownStart = now;
        if (now - s.countdownStart >= COUNTDOWN_STEP * 3) {
          const a = (Math.random() * 0.5 - 0.25) * Math.PI; // -45°..45°
          s.ball.vx = s.serveDir * g.baseSpeed * Math.cos(a);
          s.ball.vy = g.baseSpeed * Math.sin(a);
          s.mult = 1;
          s.trail = [];
          s.phase = "playing";
        }
      } else if (s.phase === "playing") {
        const b = s.ball;
        b.x += b.vx;
        b.y += b.vy;

        // Estela
        s.trail.push({ x: b.x + g.ball / 2, y: b.y + g.ball / 2 });
        if (s.trail.length > TRAIL_LEN) s.trail.shift();

        // Paredes
        if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        if (b.y + g.ball >= g.h) { b.y = g.h - g.ball; b.vy = -Math.abs(b.vy); }

        // Paleta jugador (izquierda)
        if (b.vx < 0 &&
            b.x <= g.playerX + g.pw && b.x + g.ball >= g.playerX &&
            b.y + g.ball >= s.playerY && b.y <= s.playerY + g.ph) {
          bounce(s, "player");
          b.x = g.playerX + g.pw;
        }
        // Paleta CPU (derecha)
        if (b.vx > 0 &&
            b.x + g.ball >= g.cpuX && b.x <= g.cpuX + g.pw &&
            b.y + g.ball >= s.cpuY && b.y <= s.cpuY + g.ph) {
          bounce(s, "cpu");
          b.x = g.cpuX - g.ball;
        }

        // IA CPU: persigue con tope de velocidad (vencible)
        const target = b.y + g.ball / 2 - g.ph / 2;
        s.cpuY = clamp(s.cpuY + clamp(target - s.cpuY, -g.cpuMax, g.cpuMax), 0, g.h - g.ph);

        // Puntos
        if (b.x + g.ball < 0) point(s, "cpu", now);
        else if (b.x > g.w) point(s, "player", now);
      } else if (s.phase === "setover") {
        if (now - s.setOverStart >= SETOVER_MS) {
          s.pScore = 0;
          s.cScore = 0;
          centerServe(s, s.setWinner === "player" ? 1 : -1, now); // saca el perdedor
        }
      } else if (s.phase === "matchover") {
        if (now - s.matchOverStart >= MATCHOVER_MS) {
          stateRef.current = freshMatch();
          stateRef.current.placed = true;
          const g2 = geom();
          stateRef.current.playerY = g2.h / 2 - g2.ph / 2;
          stateRef.current.cpuY = g2.h / 2 - g2.ph / 2;
          centerServe(stateRef.current, stateRef.current.serveDir, now);
        }
      }

      draw(ctx, s, now, geom());
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [geom, bounce, point, centerServe]);

  // --- Dibujo ---
  function draw(ctx, s, now, g) {
    const { w, h, scale, ball } = g;

    // Fondo arcade
    ctx.fillStyle = "#090912";
    ctx.fillRect(0, 0, w, h);

    // Línea punteada central
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 4 * scale;
    ctx.setLineDash([14 * scale, 18 * scale]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.restore();

    // Título
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `700 ${18 * scale}px 'Courier New',monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MARKET PONG".split("").join(" "), w / 2, 30 * scale);
    ctx.restore();

    // Marcador grande monospace
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `700 ${56 * scale}px 'Courier New',monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "right";
    ctx.fillText(String(s.pScore), w / 2 - 44 * scale, 46 * scale);
    ctx.textAlign = "left";
    ctx.fillText(String(s.cScore), w / 2 + 44 * scale, 46 * scale);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `700 ${12 * scale}px 'Courier New',monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`SETS  ${s.pSets} - ${s.cSets}`, w / 2, 112 * scale);
    ctx.restore();

    // Estela de la pelota (opacidad creciente hacia la cabeza)
    if (s.phase === "playing") {
      for (let i = 0; i < s.trail.length; i++) {
        const tp = s.trail[i];
        const a = ((i + 1) / s.trail.length) * 0.35;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(tp.x - ball / 2, tp.y - ball / 2, ball, ball);
        ctx.restore();
      }
    }

    // Paletas + pelota con glow suave
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(g.playerX, s.playerY, g.pw, g.ph);
    ctx.fillRect(g.cpuX, s.cpuY, g.pw, g.ph);
    if (s.phase === "playing" || s.phase === "countdown") {
      ctx.fillRect(s.ball.x, s.ball.y, ball, ball);
    }
    ctx.restore();

    // Countdown 3 · 2 · 1
    if (s.phase === "countdown") {
      const start = s.countdownStart || now;
      const step = Math.floor((now - start) / COUNTDOWN_STEP);
      const label = step <= 0 ? "3" : step === 1 ? "2" : "1";
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `700 ${84 * scale}px 'Courier New',monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, w / 2, h / 2 + 24 * scale);
      ctx.restore();
    }

    // Overlay fin de set
    if (s.phase === "setover") {
      overlayText(
        ctx, g,
        `SET ${s.setNumber} — ${s.setWinner === "player" ? "GANASTE" : "PERDISTE"}`,
        `Sets ${s.pSets} - ${s.cSets}`,
        s.setWinner === "player" ? "#16c784" : "#ea3943"
      );
    }

    // Overlay fin de partido
    if (s.phase === "matchover") {
      overlayText(
        ctx, g,
        s.matchWinner === "player" ? "GANASTE EL PARTIDO" : "GANÓ LA CPU",
        `Final ${s.pSets} - ${s.cSets} · reiniciando…`,
        s.matchWinner === "player" ? "#16c784" : "#ea3943"
      );
    }

    // Flash blanco al marcar (300ms)
    if (s.flashStart && now - s.flashStart < FLASH_MS) {
      ctx.save();
      ctx.globalAlpha = (1 - (now - s.flashStart) / FLASH_MS) * 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function overlayText(ctx, g, title, sub, color) {
    const { w, h, scale } = g;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `700 ${30 * scale}px 'Courier New',monospace`;
    ctx.fillText(title, w / 2, h / 2 - 12 * scale);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `700 ${14 * scale}px 'Courier New',monospace`;
    ctx.fillText(sub, w / 2, h / 2 + 22 * scale);
    ctx.restore();
  }

  // --- Control: la paleta izquierda sigue el puntero (mouse o touch) ---
  const movePointer = useCallback((clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.y = (clientY - rect.top) * (dimsRef.current.h / rect.height);
  }, []);

  const handleMouseMove = useCallback((e) => movePointer(e.clientY), [movePointer]);
  const handleTouchMove = useCallback((e) => {
    if (e.touches[0]) { movePointer(e.touches[0].clientY); }
  }, [movePointer]);

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Market Pong</span>
        <span className="text-xs text-text-sec">
          Mové el mouse para la paleta izquierda · 10 puntos por set · 2 sets gana
        </span>
      </div>

      <div ref={wrapRef} className="rounded-xl overflow-hidden" style={{ background: "#090912" }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          style={{ width: "100%", display: "block", cursor: "none", touchAction: "none" }}
        />
      </div>
    </div>
  );
}
