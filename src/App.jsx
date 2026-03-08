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

const DEFAULT_KPIS = { clientesUnicos: 832000, proyeccion: 2200000 };

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
  const [kpis, setKpis] = useState(DEFAULT_KPIS);
  const [loading, setLoading] = useState(true);
  const [newFecha, setNewFecha] = useState("");
  const [newEventos, setNewEventos] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [editingKpis, setEditingKpis] = useState(false);
  const [kpiForm, setKpiForm] = useState({ clientesUnicos: "", proyeccion: "" });

  useEffect(() => {
    const dbRef = ref(db, "dcp/eventos");
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.values(val).sort((a, b) => {
          const pa = a.fecha.split("/").reverse().join("");
          const pb = b.fecha.split("/").reverse().join("");
          return pa.localeCompare(pb);
        });
        setData(arr);
        setInitialized(true);
      } else if (!initialized) {
        seedDefaultData();
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const kpiRef = ref(db, "dcp/kpis");
    const unsub = onValue(kpiRef, (snapshot) => {
      const val = snapshot.val();
      if (val) setKpis(val);
    });
    return () => unsub();
  }, []);

  const seedDefaultData = async () => {
    const dbRef = ref(db, "dcp/eventos");
    const obj = {};
    DEFAULT_DATA.forEach((d, i) => { obj[i] = d; });
    await set(dbRef, obj);
  };

  const saveData = async (newArr) => {
    const dbRef = ref(db, "dcp/eventos");
    const obj = {};
    newArr.forEach((d, i) => { obj[i] = d; });
    await set(dbRef, obj);
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
    await saveData(updated);
    setNewFecha("");
    setNewEventos("");
    setSaving(false);
    setSaveMsg("✓ Publicado en tiempo real");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  const handleSaveKpis = async () => {
    const cu = parseInt(kpiForm.clientesUnicos.replace(/[^0-9]/g, ""), 10);
    const pr = parseInt(kpiForm.proyeccion.replace(/[^0-9]/g, ""), 10);
    if (isNaN(cu) || isNaN(pr)) return;
    const newKpis = { clientesUnicos: cu, proyeccion: pr };
    await set(ref(db, "dcp/kpis"), newKpis);
    setKpis(newKpis);
    setEditingKpis(false);
    setSaveMsg("✓ KPIs actualizados");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  const handleEdit = (idx) => {
