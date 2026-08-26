import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ── Colores ──────────────────────────────────────────────────────────────────
const COLOR_OT = {
  pendiente:    "#f59e0b",
  "en progreso": "#3b82f6",
  completado:   "#22c55e",
};
const COLOR_FACT = {
  "sin pago":    "#ef4444",
  "pago parcial": "#f59e0b",
  pagado:        "#22c55e",
};

// ── Tooltip personalizado ────────────────────────────────────────────────────
function TooltipCustom({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-2 text-sm">
      <span className="font-medium text-gray-700 capitalize">{name}:</span>{" "}
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}

// ── Tarjeta KPI ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  const texto = {
    gray:  "text-gray-800",
    blue:  "text-blue-700",
    amber: "text-amber-700",
    green: "text-green-600",
    red:   "text-red-600",
  };
  return (
    <div className="card flex flex-col gap-1 min-w-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl sm:text-3xl font-bold leading-tight break-all ${texto[color] ?? texto.gray}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Fila de conversión (una etapa de la cadena de documentos) ───────────────
// `enlazados` = cuántos elementos de origen SÍ tienen al menos un documento
// destino apuntándolos (por relación real, no una resta de conteos — dos
// listas de tamaños distintos no implican que la diferencia sean los "sin
// vincular"; con más OCs que cotizaciones esa resta daba negativo).
function FilaConversion({ labelOrigen, labelDestino, totalOrigen, enlazados, colorBarra, colorDestino, onClickSinVincular }) {
  const sinVincular = totalOrigen - enlazados;
  const pct = totalOrigen > 0 ? Math.round((enlazados / totalOrigen) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">{labelOrigen}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{totalOrigen}</p>
        </div>
        <div className="text-2xl font-light text-gray-300 pb-1">→</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">{labelDestino}</p>
          <p className={`text-2xl sm:text-3xl font-bold ${colorDestino}`}>{enlazados}</p>
        </div>
        <div
          className={`min-w-0 ${onClickSinVincular ? "cursor-pointer hover:opacity-70 transition" : ""}`}
          onClick={onClickSinVincular}
        >
          <p className="text-xs text-gray-400 mb-0.5">{labelOrigen} sin {labelDestino.toLowerCase()}</p>
          <p className="text-2xl sm:text-3xl font-bold text-red-500">{sinVincular}</p>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-2.5 rounded-full ${colorBarra} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400">
        {enlazados} de {totalOrigen} {labelOrigen.toLowerCase()} tienen {labelDestino.toLowerCase()} vinculada
      </p>
    </div>
  );
}

// ── Tarjeta de conversión: Cotización → OC → Factura ─────────────────────────
function KpiContrasteCard({ cots, ocs, facts }) {
  const navigate = useNavigate();

  const cotizacionesConOC = new Set(ocs.map((oc) => oc.cotizacion?._id).filter(Boolean));
  const cotsConOC = cots.filter((c) => cotizacionesConOC.has(c._id)).length;

  const ocsConFactura = new Set(facts.map((f) => f.ordenCompra?._id).filter(Boolean));
  const ocsConFacturaCount = ocs.filter((oc) => ocsConFactura.has(oc._id)).length;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex flex-col gap-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Conversión de documentos
      </p>
      <FilaConversion
        labelOrigen="Cotizaciones" labelDestino="Órdenes de Compra"
        totalOrigen={cots.length} enlazados={cotsConOC}
        colorBarra="bg-indigo-500" colorDestino="text-indigo-700"
        onClickSinVincular={() => navigate("/cotizaciones", { state: { filtroOC: "sin" } })}
      />
      <div className="border-t border-gray-100" />
      <FilaConversion
        labelOrigen="Órdenes de Compra" labelDestino="Facturas"
        totalOrigen={ocs.length} enlazados={ocsConFacturaCount}
        colorBarra="bg-emerald-500" colorDestino="text-emerald-700"
      />
    </div>
  );
}

function LabelDona({ cx, cy, midAngle, innerRadius, outerRadius, value }) {
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={15} fontWeight="700">
      {value}
    </text>
  );
}

