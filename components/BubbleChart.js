"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

const H = 520;
const PERIODS = ["d1","w1","m1","ytd","y1","y3","y5"];
const PERIOD_LABELS = { d1:"1D", w1:"1S", m1:"1M", ytd:"YTD", y1:"1A", y3:"3A", y5:"5A" };

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

function drawCandlestick(ctx, proj) {
  const { x, y, angle } = proj;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle - Math.PI / 2);

  const bW = 5, bH = 14, wH = 7;

  // Upper wick
  ctx.strokeStyle = "#16c784";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -bH / 2 - wH);
  ctx.lineTo(0, -bH / 2);
  ctx.stroke();

  // Lower wick
  ctx.beginPath();
  ctx.moveTo(0, bH / 2);
  ctx.lineTo(0, bH / 2 + wH);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#16c784";
  ctx.strokeStyle = "#0a4a28";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-bW / 2, -bH / 2, bW, bH);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawCrosshair(ctx, mx, my, W) {
  const originX = W / 2, originY = H;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(mx, my);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(mx, my, 12, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  // Origin indicator
  ctx.beginPath();
  ctx.arc(originX, originY - 4, 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(22,199,132,0.6)";
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
        const hitIndices = new Set();
        projectilesRef.current = projectilesRef.current.filter(p => {
          p.x += p.vx;
          p.y += p.vy;

          // Collision
          for (const n of nodes) {
            if (n.exploded) continue;
            const dx = p.x - n.x, dy = p.y - n.y;
            if (Math.sqrt(dx * dx + dy * dy) < n.r) {
              n.exploded = true;
              const c = getColor(n.val);
              const pts = Math.round(Math.abs(n.val) * 10) + 5;
              // Particles
              for (let k = 0; k < 20; k++) {
                const a = (k / 20) * Math.PI * 2;
                const spd = 2.5 + Math.random() * 4;
                particlesRef.current.push({
                  x: n.x, y: n.y,
                  vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                  color: c.stroke, life: 1.0,
                  r: 2 + Math.random() * 3,
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

          if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) return false;
          drawCandlestick(ctx, p);
          return true;
        });

        // Particles
        particlesRef.current = particlesRef.current.filter(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.12;
          p.vx *= 0.96;
          p.life -= 0.022;
          if (p.life <= 0) return false;
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fill();
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

        // Crosshair
        drawCrosshair(ctx, mouseRef.current.x, mouseRef.current.y, W);
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
      const W = canvas.width;
      const originX = W / 2, originY = H;
      const dx = mx - originX, dy = my - originY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 14;
      ammoRef.current -= 1;
      setAmmo(ammoRef.current);
      projectilesRef.current.push({
        x: originX, y: originY - 4,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        angle: Math.atan2(dy, dx),
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
