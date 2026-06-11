"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

const H = 520;
const PERIODS = ["d1","w1","m1","ytd","y1","y3","y5"];
const PERIOD_LABELS = { d1:"1D", w1:"1S", m1:"1M", ytd:"YTD", y1:"1A", y3:"3A", y5:"5A" };

// Side launcher — left edge, mid height
const LAUNCH_X = 34;
const LAUNCH_Y = H / 2;

function getColor(val) {
  if (val > 0) return { center: "#1a5c35", edge: "#0a2018", stroke: "#16c784", text: "#16c784" };
  if (val < 0) return { center: "#5c1a1a", edge: "#200a0a", stroke: "#ea3943", text: "#ea3943" };
  return { center: "#151520", edge: "#080810", stroke: "#444460", text: "rgba(255,255,255,0.3)" };
}

function drawBubble(ctx, node) {
  const { x, y, val, ticker, scale = 1.0 } = node;
  const r = node.r * scale;
  const c = getColor(val);

  ctx.save();
  ctx.translate(x, y);

  // Radial gradient fill — lighter top-left, darker bottom-right
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
  grad.addColorStop(0, c.center);
  grad.addColorStop(1, c.edge);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Thin stroke
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Glass sheen arc (top-left)
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.22, r * 0.52, Math.PI * 1.05, Math.PI * 1.82);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = "round";
  ctx.stroke();

  // Ticker text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = r > 56 ? 13 : r > 42 ? 12 : 10;
  ctx.font = `600 ${fontSize}px system-ui,-apple-system,sans-serif`;
  ctx.fillStyle = "#ffffff";
  const tickerY = r > 42 ? -6 : 0;
  ctx.fillText(ticker, 0, tickerY);

  // Percentage text (only if bubble is big enough)
  if (r > 28) {
    ctx.font = `400 10px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle = c.text;
    ctx.globalAlpha = 0.8;
    const pctY = r > 42 ? 9 : 14;
    ctx.fillText((val > 0 ? "+" : "") + val.toFixed(1) + "%", 0, pctY);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// Mini candle used both for the projectile and for explosion debris
function drawCandle(ctx, bW, bH, wH) {
  // Wicks
  ctx.strokeStyle = "#16c784";
  ctx.lineWidth = Math.max(1.5, bW * 0.18);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -bH / 2 - wH);
  ctx.lineTo(0, -bH / 2);
  ctx.moveTo(0, bH / 2);
  ctx.lineTo(0, bH / 2 + wH);
  ctx.stroke();

  // Body — bright green gradient
  const grad = ctx.createLinearGradient(-bW / 2, 0, bW / 2, 0);
  grad.addColorStop(0, "#3ff2a0");
  grad.addColorStop(0.5, "#16c784");
  grad.addColorStop(1, "#0a8f5a");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#0a4a28";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-bW / 2, -bH / 2, bW, bH);
  ctx.fill();
  ctx.stroke();
}

function drawProjectile(ctx, proj) {
  ctx.save();
  ctx.translate(proj.x, proj.y);
  // Rotate to point in direction of travel (body's long axis aligns with motion)
  const dir = Math.atan2(proj.vy, proj.vx);
  ctx.rotate(dir + Math.PI / 2);

  // Glow
  ctx.shadowColor = "#16c784";
  ctx.shadowBlur = 14;
  // Body 14w x 40h, wicks 12px
  drawCandle(ctx, 14, 40, 12);
  ctx.restore();
}

function drawAimAndCannon(ctx, mx, my) {
  const dir = Math.atan2(my - LAUNCH_Y, mx - LAUNCH_X);

  // Aim line from launcher to cursor
  ctx.save();
  ctx.strokeStyle = "rgba(22,199,132,0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(LAUNCH_X, LAUNCH_Y);
  ctx.lineTo(mx, my);
  ctx.stroke();
  ctx.restore();

  // Reticle at cursor
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, 12, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.restore();

  // Cannon — dark rotating barrel anchored on the left edge
  ctx.save();
  ctx.translate(LAUNCH_X, LAUNCH_Y);
  ctx.rotate(dir);
  // Barrel
  ctx.fillStyle = "#1a1a2e";
  ctx.strokeStyle = "#16c784";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(-6, -9, 34, 18);
  ctx.fill();
  ctx.stroke();
  // Muzzle ring
  ctx.beginPath();
  ctx.arc(28, 0, 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(22,199,132,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Cannon base/hub
  ctx.save();
  ctx.beginPath();
  ctx.arc(LAUNCH_X, LAUNCH_Y, 12, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a2e";
  ctx.fill();
  ctx.strokeStyle = "#16c784";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export default function BubbleChart({ sections }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const tRef = useRef(0);
  const mouseRef = useRef({ x: 200, y: 200 });
  const dragRef = useRef(null);
  const gameModeRef = useRef(false);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const popupsRef = useRef([]);
  const scoreRef = useRef(0);
  const ammoRef = useRef(10);

  const [period, setPeriod] = useState("d1");
  const [category, setCategory] = useState("all");
  const [gameMode, setGameMode] = useState(false);
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState(10);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function render() {
      const ctx = canvas.getContext("2d");
      const W = canvas.width;
      tRef.current += 0.006;
      const t = tRef.current;
      const nodes = nodesRef.current;

      // Float physics
      nodes.forEach(n => {
        if (n.dragging || n.exploded) return;
        const dx = Math.sin(t * 0.7 + n.phase) * 0.25 + Math.cos(t * 0.4 + n.phase * 1.3) * 0.18;
        const dy = Math.cos(t * 0.6 + n.phase * 0.8) * 0.25 + Math.sin(t * 0.5 + n.phase * 1.7) * 0.18;
        n.vx = n.vx * 0.97 + dx * 0.03;
        n.vy = n.vy * 0.97 + dy * 0.03;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x - n.r < 0) { n.x = n.r; n.vx = Math.abs(n.vx) * 0.6; }
        if (n.x + n.r > W) { n.x = W - n.r; n.vx = -Math.abs(n.vx) * 0.6; }
        if (n.y - n.r < 0) { n.y = n.r; n.vy = Math.abs(n.vy) * 0.6; }
        if (n.y + n.r > H) { n.y = H - n.r; n.vy = -Math.abs(n.vy) * 0.6; }
      });

      // Bubble collision
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (a.exploded || b.exploded) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minD = a.r + b.r + 2;
          if (dist < minD) {
            const overlap = (minD - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            if (!a.dragging) { a.x -= nx * overlap; a.vx -= nx * 0.25; }
            if (!b.dragging) { b.x += nx * overlap; b.vx += nx * 0.25; }
            if (!a.dragging) { a.y -= ny * overlap; a.vy -= ny * 0.25; }
            if (!b.dragging) { b.y += ny * overlap; b.vy += ny * 0.25; }
          }
        }
      }

      // Subtle pulse scale
      nodes.forEach(n => {
        n.scale = 1.0 + Math.sin(t * 1.2 + n.phase) * 0.01;
      });

      // Clear canvas
      ctx.clearRect(0, 0, W, H);

      // Draw bubbles
      nodes.forEach(n => {
        if (!n.exploded) drawBubble(ctx, n);
      });

      // Game mode
      if (gameModeRef.current) {
        // Move & draw projectiles, check collisions
        projectilesRef.current = projectilesRef.current.filter(p => {
          // Cannon-ball physics: high horizontal speed, light gravity, slight curve toward aim
          p.vy += 0.15;
          p.vx += p.curveX;
          p.vy += p.curveY;
          p.curveX *= 0.94;
          p.curveY *= 0.94;
          p.x += p.vx;
          p.y += p.vy;

          // Trail (12 fading points)
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 12) p.trail.shift();

          // Draw trail
          for (let ti = 0; ti < p.trail.length; ti++) {
            const tp = p.trail[ti];
            const a = (ti / p.trail.length) * 0.6;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = "#16c784";
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, 2 + (ti / p.trail.length) * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Collision
          for (const n of nodes) {
            if (n.exploded) continue;
            const dx = p.x - n.x, dy = p.y - n.y;
            if (Math.sqrt(dx * dx + dy * dy) < n.r) {
              n.exploded = true;
              const c = getColor(n.val);
              const pts = Math.round(Math.abs(n.val) * 10) + 5;
              // 30 particles, some are mini candles
              for (let k = 0; k < 30; k++) {
                const a = (k / 30) * Math.PI * 2 + Math.random() * 0.3;
                const spd = 3 + Math.random() * 6;
                particlesRef.current.push({
                  x: n.x, y: n.y,
                  vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                  color: c.stroke, life: 1.0,
                  r: 2 + Math.random() * 4,
                  candle: k % 4 === 0,
                  rot: Math.random() * Math.PI * 2,
                  vrot: (Math.random() - 0.5) * 0.4,
                });
              }
              // Score popup
              popupsRef.current.push({
                x: n.x, y: n.y - n.r - 10,
                vy: -1.2, life: 1.0,
                text: `${n.ticker} +${pts}`,
                color: c.stroke,
              });
              scoreRef.current += pts;
              setScore(scoreRef.current);
              return false; // remove projectile
            }
          }

          if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) return false;
          drawProjectile(ctx, p);
          return true;
        });

        // Particles
        particlesRef.current = particlesRef.current.filter(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.14;
          p.vx *= 0.96;
          p.rot += p.vrot;
          p.life -= 0.02;
          if (p.life <= 0) return false;
          ctx.save();
          ctx.globalAlpha = p.life;
          if (p.candle) {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-2, -5 * p.life, 4, 10 * p.life);
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          return true;
        });

        // Score popups
        popupsRef.current = popupsRef.current.filter(p => {
          p.y += p.vy;
          p.life -= 0.018;
          if (p.life <= 0) return false;
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.font = `bold 13px system-ui,-apple-system,sans-serif`;
          ctx.fillStyle = p.color;
          ctx.textAlign = "center";
          ctx.fillText(p.text, p.x, p.y);
          ctx.restore();
          return true;
        });

        // Aim line + rotating cannon
        drawAimAndCannon(ctx, mouseRef.current.x, mouseRef.current.y);
      }

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Rebuild nodes on data/period/category change
  useEffect(() => {
    if (!sections) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width || canvas.offsetWidth || 680;

    if (simRef.current) simRef.current.stop();
    projectilesRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];

    const items = category === "all"
      ? Object.entries(sections).flatMap(([cat, itms]) => itms.map(d => ({ ...d, cat })))
      : (sections[category] || []).map(d => ({ ...d, cat: category }));

    if (!items.length) { nodesRef.current = []; return; }

    const vals = items.map(d => Math.abs(d[period] || 0));
    const maxV = Math.max(...vals, 1);

    nodesRef.current = items.map(d => ({
      ...d,
      val: d[period] || 0,
      r: 24 + (Math.abs(d[period] || 0) / maxV) * 50,
      x: W / 2 + (Math.random() - 0.5) * W * 0.5,
      y: H / 2 + (Math.random() - 0.5) * H * 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      scale: 1.0,
      dragging: false,
      exploded: false,
    }));

    const nodes = nodesRef.current;
    simRef.current = d3.forceSimulation(nodes)
      .force("collision", d3.forceCollide(d => d.r + 3).iterations(4))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.04))
      .alphaDecay(0.04).velocityDecay(0.4);

    return () => { if (simRef.current) simRef.current.stop(); };
  }, [period, category, sections]);

  // Canvas pixel size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    mouseRef.current = { x: mx, y: my };

    if (dragRef.current) {
      const n = dragRef.current;
      n.x = Math.max(n.r + 3, Math.min(canvas.width - n.r - 3, mx));
      n.y = Math.max(n.r + 3, Math.min(H - n.r - 3, my));
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (gameModeRef.current) {
      if (ammoRef.current <= 0) return;
      const dx = mx - LAUNCH_X, dy = my - LAUNCH_Y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      // High horizontal launch speed; light curve nudges it toward where the user aimed
      ammoRef.current -= 1;
      setAmmo(ammoRef.current);
      projectilesRef.current.push({
        x: LAUNCH_X + 24, y: LAUNCH_Y,
        vx: 16 * Math.max(ux, 0.55),
        vy: uy * 6,
        curveX: ux * 0.12,
        curveY: uy * 0.12,
        trail: [],
      });
      return;
    }

    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.exploded) continue;
      const dx = mx - n.x, dy = my - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r) {
        n.dragging = true;
        dragRef.current = n;
        break;
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current.dragging = false;
      dragRef.current.vx = (Math.random() - 0.5) * 1.2;
      dragRef.current.vy = (Math.random() - 0.5) * 1.2;
      dragRef.current = null;
    }
  }, []);

  const toggleGame = useCallback(() => {
    const next = !gameModeRef.current;
    gameModeRef.current = next;
    setGameMode(next);
    if (next) {
      scoreRef.current = 0;
      ammoRef.current = 10;
      setScore(0);
      setAmmo(10);
      projectilesRef.current = [];
      particlesRef.current = [];
      popupsRef.current = [];
      nodesRef.current.forEach(n => { n.exploded = false; });
    }
  }, []);

  const categories = sections ? Object.keys(sections) : [];

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Burbujas de Mercado</span>
        <div className="flex items-center gap-2 flex-wrap">
          {gameMode && (
            <span className="text-sm font-mono text-white">
              Score:&nbsp;<span className="text-[#16c784] font-bold">{score}</span>
              &nbsp;|&nbsp;
              Velas:&nbsp;<span className={ammo > 3 ? "text-white" : "text-[#ea3943] font-bold"}>{ammo}</span>
            </span>
          )}
          <button
            onClick={toggleGame}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              gameMode
                ? "bg-[#16c784]/20 border-[#16c784]/50 text-[#16c784]"
                : "bg-card border-border text-text-sec hover:text-white"
            }`}
          >
            🕹 Modo Juego
          </button>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none"
          >
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              period === p ? "bg-white/10 border-white/30 text-white" : "bg-card border-border text-text-sec hover:text-white"
            }`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 40%, #0d0d1e 0%, #070710 100%)" }}
      >
        <canvas
          ref={canvasRef}
          height={H}
          style={{ width: "100%", display: "block", cursor: gameMode ? "crosshair" : "grab" }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      {gameMode && ammo === 0 && (
        <div className="mt-3 text-center">
          <span className="text-text-sec text-sm">Sin velas. </span>
          <button onClick={toggleGame} className="text-[#16c784] text-sm font-semibold hover:underline">
            Jugar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
