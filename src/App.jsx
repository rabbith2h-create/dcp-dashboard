import { useState, useEffect } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "./firebase";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from "recharts";

const PROMEDIO_DIA = 250000;
const UMBRAL = PROMEDIO_DIA * 0.9;

const DEFAULT_DATA = [
  { fecha: "01/03/2026", eventos: 282063 },
  { fecha: "02/03/2026", eventos: 234947 },
  { fecha: "03/03/2026", eventos: 245636 },
  { fecha: "04/03/2026", eventos: 214335 },
  { fecha: "05/03/2026", eventos: 213503 },
];

function formatNum(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString("es-MX");
}

function formatFull(n) {
  return n?.toLocaleString("es-MX") ?? "—";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const ev = payload.find(p => p.dataKey === "eventos")?.value;
  const pct = ev ? ((ev / PROMEDIO_DIA) * 100).toFixed(1) : null;
  const below = ev < UMBRAL;
  return (
    <div style={{
      background: "#0f1923", border: "1px solid #1e3a4a", borderRadius: 8,
      padding: "10px 14px", fontSize: 13, color: "#e0f0ff", minWidth: 170,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#5bc8f5" }}>{label}</div>
      <div>Eventos: <span style={{ fontWeight: 700 }}>{formatFull(ev)}</span></div>
      {pct && (
        <div style={{ marginTop: 4, color: below ? "#ff6b6b" : "#4ecdc4" }}>
          {pct}% del promedio {below ? "⚠️ bajo umbral" : "✓ OK"}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFecha, setNewFecha] = useState("");
  const [newEventos, setNewEventos] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [clientesUnicos, setClientesUnicos] = useState(832000);
  const [proyeccion, setProyeccion] = useState(2200000);
  const [editingKpi, setEditingKpi] = useState(null);
  const [kpiTemp, setKpiTemp] = useState("");

  useEffect(() => {
    const dbRef = ref(db, "dcp");
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (val.kpis) {
          setClientesUnicos(val.kpis.clientesUnicos ?? 832000);
          setProyeccion(val.kpis.proyeccion ?? 2200000);
        }
        if (val.eventos) {
          const raw = val.eventos;
          const arr = Object.values(raw)
            .filter(d => d && d.fecha && d.eventos)
            .sort((a, b) => {
              const pa = a.fecha.split("/").reverse().join("");
              const pb = b.fecha.split("/").reverse().join("");
              return pa.localeCompare(pb);
            });
          setData(arr);
        } else {
          seedDefaultData();
        }
      } else {
        seedDefaultData();
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const seedDefaultData = async () => {
    const obj = {};
    DEFAULT_DATA.forEach((d, i) => { obj[i] = d; });
    await set(ref(db, "dcp/eventos"), obj);
  };

  const saveEventos = async (newArr) => {
    const obj = {};
    newArr.forEach((d, i) => { obj[i] = d; });
    await set(ref(db, "dcp/eventos"), obj);
  };

  const saveKpis = async (cu, pr) => {
    await set(ref(db, "dcp/kpis"), { clientesUnicos: cu, proyeccion: pr });
  };

  const handleSave = async () => {
    if (!newFecha || !newEventos) return;
    const ev = parseInt(newEventos.replace(/[^0-9]/g, ""), 10);
    if (isNaN(ev)) return;
    setSaving(true);
    let updated;
    if (editIdx !== null) {
      updated = data.map((d, i) => i === editIdx ? { fecha: newFecha, eventos: ev } : d);
      setEditIdx(null);
    } else {
      const exists = data.findIndex(d => d.fecha === newFecha);
      if (exists >= 0) {
        updated = data.map((d, i) => i === exists ? { ...d, eventos: ev } : d);
      } else {
        updated = [...data, { fecha: newFecha, eventos: ev }];
      }
    }
    updated.sort((a, b) => {
      const pa = a.fecha.split("/").reverse().join("");
      const pb = b.fecha.split("/").reverse().join("");
      return pa.localeCompare(pb);
    });
    await saveEventos(updated);
    setNewFecha("");
    setNewEventos("");
    setSaving(false);
    setSaveMsg("✓ Publicado en tiempo real");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  const handleEditKpi = (kpi) => {
    setEditingKpi(kpi);
    setKpiTemp(kpi === "clientes" ? clientesUnicos.toString() : proyeccion.toString());
  };

  const handleSaveKpi = async () => {
    const val = parseInt(kpiTemp.replace(/[^0-9]/g, ""), 10);
    if (isNaN(val)) return;
    let newCu = clientesUnicos;
    let newPr = proyeccion;
    if (editingKpi === "clientes") { setClientesUnicos(val); newCu = val; }
    if (editingKpi === "proyeccion") { setProyeccion(val); newPr = val; }
    await saveKpis(newCu, newPr);
    setEditingKpi(null);
    setKpiTemp("");
  };

  const handleEdit = (idx) => {
    setEditIdx(idx);
    setNewFecha(data[idx].fecha);
    setNewEventos(data[idx].eventos.toString());
  };

  const handleDelete = async (idx) => {
    const updated = data.filter((_, i) => i !== idx);
    await saveEventos(updated);
    if (editIdx === idx) { setEditIdx(null); setNewFecha(""); setNewEventos(""); }
  };

  const handleReset = async () => {
    await seedDefaultData();
    setSaveMsg("↺ Datos restaurados");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  // Total se calcula automáticamente sumando todos los eventos
  const totalBonos = data.reduce((s, d) => s + (d.eventos || 0), 0);
  const avgEventos = data.length ? Math.round(totalBonos / data.length) : 0;
  const belowDays = data.filter(d => d.eventos < UMBRAL).length;
  const chartData = data.map(d => ({ ...d, promedio: PROMEDIO_DIA }));
  const lastFecha = data[data.length - 1]?.fecha ?? "—";

  const inputStyle = {
    background: "#0d1e2b", border: "1px solid #1e3a50", borderRadius: 8,
    color: "#e0f0ff", padding: "10px 14px", fontSize: 14, outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif",
  };

  if (loading) return (
    <div style={{
      background: "#071219", minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      color: "#5bc8f5", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 32, animation: "spin 1s linear infinite" }}>⟳</div>
      <div style={{ fontSize: 16 }}>Conectando con Firebase…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{
      background: "#071219", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif",
      color: "#e0f0ff", padding: "28px 32px", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{
          background: "linear-gradient(135deg, #0a9fd4, #0d5f8a)", borderRadius: 12,
          padding: "8px 16px", fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700, fontSize: 18, letterSpacing: 1, color: "#fff",
        }}>bait</div>
        <div style={{ width: 1, height: 36, background: "#1e3a4a" }} />
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff" }}>
            DCP <span style={{ color: "#5bc8f5" }}>|</span> Evolutivo de DCP — Marzo 2026
          </div>
          <div style={{ fontSize: 12, color: "#4a7a94", marginTop: 2 }}>Dashboard en tiempo real · Firebase Realtime Database</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ecdc4", boxShadow: "0 0 8px #4ecdc4", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 12, color: "#4ecdc4", fontWeight: 600 }}>EN VIVO</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {/* Total bonos - automático */}
        <div style={{
          background: "linear-gradient(135deg, #0d1e2b 0%, #0a1920 100%)",
          border: "1px solid #5bc8f533", borderRadius: 14, padding: "22px 26px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #5bc8f5, transparent)" }} />
          <div style={{ fontSize: 13, color: "#6a9db5", marginBottom: 10 }}>Total de bonos entregados {lastFecha}</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 34, color: "#5bc8f5" }}>
            {formatNum(totalBonos)}
          </div>
        </div>

        {/* Clientes únicos - editable */}
        <div style={{
          background: "linear-gradient(135deg, #0d1e2b 0%, #0a1920 100%)",
          border: "1px solid #4ecdc433", borderRadius: 14, padding: "22px 26px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #4ecdc4, transparent)" }} />
          <div style={{ fontSize: 13, color: "#6a9db5", marginBottom: 10 }}>Clientes únicos recibiendo megas gratis</div>
          {editingKpi === "clientes" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...inputStyle, fontSize: 20, fontWeight: 700, padding: "6px 10px" }}
                value={kpiTemp} onChange={e => setKpiTemp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveKpi()} autoFocus />
              <button onClick={handleSaveKpi} style={{ background: "#4ecdc4", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✓</button>
              <button onClick={() => setEditingKpi(null)} style={{ background: "transparent", border: "1px solid #1e3a50", borderRadius: 8, color: "#8ab4c8", padding: "6px 10px", cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 34, color: "#4ecdc4" }}>{formatNum(clientesUnicos)}</div>
              <button onClick={() => handleEditKpi("clientes")} style={{ background: "transparent", border: "1px solid #1e3a50", borderRadius: 6, color: "#4a7a94", cursor: "pointer", fontSize: 14, padding: "4px 8px", marginTop: 4 }}>✏️</button>
            </div>
          )}
        </div>

        {/* Proyección - editable */}
        <div style={{
          background: "linear-gradient(135deg, #0d1e2b 0%, #0a1920 100%)",
          border: "1px solid #a78bfa33", borderRadius: 14, padding: "22px 26px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #a78bfa, transparent)" }} />
          <div style={{ fontSize: 13, color: "#6a9db5", marginBottom: 10 }}>Proyección usuarios únicos (mes)</div>
          {editingKpi === "proyeccion" ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...inputStyle, fontSize: 20, fontWeight: 700, padding: "6px 10px" }}
                value={kpiTemp} onChange={e => setKpiTemp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveKpi()} autoFocus />
              <button onClick={handleSaveKpi} style={{ background: "#a78bfa", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✓</button>
              <button onClick={() => setEditingKpi(null)} style={{ background: "transparent", border: "1px solid #1e3a50", borderRadius: 8, color: "#8ab4c8", padding: "6px 10px", cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 34, color: "#a78bfa" }}>{formatNum(proyeccion)}</div>
              <button onClick={() => handleEditKpi("proyeccion")} style={{ background: "transparent", border: "1px solid #1e3a50", borderRadius: 6, color: "#4a7a94", cursor: "pointer", fontSize: 14, padding: "4px 8px", marginTop: 4 }}>✏️</button>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{
        background: "linear-gradient(135deg, #0d1e2b 0%, #0a1920 100%)",
        border: "1px solid #1e3a4a", borderRadius: 14, padding: "24px 28px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Eventos Diarios</div>
            <div style={{ fontSize: 12, color: "#4a7a94", marginTop: 2 }}>Promedio x día: 250,000 · Umbral inferior 10% = 225,000</div>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#6a9db5" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, background: "#0a6fa8", display: "inline-block" }} /> EVENTOS
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 2, background: "#f97316", display: "inline-block" }} /> Promedio
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 24, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2f3f" />
            <XAxis dataKey="fecha" tick={{ fill: "#4a7a94", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4a7a94", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.toLocaleString()} width={75} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={UMBRAL} stroke="#ff6b6b66" strokeDasharray="4 4"
              label={{ value: "Umbral -10%", fill: "#ff6b6b", fontSize: 11, position: "insideTopRight" }} />
            <Bar dataKey="eventos" fill="#0a6fa8" radius={[6, 6, 0, 0]}
              label={{ position: "top", fill: "#8ab4c8", fontSize: 10, formatter: v => v.toLocaleString() }} />
            <Line type="monotone" dataKey="promedio" stroke="#f97316" strokeWidth={2}
              dot={{ fill: "#f97316", r: 4 }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div style={{
          background: "linear-gradient(135deg, #0d1e2b 0%, #0a1920 100%)",
          border: "1px solid #1e3a4a", borderRadius: 14, padding: "24px",
        }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
            {editIdx !== null ? "✏️ Editar registro" : "➕ Agregar dato diario"}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#4a7a94", display: "block", marginBottom: 6 }}>Fecha (DD/MM/AAAA)</label>
            <input style={inputStyle} placeholder="ej. 06/03/2026" value={newFecha} onChange={e => setNewFecha(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: "#4a7a94", display: "block", marginBottom: 6 }}>Número de eventos</label>
            <input style={inputStyle} placeholder="ej. 230000" value={newEventos}
              onChange={e => setNewEventos(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} />
          </div>
          <button onClick={handleSave} disabled={saving || !newFecha || !newEventos} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #0a9fd4, #0d5f8a)",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            opacity: (!newFecha || !newEventos) ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif",
          }}>
            {saving ? "Guardando…" : editIdx !== null ? "Actualizar" : "Guardar y publicar 🚀"}
          </button>
          {editIdx !== null && (
            <button onClick={() => { setEditIdx(null); setNewFecha(""); setNewEventos(""); }} style={{
              width: "100%", marginTop: 8, padding: "10px", borderRadius: 10,
              border: "1px solid #1e3a50", background: "transparent",
              color: "#8ab4c8", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            }}>Cancelar</button>
          )}
          {saveMsg && <div style={{ marginTop: 12, textAlign: "center", color: "#4ecdc4", fontSize: 13, fontWeight: 600 }}>{saveMsg}</div>}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1e3a4a" }}>
            <div style={{ fontSize: 12, color: "#4a7a94", marginBottom: 12 }}>Resumen del período</div>
            {[
              { label: "Días registrados", value: data.length },
              { label: "Promedio real", value: formatFull(avgEventos) },
              { label: "Días bajo umbral", value: `${belowDays} día${belowDays !== 1 ? "s" : ""}`, warn: belowDays > 0 },
              { label: "Máximo", value: formatFull(Math.max(...(data.length ? data.map(d => d.eventos) : [0]))) },
              { label: "Mínimo", value: formatFull(Math.min(...(data.length ? data.map(d => d.eventos) : [0]))) },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "#6a9db5" }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.warn ? "#ff6b6b" : "#e0f0ff" }}>{s.value}</span>
              </div>
            ))}
          </div>
          <button onClick={handleReset} style={{
            width: "100%", marginTop: 14, padding: "8px", borderRadius: 8,
            border: "1px solid #ff6b6b33", background: "transparent",
            color: "#ff6b6b88", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
          }}>Restaurar datos originales</button>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #0d1e2b 0%, #0a1920 100%)",
          border: "1px solid #1e3a4a", borderRadius: 14, padding: "24px", overflow: "auto",
        }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
            Registros del mes
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e3a4a" }}>
                {["Fecha", "Eventos", "vs Promedio", "Estado", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 12px", color: "#4a7a94", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row, idx) => {
                const realIdx = data.length - 1 - idx;
                const pct = ((row.eventos / PROMEDIO_DIA) * 100).toFixed(1);
                const ok = row.eventos >= UMBRAL;
                return (
                  <tr key={realIdx} style={{ borderBottom: "1px solid #0d1e2b", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#0a1920"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.fecha}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: "#5bc8f5" }}>{formatFull(row.eventos)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: ok ? "#4ecdc4" : "#ff6b6b" }}>{pct}%</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{
                        background: ok ? "#4ecdc422" : "#ff6b6b22", color: ok ? "#4ecdc4" : "#ff6b6b",
                        border: `1px solid ${ok ? "#4ecdc444" : "#ff6b6b44"}`,
                        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                      }}>{ok ? "✓ OK" : "⚠ Bajo"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <button onClick={() => handleEdit(realIdx)} style={{ background: "none", border: "none", color: "#4a7a94", cursor: "pointer", fontSize: 15, marginRight: 6 }}>✏️</button>
                      <button onClick={() => handleDelete(realIdx)} style={{ background: "none", border: "none", color: "#ff6b6b66", cursor: "pointer", fontSize: 15 }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #2a4a5e; }
        input:focus { border-color: #0a9fd4 !important; box-shadow: 0 0 0 2px #0a9fd422; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
