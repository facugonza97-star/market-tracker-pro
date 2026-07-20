"use client";
import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

function printLRMTicket({ efectivo, plazo, tasa, comision, r, fecha }) {
  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ticket LRM</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a2e;padding:30px 36px;max-width:520px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #1a1a2e}
    .header h1{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px}
    .header .sub{font-size:8px;color:#888}
    .logo-name{font-size:12px;font-weight:700;text-align:right}
    .logo-sub{font-size:8px;color:#999;display:block;text-align:right;margin-top:1px}
    .section-title{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e8e8e8}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0}
    .row .lbl{color:#666;font-size:10px}
    .row .val{font-family:monospace;font-size:10px;color:#1a1a2e}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:4px;border-top:2px solid #1a1a2e}
    .total-row .lbl{font-size:12px;font-weight:700;color:#1a1a2e}
    .total-row .val{font-size:16px;font-weight:700;font-family:monospace;color:#1a1a2e}
    .footer{margin-top:20px;padding-top:8px;border-top:1px solid #ccc;display:flex;justify-content:space-between}
    .footer p{font-size:7px;color:#aaa}
    @media print{body{padding:20px 24px}@page{margin:.5cm;size:A4}}
  </style></head><body>
  <div class="header">
    <div>
      <h1>Ticket LRM — Letra de Regulación Monetaria</h1>
      <div class="sub">Gastón Bengochea Corredor de Bolsa · Precios indicativos</div>
    </div>
    <div>
      <div class="logo-name">Gastón Bengochea</div>
      <span class="logo-sub">Corredor de Bolsa</span>
    </div>
  </div>
  <div style="margin-bottom:16px">
    <div class="section-title">Parámetros</div>
    <div class="row"><span class="lbl">Valor efectivo</span><span class="val">$ ${fmt(parseFloat(efectivo))}</span></div>
    <div class="row"><span class="lbl">Plazo</span><span class="val">${plazo} días</span></div>
    <div class="row"><span class="lbl">Tasa efectiva anual</span><span class="val">${tasa}%</span></div>
    <div class="row"><span class="lbl">Comisión GB</span><span class="val">${comision}%</span></div>
  </div>
  <div style="margin-bottom:16px">
    <div class="section-title">Resultado</div>
    <div class="row"><span class="lbl">Valor nominal</span><span class="val">$ ${fmt(r.valorNominal)}</span></div>
    <div class="row"><span class="lbl">Comisión GB</span><span class="val">$ ${fmt(r.comisionUSD)}</span></div>
    <div class="total-row"><span class="lbl">GANANCIA NETA</span><span class="val">$ ${fmt(r.gananciaNeta)}</span></div>
  </div>
  <div class="footer">
    <p>Gastón Bengochea Corredor de Bolsa · Precios indicativos, no constituyen oferta de compraventa</p>
    <p>${fecha}</p>
  </div>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

function LRMCalculadora({ onClose }) {
  const [efectivo, setEfectivo] = useState("");
  const [plazo, setPlazo] = useState("");
  const [tasa, setTasa] = useState("");
  const [comision, setComision] = useState("");

  const calc = () => {
    const e = parseFloat(efectivo);
    const d = parseFloat(plazo);
    const t = parseFloat(tasa);
    const c = parseFloat(comision) || 0;
    if (isNaN(e) || isNaN(d) || isNaN(t) || e <= 0 || d <= 0 || t <= 0) return null;
    const precio = 1 / Math.pow(1 + t / 100, d / 365);
    const coeficiente = 1 / precio;
    const valorNominal = e * coeficiente;
    const comisionUSD = e * c / 100;
    const gananciaNeta = valorNominal - e - comisionUSD;
    return { precio, coeficiente, valorNominal, comisionUSD, gananciaNeta };
  };

  const r = calc();
  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date();
  const fecha = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#0F1520", border: "1px solid #2A3A50", borderRadius: 2, width: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ background: "#81020D", padding: "8px 16px", borderRadius: "2px 2px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[
              ["1) Deal", () => {}],
              ["2) Recalcular", () => { setEfectivo(""); setPlazo(""); setTasa(""); setComision(""); }],
              ["3) Imprimir", () => { if (r) printLRMTicket({ efectivo, plazo, tasa, comision, r, fecha }); }],
            ].map(([lbl, fn]) => (
              <button key={lbl} onClick={fn} style={{ color: "#5B8DEF", fontSize: 11, fontWeight: 600, letterSpacing: 0.3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#E8C9C9", fontSize: 11 }}>Calculadora LRM</span>
            <button onClick={onClose} style={{ color: "#E8C9C9", fontSize: 16, background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["Valor efectivo (UYU)", efectivo, setEfectivo, "Ej: 100000"],
              ["Plazo (días)", plazo, setPlazo, "Ej: 180"],
              ["Tasa efectiva anual (%)", tasa, setTasa, "Ej: 9.5"],
              ["Comisión (%)", comision, setComision, "Ej: 0.30"],
            ].map(([lbl, val, set, ph]) => (
              <div key={lbl}>
                <label style={{ color: "#5B8DEF", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>{lbl}</label>
                <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ width: "100%", background: "#1A2535", border: "1px solid #2A3A50", borderRadius: 6, padding: "7px 10px", color: "white", fontSize: 12, fontFamily: "monospace", outline: "none" }} />
              </div>
            ))}
          </div>

          {r ? (
            <div style={{ background: "#1A2535", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ color: "#5B8DEF", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Resumen</div>
              {[
                ["Precio", r.precio.toFixed(6)],
                ["Coeficiente", r.coeficiente.toFixed(6)],
                ["Valor nominal", "$ " + fmt(r.valorNominal)],
                ["Comisión GB", "$ " + fmt(r.comisionUSD)],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 7, marginBottom: 7, borderBottom: "1px solid #1E2D40" }}>
                  <span style={{ color: "#94A3B8", fontSize: 11 }}>{l}</span>
                  <span style={{ color: "#CBD5E0", fontSize: 11, fontFamily: "monospace" }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTop: "2px solid #2A3A50" }}>
                <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>GANANCIA NETA</span>
                <span style={{ background: "#F8A11E", color: "#3a2400", fontSize: 16, fontWeight: 700, fontFamily: "monospace", padding: "2px 10px", borderRadius: 4 }}>$ {fmt(r.gananciaNeta)}</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#64748B", fontSize: 12, padding: "12px 0" }}>Completá los campos para calcular</div>
          )}

          {r && (
            <button onClick={() => printLRMTicket({ efectivo, plazo, tasa, comision, r, fecha })}
              style={{ background: "#1a1a2e", border: "1px solid #4A6FA5", borderRadius: 8, padding: "9px 0", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>
              Imprimir Ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0F1520",
      border: "1px solid #2A3A50",
      borderRadius: 8,
      padding: "8px 12px",
    }}>
      <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#ffffff", fontSize: 15, fontWeight: 600, fontFamily: "monospace" }}>
        {payload[0].value.toFixed(2)}%
      </div>
    </div>
  );
}

export default function LRMPanel() {
  const [lrm, setLrm] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [lrmModal, setLrmModal] = useState(false);

  useEffect(() => {
    fetch("/api/lrm").then((r) => r.json()).then(setLrm).catch(() => {});
    fetch("/api/bcu-calendar").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setCalendar(data);
      else setCalendar([]);
    }).catch(() => setCalendar([]));
  }, []);

  const curve = lrm?.curve?.filter((d) => d.rate !== null) || [];
  const chartData = curve.map((d) => ({ mat: d.label, rate: d.rate }));

  const rates = chartData.map((d) => d.rate);
  const minRate = rates.length ? Math.floor(Math.min(...rates) * 10) / 10 - 0.5 : 0;
  const maxRate = rates.length ? Math.ceil(Math.max(...rates) * 10) / 10 + 0.5 : 10;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {lrmModal && <LRMCalculadora onClose={() => setLrmModal(false)} />}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-[3px] h-3.5 rounded-full bg-accent" />
          <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">🇺🇾 Letras de Regulación Monetaria (LRM)</span>
        </div>
        <button onClick={() => setLrmModal(true)} className="text-xs px-3 py-1.5 rounded font-semibold text-[#3a2400] transition hover:opacity-90 bg-price">Calculadora LRM</button>
      </div>

      {chartData.length > 0 ? (
        <>
          <div style={{ background: "#000000", borderRadius: 8, padding: "8px 4px" }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 25, right: 15, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lrmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#031D38" stopOpacity={1} />
                  <stop offset="100%" stopColor="#031D38" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#FFFFFF" strokeOpacity={0.15} />
              <XAxis
                dataKey="mat"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#1E2D40" }}
              />
              <YAxis
                domain={[minRate, maxRate]}
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.toFixed(1) + "%"}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#FFFFFF", strokeOpacity: 0.3 }} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#FFFFFF"
                strokeWidth={2}
                fill="url(#lrmGrad)"
                dot={{ r: 4, fill: "#FFFFFF", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#031D38", strokeWidth: 2 }}
              >
                <LabelList dataKey="rate" position="top" offset={10} formatter={(v) => v.toFixed(2) + "%"} style={{ fontSize: 11, fill: "#FFFFFF", fontWeight: 600 }} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
          </div>
          {lrm?.updatedAt && (
            <div className="text-[9px] text-text-dim text-right mt-1">
              Datos actualizados: {new Date(lrm.updatedAt).toLocaleDateString("es-UY")}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-text-dim text-sm">
          No hay datos de LRM disponibles
        </div>
      )}

      {/* BCU Calendar */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-[3px] h-3.5 rounded-full bg-accent" />
          <span className="text-[13px] font-bold text-accent uppercase tracking-[0.15em]">Calendario de Licitaciones BCU</span>
        </div>
        {calendar && calendar.length > 0 ? (
          <div className="rounded-md overflow-hidden border border-border">
          <table className="w-full" style={{ background: "#000000" }}>
            <thead>
              <tr style={{ backgroundColor: "#0d0d1a" }}>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Fecha Lic.</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide border-r border-white/10">Fecha Venc.</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide">Plazo</th>
              </tr>
            </thead>
            <tbody>
              {calendar.map((item, i) => {
                const getWeek = (dateStr) => {
                  const [d, m, y] = dateStr.split("/").map(Number);
                  const date = new Date(y, m - 1, d);
                  const startOfYear = new Date(y, 0, 1);
                  return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                };
                let weekBreak = false;
                if (i > 0 && item.fechaLicitacion && calendar[i - 1].fechaLicitacion) {
                  try {
                    weekBreak = getWeek(item.fechaLicitacion) !== getWeek(calendar[i - 1].fechaLicitacion);
                  } catch {}
                }
                return (
                  <React.Fragment key={i}>
                    {weekBreak && (
                      <tr><td colSpan={3} style={{ height: 8, background: "#0d0d1a", padding: 0, border: "none" }} /></tr>
                    )}
                    <tr className="border-b border-white/5 hover:bg-[#1a2f52]">
                      <td className="px-3 py-1.5 text-xs text-price font-mono border-r border-white/5">{item.fechaLicitacion}</td>
                      <td className="px-3 py-1.5 text-right text-xs text-white font-mono border-r border-white/5">{item.fechaVencimiento}</td>
                      <td className="px-3 py-1.5 text-right text-xs text-white font-mono">{item.plazo}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : calendar && calendar.length === 0 ? (
          <div className="text-xs text-text-dim">No hay licitaciones programadas.</div>
        ) : (
          <div className="text-xs text-text-dim">Cargando calendario...</div>
        )}
      </div>
    </div>
  );
}
