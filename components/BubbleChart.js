"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function BubbleChart({ sections }) {
  const svgRef = useRef(null);
  const animRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const [period, setPeriod] = useState("d1");
  const [category, setCategory] = useState("all");

  const PERIODS = ["d1","w1","m1","ytd","y1","y3","y5"];
  const PERIOD_LABELS = {d1:"1D",w1:"1S",m1:"1M",ytd:"YTD",y1:"1A",y3:"3A",y5:"5A"};
  const H = 520;

  function col(val) {
    const t = Math.min(Math.abs(val) / 7, 1);
    if (val > 0) return {
      fill: d3.interpolateRgb("#0e2d1c","#0d7a45")(t),
      text: d3.interpolateRgb("#4cd98a","#22c770")(t)
    };
    if (val < 0) return {
      fill: d3.interpolateRgb("#2d0e12","#7a1020")(t),
      text: d3.interpolateRgb("#e06070","#e03050")(t)
    };
    return { fill: "#151520", text: "rgba(255,255,255,0.3)" };
  }

  function getItems() {
    if (!sections) return [];
    if (category === "all") return Object.entries(sections).flatMap(([cat, items]) => items.map(d => ({ ...d, cat })));
    return (sections[category] || []).map(d => ({ ...d, cat: category }));
  }

  function startFloat(g, W) {
    let t = 0;
    const nodes = nodesRef.current;
    function frame() {
      t += 0.006;
      nodes.forEach(n => {
        if (n.dragging) return;
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
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
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
      g.attr("transform", d => `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => {
    if (!svgRef.current || !sections) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (simRef.current) simRef.current.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const W = svgRef.current.clientWidth || 680;
    svg.attr("width", W).attr("height", H);

    const items = getItems();
    if (!items.length) return;

    const vals = items.map(d => Math.abs(d[period] || 0));
    const maxV = Math.max(...vals, 1);

    nodesRef.current = items.map((d, i) => ({
      ...d,
      val: d[period] || 0,
      r: 24 + (Math.abs(d[period] || 0) / maxV) * 50,
      x: W / 2 + (Math.random() - 0.5) * W * 0.5,
      y: H / 2 + (Math.random() - 0.5) * H * 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      dragging: false,
    }));
    const nodes = nodesRef.current;

    const g = svg.selectAll("g.bc").data(nodes).enter().append("g").attr("class", "bc").style("cursor", "pointer");

    g.append("circle").attr("r", d => d.r).attr("fill", d => col(d.val).fill);

    g.append("text").attr("text-anchor", "middle")
      .attr("dy", d => d.r > 42 ? "-7px" : "4px")
      .attr("font-size", d => d.r > 56 ? "13px" : d.r > 42 ? "12px" : "10px")
      .attr("font-weight", "600").attr("fill", d => col(d.val).text)
      .attr("pointer-events", "none").text(d => d.ticker);

    g.filter(d => d.r > 28).append("text").attr("text-anchor", "middle")
      .attr("dy", d => d.r > 42 ? "9px" : "15px")
      .attr("font-size", "10px").attr("font-weight", "400")
      .attr("fill", d => col(d.val).text).attr("fill-opacity", 0.75)
      .attr("pointer-events", "none")
      .text(d => (d.val > 0 ? "+" : "") + d.val.toFixed(1) + "%");

    const drag = d3.drag()
      .on("start", (e, d) => { d.dragging = true; d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.x = d.fx = Math.max(d.r + 3, Math.min(W - d.r - 3, e.x)); d.y = d.fy = Math.max(d.r + 3, Math.min(H - d.r - 3, e.y)); })
      .on("end", (e, d) => { d.dragging = false; d.vx = (Math.random() - 0.5) * 1.2; d.vy = (Math.random() - 0.5) * 1.2; d.fx = null; d.fy = null; });
    g.call(drag);

    g.on("mouseenter", function (e, d) {
      if (d.dragging) return;
      d3.select(this).select("circle").transition().duration(100).attr("r", d.r * 1.08);
    }).on("mouseleave", function (e, d) {
      d3.select(this).select("circle").transition().duration(100).attr("r", d.r);
    });

    simRef.current = d3.forceSimulation(nodes)
      .force("collision", d3.forceCollide(d => d.r + 3).iterations(4))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.04))
      .alphaDecay(0.04).velocityDecay(0.4)
      .on("tick", () => {
        nodes.forEach(n => { n.x = Math.max(n.r + 3, Math.min(W - n.r - 3, n.x)); n.y = Math.max(n.r + 3, Math.min(H - n.r - 3, n.y)); });
        g.attr("transform", d => `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
      })
      .on("end", () => startFloat(g, W));

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (simRef.current) simRef.current.stop();
    };
  }, [period, category, sections]);

  const categories = sections ? Object.keys(sections) : [];

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[20px] font-semibold text-white">Burbujas de Mercado</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${period === p ? "bg-white/10 border-white/30 text-white" : "bg-card border-border text-text-sec hover:text-white"}`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: "#090912" }}>
        <svg ref={svgRef} style={{ width: "100%", display: "block", cursor: "grab" }} height={H} />
      </div>
    </div>
  );
}
