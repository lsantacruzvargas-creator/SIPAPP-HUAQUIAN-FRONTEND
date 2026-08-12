import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalNuevaOT from "../components/ModalNuevaOT";
import { DotChip, badgeOT, dotOT } from "../components/detalleShared";
import * as XLSX from "xlsx";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FILTROS_VACIO = { ano: "", mes: "", estado: "", empresa: "", planta: "", busqueda: "" };

const SORTS = [
  { valor: "fecha",             label: "Más reciente" },
  { valor: "numeroOT",          label: "N° OT" },
  { valor: "numeroCotizacion",  label: "N° Cotización" },
];

// Comparador descendente: numérico si ambos parsean como número, si no
// localeCompare; los valores vacíos van al final.
const compararTexto = (na, nb) => {
  if (!na && !nb) return 0;
  if (!na) return 1;
  if (!nb) return -1;
  const numA = Number(na), numB = Number(nb);
  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
  return String(nb).localeCompare(String(na));
};

const SELECT =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";

const TH = "px-4 py-3 font-semibold text-gray-500 whitespace-nowrap";

function TablaOTs({ titulo, acento, ordenes, onSelect, vacioMsg }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({ordenes.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "1000px" }}>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
              <tr>
                <th className={`${TH} text-left`}>N° OT</th>
                <th className={`${TH} text-left`}>N° Cotización</th>
                <th className={`${TH} text-center`}>Fecha recibida</th>
                <th className={`${TH} text-left`}>Empresa</th>
                <th className={`${TH} text-left`}>Planta</th>
                <th className={`${TH} text-left`}>Encargado</th>
                <th className={`${TH} text-left`}>Descripción</th>
                <th className={`${TH} text-center`}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td>
                </tr>
              ) : (
                ordenes.map((o) => (
                  <tr
                    key={o._id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${o.anulado ? "opacity-50" : ""}`}
                    onClick={() => onSelect(o)}
                  >
                    <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                      {o.numeroOT || <span className="text-gray-300 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {o.cotizacion?.numeroCotizacion || <span className="text-gray-300 font-sans">—</span>}
                        {o.anulado && (
                          <span title={o.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                            Anulada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-500 whitespace-nowrap">
                      {o.fechaRecibida ? new Date(o.fechaRecibida).toLocaleDateString("es-PE") : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {o.empresa?.razonSocial || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{o.planta || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-gray-600">{o.encargado || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-gray-700">{o.titulo || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-center">
                      <DotChip chip={badgeOT(o.estado)} dot={dotOT(o.estado)}>{o.estado}</DotChip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ListaOrdenesTrabajo() {
  const [ordenes, setOrdenes] = useState([]);
  const [facturaPorNumDoc, setFacturaPorNumDoc] = useState(new Map());
  const [ocPorNumDoc, setOcPorNumDoc] = useState(new Map());
  const [filtros, setFiltros] = useState(FILTROS_VACIO);
  const [sortBy, setSortBy] = useState("numeroOT");
  const [seleccionada, setSeleccionada] = useState(null);
  const [crearOTOpen, setCrearOTOpen] = useState(false);

  const cargar = () =>
    Promise.all([
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/facturas").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then((r) => r.ok ? r.json() : []),
    ]).then(([ots, facts, ocs]) => {
      setOrdenes(ots);
      // Una OT está "facturada" si su cadena (mismo numeroDocumento) tiene una
      // factura con número de factura.
      setFacturaPorNumDoc(new Map(
        facts.filter((f) => f.numeroFactura && f.numeroDocumento != null)
             .map((f) => [f.numeroDocumento, f.numeroFactura])
      ));
      setOcPorNumDoc(new Map(
        ocs.filter((oc) => oc.numeroDocumento != null)
           .map((oc) => [oc.numeroDocumento, oc.numeroOrden])
      ));
    });

  useEffect(() => { cargar(); }, []);

  const anos = [...new Set(ordenes.map((o) => new Date(o.createdAt).getFullYear()))].sort(
    (a, b) => b - a
  );

  const empresasLista = [
    ...new Map(
      ordenes
        .filter((o) => o.empresa?._id)
        .map((o) => [o.empresa._id, o.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [
    ...new Set(
      (filtros.empresa ? ordenes.filter((o) => o.empresa?._id === filtros.empresa) : ordenes)
        .map((o) => o.planta)
        .filter(Boolean)
    ),
  ].sort();

  const handleFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const handleEmpresa = (e) => setFiltros({ ...filtros, empresa: e.target.value, planta: "" });

  const filtradas = ordenes.filter((o) => {
    const fecha = new Date(o.createdAt);
    const q = filtros.busqueda.toLowerCase();
    return (
      (!filtros.ano || fecha.getFullYear() === parseInt(filtros.ano)) &&
      (!filtros.mes || fecha.getMonth() + 1 === parseInt(filtros.mes)) &&
      (!filtros.estado || o.estado === filtros.estado) &&
      (!filtros.empresa || o.empresa?._id === filtros.empresa) &&
      (!filtros.planta || o.planta === filtros.planta) &&
      (!q ||
        o.titulo?.toLowerCase().includes(q) ||
        o.numeroOT?.toLowerCase().includes(q) ||
        o.cotizacion?.numeroCotizacion?.toLowerCase().includes(q) ||
        ocPorNumDoc.get(o.numeroDocumento)?.toLowerCase().includes(q) ||
        facturaPorNumDoc.get(o.numeroDocumento)?.toLowerCase().includes(q) ||
        o.empresa?.razonSocial?.toLowerCase().includes(q) ||
        o.empresa?.ruc?.includes(q))
    );
  });

  filtradas.sort((a, b) => {
    if (sortBy === "numeroOT") return compararTexto(a.numeroOT, b.numeroOT);
    if (sortBy === "numeroCotizacion") return compararTexto(a.cotizacion?.numeroCotizacion, b.cotizacion?.numeroCotizacion);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const esCerrada = (o) => o.estadoCadena === "cerrado";
  const cerradas = filtradas.filter((o) => esCerrada(o));
  const pendientes = filtradas.filter((o) => !esCerrada(o));
  const hayFiltro = Object.values(filtros).some(Boolean);

  // Mismas columnas que TablaOTs — una hoja por cada tabla visible.
  const filaOT = (o) => ({
    "N° OT":          o.numeroOT || "—",
    "N° Cotización":  o.cotizacion?.numeroCotizacion || "—",
    "Fecha recibida": o.fechaRecibida ? new Date(o.fechaRecibida).toLocaleDateString("es-PE") : "—",
    "Empresa":        o.empresa?.razonSocial || "—",
    "Planta":         o.planta || "—",
    "Encargado":      o.encargado || "—",
    "Descripción":    o.titulo || "—",
    "Estado":         o.estado || "—",
  });

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    [
      ["Pendientes", pendientes],
      ["Cerradas", cerradas],
    ].forEach(([nombre, lista]) => {
      const ws = XLSX.utils.json_to_sheet(lista.map(filaOT));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    XLSX.writeFile(wb, "ordenes-de-trabajo.xlsx");
  };

  return (
    <>
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Órdenes de Trabajo</h2>
          <span className="text-sm text-gray-400">{filtradas.length} orden{filtradas.length !== 1 ? "es" : ""}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => setCrearOTOpen(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
          >
            + Crear Orden de Trabajo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">

<select name="empresa" value={filtros.empresa} onChange={handleEmpresa} className={SELECT}>
          <option value="">Toda empresa</option>
          {empresasLista.map((e) => (
            <option key={e._id} value={e._id}>
              {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
            </option>
          ))}
        </select>

        {plantasLista.length > 0 && (
          <select name="planta" value={filtros.planta} onChange={handleFiltro} className={SELECT}>
            <option value="">Toda planta</option>
            {plantasLista.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}        

        <select name="estado" value={filtros.estado} onChange={handleFiltro} className={SELECT}>
          <option value="">Todo estado</option>
          <option value="pendiente">Pendiente</option>
          <option value="en progreso">En progreso</option>
          <option value="completado">Completado</option>
          <option value="entregado">Entregado</option>
        </select>

        

        <select name="ano" value={filtros.ano} onChange={handleFiltro} className={SELECT}>
          <option value="">Todos los años</option>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select name="mes" value={filtros.mes} onChange={handleFiltro} className={SELECT}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        <input
          name="busqueda"
          value={filtros.busqueda}
          onChange={handleFiltro}
          placeholder="Buscar por N° OT, cotización, OC, factura, título, empresa o RUC…"
          className={`${SELECT} flex-1 min-w-52`}
        />

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={SELECT}>
          {SORTS.map(({ valor, label }) => (
            <option key={valor} value={valor}>Ordenar: {label}</option>
          ))}
        </select>

        {Object.values(filtros).some(Boolean) && (
          <button
            onClick={() => setFiltros(FILTROS_VACIO)}
            className="text-sm text-gray-400 hover:text-gray-700 transition"
          >
            Limpiar
          </button>
        )}
      </div>

      <TablaOTs
        titulo="Órdenes pendientes"
        acento="bg-amber-500"
        ordenes={pendientes}
        onSelect={setSeleccionada}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes pendientes"}
      />

      <TablaOTs
        titulo="Órdenes cerradas"
        acento="bg-gray-500"
        ordenes={cerradas}
        onSelect={setSeleccionada}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin órdenes cerradas"}
      />
    </div>

    {seleccionada && (
      <DetalleDocumento
        tipo="ot"
        data={seleccionada}
        onClose={() => { setSeleccionada(null); cargar(); }}
        onGuardadaOT={(actualizada) => {
          setOrdenes((prev) =>
            prev.map((o) => (o._id === actualizada._id ? actualizada : o))
          );
        }}
      />
    )}

    {crearOTOpen && (
      <ModalNuevaOT
        onClose={() => setCrearOTOpen(false)}
        onCreada={() => { setCrearOTOpen(false); cargar(); }}
      />
    )}
    </>
  );
}
