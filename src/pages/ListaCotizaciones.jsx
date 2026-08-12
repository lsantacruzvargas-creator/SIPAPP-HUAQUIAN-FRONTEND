import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalImportarExcel, { COLS_COT_OT } from "../components/ModalImportarExcel";
import ModalNuevaOT from "../components/ModalNuevaOT";
import ModalNuevaCotizacion from "../components/ModalNuevaCotizacion";
import * as XLSX from "xlsx";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FILTROS_VACIO = { empresa: "", planta: "", ano: "", mes: "", oc: "", busqueda: "" };

const VISTAS = [
  { valor: "todas",      label: "Todas las tablas" },
  { valor: "sinOT",      label: "Cotizaciones sin OT" },
  { valor: "pendientes", label: "Cotizaciones pendientes de OC" },
  { valor: "conOC",      label: "Cotización con OC" },
  { valor: "cerradas",   label: "Cotizaciones cerradas" },
];

const TH = "px-4 py-3 font-semibold text-gray-500 whitespace-nowrap";

const SORTS = [
  { valor: "numeroOT",          label: "N° OT" },
  { valor: "numeroCotizacion",  label: "N° Cotización" },
  { valor: "fecha",             label: "Más reciente" },
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

const numerosOT = (ots) =>
  ots?.length ? ots.map((o) => o.numeroOT).filter(Boolean).join(", ") : null;

function TablaCotizaciones({ titulo, acento, cotizaciones, otsPorCot, onSelect, vacioMsg }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({cotizaciones.length})</span>
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
              <th className={`${TH} text-right`}>Total sin IGV (S/)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cotizaciones.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td>
              </tr>
            ) : (
              cotizaciones.map((c) => (
                <tr
                  key={c._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${c.anulado ? "opacity-50" : ""} ${c._esOT ? "bg-indigo-50/30" : ""}`}
                  onClick={() => onSelect(c)}
                >
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                    {numerosOT(otsPorCot.get(c._id)) || <span className="text-gray-300 font-sans">—</span>}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {c._esOT ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                          Sin cotización
                        </span>
                      ) : (
                        c.numeroCotizacion || <span className="text-gray-300 font-sans">—</span>
                      )}
                      {c.anulado && (
                        <span title={c.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                          Anulada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-500 whitespace-nowrap">
                    {c.fechaRecibida ? new Date(c.fechaRecibida).toLocaleDateString("es-PE") : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700">
                    {c.empresa?.razonSocial || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{c.planta || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.encargado || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-gray-700">{c.titulo}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {Number(c.subtotal || Number(c.total) / 1.18).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
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

export default function ListaCotizaciones() {
  const location = useLocation();
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [filtros, setFiltros] = useState({
    ...FILTROS_VACIO,
    oc: location.state?.filtroOC || "",
  });
  const [seleccionada, setSeleccionada] = useState(null);
  const [importarOpen, setImportarOpen] = useState(false);
  const [nuevaOTOpen, setNuevaOTOpen] = useState(false);
  const [nuevaCotizacionOpen, setNuevaCotizacionOpen] = useState(false);
  const [otsPorCot, setOtsPorCot] = useState(new Map());
  const [otsSinCotizacion, setOtsSinCotizacion] = useState([]);
  const [ocPorCot, setOcPorCot] = useState(new Map());
  const [ocPorNumDoc, setOcPorNumDoc] = useState(new Map());
  const [facturaPorNumDoc, setFacturaPorNumDoc] = useState(new Map());
  const [sortBy, setSortBy] = useState("numeroOT");
  const [vista, setVista] = useState("pendientes");

  const buildOtsMap = (ots) => {
    const m = new Map();
    ots.forEach((o) => {
      // Las OT sin cotización se indexan por su propio _id (son su propia fila).
      const id = o.cotizacion?._id || o._id;
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(o);
    });
    return m;
  };

  const buildOcMap = (ocs) => {
    const m = new Map();
    ocs.forEach((oc) => {
      const id = oc.cotizacion?._id || oc.cotizacion;
      if (id && !m.has(id)) m.set(id, oc);
    });
    return m;
  };

  const buildOcPorNumDoc = (ocs) => {
    const m = new Map();
    ocs.forEach((oc) => {
      if (oc.numeroDocumento != null) m.set(oc.numeroDocumento, oc);
    });
    return m;
  };

  const cargar = () =>
    Promise.all([
      fetchAuth("/cotizaciones").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then((r) => r.ok ? r.json() : []),
      fetchAuth("/facturas").then((r) => r.ok ? r.json() : []),
    ]).then(([cots, ots, ocs, facts]) => {
      setCotizaciones(cots);
      setOtsSinCotizacion(ots.filter((o) => !o.cotizacion));
      setOtsPorCot(buildOtsMap(ots));
      setOcPorCot(buildOcMap(ocs));
      setOcPorNumDoc(buildOcPorNumDoc(ocs));
      // Una cotización está "facturada" si su cadena (mismo numeroDocumento)
      // tiene una factura con número de factura.
      setFacturaPorNumDoc(new Map(
        facts.filter((f) => f.numeroFactura && f.numeroDocumento != null)
             .map((f) => [f.numeroDocumento, f.numeroFactura])
      ));
    });

  useEffect(() => { cargar(); }, []);

  // Las OT creadas sin cotización (flujo directo) se muestran como filas propias,
  // marcadas con `_esOT`, para que también aparezcan en esta vista.
  const pseudoDeOT = (ot) => ({
    _id: ot._id,
    _esOT: true,
    _ot: ot,
    numeroCotizacion: "",
    fecha: ot.fechaRecibida || ot.createdAt,
    fechaRecibida: ot.fechaRecibida,
    empresa: ot.empresa,
    planta: ot.planta,
    encargado: ot.encargado,
    titulo: ot.titulo,
    subtotal: ot.subtotal,
    total: ot.total,
    numeroDocumento: ot.numeroDocumento,
    estadoCadena: ot.estadoCadena,
    anulado: ot.anulado,
    motivoAnulacion: ot.motivoAnulacion,
    createdAt: ot.createdAt,
  });

  const filas = [...cotizaciones, ...otsSinCotizacion.map(pseudoDeOT)];

  const anos = [...new Set(filas.map((c) => new Date(c.fecha).getFullYear()))].sort(
    (a, b) => b - a
  );

  const empresasLista = [
    ...new Map(
      filas.filter((c) => c.empresa?._id).map((c) => [c.empresa._id, c.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [...new Set(
    (filtros.empresa ? filas.filter((c) => c.empresa?._id === filtros.empresa) : filas)
      .map((c) => c.planta)
      .filter(Boolean)
  )].sort();

  const handleFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const handleEmpresa = (e) => setFiltros({ ...filtros, empresa: e.target.value, planta: "" });

  const tieneOC = (c) =>
    ocPorCot.has(c._id) || (c.numeroDocumento != null && ocPorNumDoc.has(c.numeroDocumento));

  const filtradas = filas.filter((c) => {
    const fecha = new Date(c.fecha);
    const q = filtros.busqueda.toLowerCase();
    return (
      (!filtros.empresa || c.empresa?._id === filtros.empresa) &&
      (!filtros.planta || c.planta === filtros.planta) &&
      (!filtros.ano || fecha.getFullYear() === parseInt(filtros.ano)) &&
      (!filtros.mes || fecha.getMonth() + 1 === parseInt(filtros.mes)) &&
      (!filtros.oc  || (filtros.oc === "con" ? tieneOC(c) : !tieneOC(c))) &&
      (!q ||
        c.titulo?.toLowerCase().includes(q) ||
        c.numeroCotizacion?.toLowerCase().includes(q) ||
        numerosOT(otsPorCot.get(c._id))?.toLowerCase().includes(q) ||
        (ocPorCot.get(c._id)?.numeroOrden || ocPorNumDoc.get(c.numeroDocumento)?.numeroOrden)?.toLowerCase().includes(q) ||
        facturaPorNumDoc.get(c.numeroDocumento)?.toLowerCase().includes(q) ||
        c.empresa?.razonSocial?.toLowerCase().includes(q) ||
        c.empresa?.ruc?.includes(q))
    );
  });

  const primerNumeroOT = (c) => {
    const ots = otsPorCot.get(c._id);
    return ots?.map((o) => o.numeroOT).find(Boolean) || "";
  };
  filtradas.sort((a, b) => {
    if (sortBy === "numeroCotizacion") return compararTexto(a.numeroCotizacion, b.numeroCotizacion);
    if (sortBy === "fecha") return new Date(b.createdAt) - new Date(a.createdAt);
    return compararTexto(primerNumeroOT(a), primerNumeroOT(b));
  });

  const esCerrada = (c) => c.estadoCadena === "cerrado";
  const cerradas = filtradas.filter((c) => esCerrada(c));
  const pendientes = filtradas.filter((c) => !esCerrada(c) && !tieneOC(c));
  const conOC = filtradas.filter((c) => !esCerrada(c) && tieneOC(c));
  // Cotizaciones (no pseudo-filas de OT) sin ninguna OT relacionada.
  const sinOT = filtradas.filter((c) => !c._esOT && !otsPorCot.get(c._id)?.length);
  const hayFiltro = Object.values(filtros).some(Boolean);
  // Si hay una búsqueda de texto activa, no dejar que el selector de "vista"
  // esconda una tabla donde SÍ cae el resultado (ej. buscar un N° OT que
  // pertenece a una cotización "con OC" mientras la vista activa es
  // "Pendientes") — las otras 3 páginas de lista siempre muestran todas sus
  // categorías a la vez, así que en búsqueda esta página se comporta igual.
  const vistaEfectiva = filtros.busqueda ? "todas" : vista;

  // Misma columnas que TablaCotizaciones — una hoja por cada tabla visible.
  const filaCotizacion = (c) => ({
    "N° OT":           numerosOT(otsPorCot.get(c._id)) || "—",
    "N° Cotización":   c._esOT ? "Sin cotización" : (c.numeroCotizacion || "—"),
    "Fecha recibida":  c.fechaRecibida ? new Date(c.fechaRecibida).toLocaleDateString("es-PE") : "—",
    "Empresa":         c.empresa?.razonSocial || "—",
    "Planta":          c.planta || "—",
    "Encargado":       c.encargado || "—",
    "Descripción":     c.titulo,
    "Total sin IGV":   Number(c.subtotal || Number(c.total) / 1.18).toFixed(2),
  });

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    [
      ["Pendientes", pendientes],
      ["Con OC", conOC],
      ["Cerradas", cerradas],
      ["Sin OT", sinOT],
    ].forEach(([nombre, lista]) => {
      const ws = XLSX.utils.json_to_sheet(lista.map(filaCotizacion));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    XLSX.writeFile(wb, "cotizaciones.xlsx");
  };

  const seleccionarFila = (c) =>
    setSeleccionada(c._esOT ? { tipo: "ot", data: c._ot } : { tipo: "cotizacion", data: c });

  const SELECT =
    "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";

  return (
    <>
    <div className="p-6 ">
      <div className="d-flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Cotizaciones</h2>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Exportar Excel
          </button>
          <button
            onClick={() => setNuevaOTOpen(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
          >
            + Crear Orden de Trabajo
          </button>
          <button
            onClick={() => setNuevaCotizacionOpen(true)}
            className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-sky-700 transition"
          >
            + Nueva Cotización
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

        <select value={vista} onChange={(e) => setVista(e.target.value)} className={SELECT}>
          {VISTAS.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
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

        <button
          onClick={() => { setFiltros(FILTROS_VACIO); setVista("todas"); }}
          className="text-sm text-gray-400 hover:text-gray-700 transition"
        >
          Limpiar
        </button>
      </div>

      {(vistaEfectiva === "todas" || vistaEfectiva === "sinOT") && (
        <TablaCotizaciones
          titulo="Cotizaciones sin OT"
          acento="bg-indigo-500"
          cotizaciones={sinOT}
          otsPorCot={otsPorCot}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Todas las cotizaciones ya tienen OT"}
        />
      )}

      {(vistaEfectiva === "todas" || vistaEfectiva === "pendientes") && (
        <TablaCotizaciones
          titulo="Cotizaciones pendientes de OC"
          acento="bg-amber-500"
          cotizaciones={pendientes}
          otsPorCot={otsPorCot}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones pendientes"}
        />
      )}

      {(vistaEfectiva === "todas" || vistaEfectiva === "conOC") && (
        <TablaCotizaciones
          titulo="Cotización con OC"
          acento="bg-emerald-500"
          cotizaciones={conOC}
          otsPorCot={otsPorCot}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones con OC"}
        />
      )}

      {(vistaEfectiva === "todas" || vistaEfectiva === "cerradas") && (
        <TablaCotizaciones
          titulo="Cotizaciones cerradas"
          acento="bg-gray-500"
          cotizaciones={cerradas}
          otsPorCot={otsPorCot}
          onSelect={seleccionarFila}
          vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin cotizaciones cerradas"}
        />
      )}
    </div>

    {importarOpen && (
      <ModalImportarExcel
        tipo="Cotización + Orden de Trabajo"
        columnas={COLS_COT_OT}
        endpoint="/cadena/importar-cotizacion-ot"
        color="blue"
        onClose={() => setImportarOpen(false)}
        onImportado={cargar}
      />
    )}

    {nuevaOTOpen && (
      <ModalNuevaOT
        onClose={() => setNuevaOTOpen(false)}
        onCreada={() => navigate("/ordenes-trabajo")}
      />
    )}

    {nuevaCotizacionOpen && (
      <ModalNuevaCotizacion
        onClose={() => setNuevaCotizacionOpen(false)}
        onCreada={() => { setNuevaCotizacionOpen(false); cargar(); }}
      />
    )}

    {seleccionada && (
      <DetalleDocumento
        tipo={seleccionada.tipo}
        data={seleccionada.data}
        onClose={() => { setSeleccionada(null); cargar(); }}
        onGuardadaCotizacion={(actualizada) => {
          setCotizaciones((prev) =>
            prev.map((c) => (c._id === actualizada._id ? actualizada : c))
          );
        }}
        onGuardadaOT={(actualizada) => {
          setOtsSinCotizacion((prev) =>
            prev.map((o) => (o._id === actualizada._id ? actualizada : o))
          );
        }}
      />
    )}
    </>
  );
}