// ── Gráfico de dona ──────────────────────────────────────────────────────────
function GraficoDona({ titulo, datos, colores }) {
  const total = datos.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{titulo}</h3>
      <p className="text-xs text-gray-400 mb-4">{total} registros en total</p>
      {total === 0 ? (
        <p className="text-sm text-gray-300 text-center py-12">Sin datos</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={datos}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={105}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={<LabelDona />}
            >
              {datos.map((entry) => (
                <Cell key={entry.name} fill={colores[entry.name] ?? "#9ca3af"} />
              ))}
            </Pie>
            <Tooltip content={<TooltipCustom />} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-gray-600 capitalize">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const SELECT = "input-field w-auto";

function porFecha(arr, campoFecha, ano, mes) {
  return arr.filter((item) => {
    const f = item[campoFecha] ? new Date(item[campoFecha]) : null;
    if (!f) return true;
    if (ano && f.getFullYear() !== parseInt(ano)) return false;
    if (mes && f.getMonth() + 1 !== parseInt(mes)) return false;
    return true;
  });
}

// ── Dashboard de Planner / Coordinadora ──────────────────────────────────────
// Vista específica pedida por el usuario — reemplaza por completo el
// contenido del dashboard de admin/jefatura para estos dos roles (no se
// combinan). Un track (Prueba o Intervención) se considera "listo" cuando
// llegó a completado/entregado — mismo criterio que ya usa la vista
// simplificada de OTs (ListaOrdenesTrabajo.jsx: esTrackListo/categoriaGlobal).
function DashboardPlanner({ ots, ocs }) {
  const totalOTs = ots.length;
  const esTrackListo = (o) =>
    ["completado", "entregado"].includes(o.estado) || ["completado", "entregado"].includes(o.estadoPrueba);

  const pendientes  = ots.filter((o) => o.estadoGeneral === "no asignado").length;
  const enProgreso  = ots.filter((o) => o.estadoGeneral !== "no asignado" && !esTrackListo(o)).length;
  const completadas = ots.filter((o) => esTrackListo(o) && !o.informesAprobados).length;
  const entregadas  = ots.filter((o) => esTrackListo(o) && o.informesAprobados).length;

  // "Completadas o entregadas" = cualquier OT cuyo track ya llegó al final,
  // sin importar si el informe quedó aprobado o no — sobre ESE subconjunto
  // se mide cuántas todavía no tienen informe / no tienen OC vinculada (un
  // trabajo terminado sin su papeleo es la señal de alerta real; contar
  // "sin informe" sobre el total mezclaría OTs que ni siquiera empezaron).
  const completadasOEntregadas = ots.filter((o) => esTrackListo(o));
  const conInforme = completadasOEntregadas.filter((o) => o.estadoInformes !== "pendiente").length;

  const cotizacionesConOC = new Set(ocs.map((oc) => oc.cotizacion?._id).filter(Boolean));
  const tieneOC = (o) => !!o.cotizacion && cotizacionesConOC.has(o.cotizacion._id || o.cotizacion);
  const conOC = completadasOEntregadas.filter(tieneOC).length;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Panel de Órdenes de Trabajo</h2>
        <p className="text-sm text-gray-400 mt-0.5">Indicadores de avance — {totalOTs} OTs en total</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="OTs pendientes"   value={pendientes}  sub={`de ${totalOTs} OTs en total`} color="amber" />
        <KpiCard label="OTs en progreso"  value={enProgreso}  sub={`de ${totalOTs} OTs en total`} color="blue"  />
        <KpiCard label="OTs completadas"  value={completadas} sub={`de ${totalOTs} OTs en total`} color="green" />
        <KpiCard label="OTs entregadas"   value={entregadas}  sub={`de ${totalOTs} OTs en total`} color="green" />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Papeleo pendiente en OTs ya completadas o entregadas
        </p>
        <FilaConversion
          labelOrigen="OTs completadas o entregadas" labelDestino="Informe"
          totalOrigen={completadasOEntregadas.length} enlazados={conInforme}
          colorBarra="bg-sky-500" colorDestino="text-sky-700"
        />
        <div className="border-t border-gray-100" />
        <FilaConversion
          labelOrigen="OTs completadas o entregadas" labelDestino="OC"
          totalOrigen={completadasOEntregadas.length} enlazados={conOC}
          colorBarra="bg-violet-500" colorDestino="text-violet-700"
        />
      </div>
    </div>
  );
}

// ── Dashboard principal ──────────────────────────────────────────────────────
export default function Dashboard() {
  const usuario = JSON.parse(sessionStorage.getItem("usuario") ?? "null");
  const [ots, setOts]     = useState([]);
  const [facts, setFacts] = useState([]);
  const [cots, setCots]   = useState([]);
  const [ocs, setOcs]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroAno, setFiltroAno] = useState("");
  const [filtroMes, setFiltroMes] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/facturas").then((r) => r.ok ? r.json() : []),
      fetchAuth("/cotizaciones").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then((r) => r.ok ? r.json() : []),
    ]).then(([o, f, c, oc]) => {
      setOts(o); setFacts(f); setCots(c); setOcs(oc);
      setCargando(false);
    });
  }, []);

  // ── Años disponibles (union de todos los datos) ──────────────────────────
  const anos = [...new Set([
    ...facts.map((f) => new Date(f.fechaEmision).getFullYear()),
    ...cots.map((c) => c.fecha ? new Date(c.fecha).getFullYear() : null),
    ...ocs.map((o) => o.fecha  ? new Date(o.fecha).getFullYear()  : null),
    ...ots.map((o) => o.fecha  ? new Date(o.fecha).getFullYear()  : null),
  ].filter(Boolean))].sort((a, b) => b - a);

  // ── Arrays filtrados ─────────────────────────────────────────────────────
  const otsFiltradas   = porFecha(ots,   "fecha",        filtroAno, filtroMes);
  const factsFiltradas = porFecha(facts, "fechaEmision", filtroAno, filtroMes);
  const cotsFiltradas  = porFecha(cots,  "fecha",        filtroAno, filtroMes);
  const ocsFiltradas   = porFecha(ocs,   "fecha",        filtroAno, filtroMes);

  // ── Datos para gráficos ──────────────────────────────────────────────────
  const contarPor = (arr, campo) => {
    const map = {};
    arr.forEach((item) => {
      const k = item[campo] ?? "sin definir";
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  };

  const datosOT   = contarPor(otsFiltradas,   "estado");
  const datosFact = contarPor(factsFiltradas, "estadoPago");

  // ── KPIs ─────────────────────────────────────────────────────────────────
  // Brechas en la cadena Cotización → OT → OC → Factura: cada una se
  // calcula siguiendo el campo de relación real del documento (no una
  // resta de totales), igual que "Cotizaciones sin OC" más abajo.
  const otsSinCotizacion = otsFiltradas.filter((o) => !o.cotizacion).length;

  const cotizacionesConOC = new Set(ocsFiltradas.map((oc) => oc.cotizacion?._id).filter(Boolean));
  const otsSinOC = otsFiltradas.filter((o) => !o.cotizacion || !cotizacionesConOC.has(o.cotizacion._id)).length;

  const ocsConFactura = new Set(factsFiltradas.map((f) => f.ordenCompra?._id).filter(Boolean));
  const ocSinFactura = ocsFiltradas.filter((oc) => !ocsConFactura.has(oc._id)).length;

  const facturasSinPago = factsFiltradas.filter((f) => f.estadoPago === "sin pago").length;

  // El modelo Factura no tiene campo `monto` (siempre daba 0) y `montoPagado`
  // es un registro de pago parcial, no el total de la factura — el monto
  // real de una factura es `totalAPagar` (con `total` como respaldo, mismo
  // criterio que usa DetalleFactura.jsx). "Total pagado" suma las facturas
  // ya marcadas como pagadas; "Por cobrar" suma las que todavía no.
  const montoFactura = (f) => Number(f.totalAPagar ?? f.total) || 0;
  const totalPagado = factsFiltradas
    .filter((f) => f.estadoPago === "pagado")
    .reduce((s, f) => s + montoFactura(f), 0);
  const porCobrar = factsFiltradas
    .filter((f) => f.estadoPago !== "pagado")
    .reduce((s, f) => s + montoFactura(f), 0);

  const fmt = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  if (cargando) {
    return <div className="p-8 text-sm text-gray-400">Cargando dashboard…</div>;
  }

  // Planner, Coordinadora y Administración ("asistente" es el valor de rol
  // real, ver Sidebar.jsx) ven un panel completamente distinto (a pedido
  // explícito del usuario) — nunca el dashboard de admin/jefatura de abajo.
  if (["planner", "coordinadora", "asistente"].includes(usuario?.rol)) {
    return <DashboardPlanner ots={ots} ocs={ocs} />;
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">

      {/* Bienvenida + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Bienvenido, {usuario?.nombre}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Panel principal — SIP App Huaquian</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className={SELECT}>
            <option value="">Todos los años</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className={SELECT}>
            <option value="">Todos los meses</option>
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          {(filtroAno || filtroMes) && (
            <button
              onClick={() => { setFiltroAno(""); setFiltroMes(""); }}
              className="text-sm text-gray-400 hover:text-gray-700 transition"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* KPIs — fila 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="OTs sin cotización" value={otsSinCotizacion} sub={`${otsFiltradas.length} OTs en total`} color="amber" />
        <KpiCard label="OTs sin Orden de Compra"         value={otsSinOC}         sub={`${otsFiltradas.length} OTs en total`} color="blue"  />
        <KpiCard label="OC sin Factura"     value={ocSinFactura}     sub={`${ocsFiltradas.length} OC en total`}  color="amber" />
        <KpiCard label="Facturas sin pago"  value={facturasSinPago}  sub={`${factsFiltradas.length} facturas en total`} color="red" />
      </div>

      {/* KPIs — fila 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard label="Total pagado" value={fmt(totalPagado)} sub="suma de facturas pagadas"      color="green" />
        <KpiCard label="Por cobrar"   value={fmt(porCobrar)}   sub="suma de facturas sin pagar"    color="red"   />
      </div>

      {/* Contraste OC vs Cotizaciones */}
      <KpiContrasteCard cots={cotsFiltradas} ocs={ocsFiltradas} facts={factsFiltradas} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GraficoDona
          titulo="Órdenes de Trabajo por estado"
          datos={datosOT}
          colores={COLOR_OT}
        />
        <GraficoDona
          titulo="Facturas por estado de pago"
          datos={datosFact}
          colores={COLOR_FACT}
        />
      </div>

    </div>
  );
}
