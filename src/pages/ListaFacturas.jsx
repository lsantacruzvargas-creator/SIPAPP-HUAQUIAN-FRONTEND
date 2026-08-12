import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalCrearFactura  from "../components/ModalCrearFactura";
import ModalImportarExcel, { COLS_FACTURAS } from "../components/ModalImportarExcel";
import { DotChip, badgePago, dotPago } from "../components/detalleShared";
import * as XLSX from "xlsx";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const FILTROS_VACIO = { empresa: "", planta: "", ano: "", mes: "", estadoPago: "", busqueda: "" };

const ESTADOS_PAGO = [
  { valor: "sin pago",     label: "Sin pago",     cls: "bg-red-50 text-red-700" },
  { valor: "pago parcial", label: "Pago parcial", cls: "bg-amber-50 text-amber-700" },
  { valor: "pagado",       label: "Pagado",       cls: "bg-green-50 text-green-700" },
];

function BadgeCancelacion({ fecha, pagado }) {
  if (!fecha) return <span className="text-gray-300 text-xs">—</span>;
  const str = new Date(fecha).toLocaleDateString("es-PE");

  if (pagado) {
    return <span className="inline-flex flex-col items-center"><span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full line-through">Vencimiento</span><span className="text-xs text-gray-300 line-through">{str}</span></span>;
  }

  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fecha); vence.setHours(0, 0, 0, 0);
  const dias  = (vence - hoy) / 86400000;
  if (dias < 0)  return <span className="inline-flex flex-col items-center"><span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Vencida</span><span className="text-xs text-red-400">{str}</span></span>;
  if (dias <= 7) return <span className="inline-flex flex-col items-center"><span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Próx. a vencer</span><span className="text-xs text-amber-500">{str}</span></span>;
  return <span className="text-xs text-gray-500">{str}</span>;
}

const SELECT = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";
const TD_NUM = "px-3 py-3.5 text-right tabular-nums";
const TH     = "px-3 py-3 font-semibold text-gray-500 whitespace-nowrap";

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

function TablaFacturas({ titulo, acento, facturas, onSelect, handlePagoCheck, vacioMsg }) {
  const rolActual = getUsuario()?.rol;
  // Las anuladas siguen visibles en la tabla, pero no cuentan en los totales
  const noAnuladas = facturas.filter(f => !f.anulado);
  const totales = {
    subtotal:    noAnuladas.reduce((s, f) => s + (Number(f.subtotal ?? f.monto)    || 0), 0),
    igv:         noAnuladas.reduce((s, f) => s + (Number(f.igv)                   || 0), 0),
    total:       noAnuladas.reduce((s, f) => s + (Number(f.total)                 || 0), 0),
    detraccion:  noAnuladas.reduce((s, f) => s + (Number(f.detraccion)            || 0), 0),
    totalAPagar: noAnuladas.reduce((s, f) => s + (Number(f.totalAPagar)           || 0), 0),
    pagado:      noAnuladas.reduce((s, f) => s + (Number(f.montoPagado)           || 0), 0),
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({facturas.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "1000px" }}>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
              <tr>
                <th className={`${TH} text-left`}>N° OT</th>
                <th className={`${TH} text-left`}>N° Factura</th>
                <th className={`${TH} text-center`}>Fecha emisión</th>
                <th className={`${TH} text-center`}>Fecha cancelación</th>
                <th className={`${TH} text-left`}>Orden de Compra</th>
                <th className={`${TH} text-left`}>Empresa</th>
                <th className={`${TH} text-right`}>Subtotal (S/)</th>
                <th className={`${TH} text-right`}>IGV 18% (S/)</th>
                <th className={`${TH} text-right`}>Total (S/)</th>
                <th className={`${TH} text-right`}>Detracción 12% (S/)</th>
                <th className={`${TH} text-right`}>Total a pagar (S/)</th>
                <th className={`${TH} text-center`}>Estado pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {facturas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td>
                </tr>
              ) : (
                <>
                {facturas.map(f => (
                  <tr key={f._id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${f.anulado ? "opacity-50" : ""}`}
                    onClick={() => onSelect(f)}>
                    <td className="px-3 py-3.5 text-gray-600 whitespace-nowrap">
                      {f._numeroOT || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {f.numeroFactura || <span className="text-gray-300">—</span>}
                        {f.anulado && (
                          <span title={f.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                            Anulada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center text-gray-500 whitespace-nowrap">
                      {new Date(f.fechaEmision).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <BadgeCancelacion fecha={f.fechaCancelacion} pagado={f.estadoPago === "pagado"} />
                    </td>
                    <td className="px-3 py-3.5 text-gray-600 whitespace-nowrap">
                      {f.ordenCompra?.numeroOrden || f.numeroOrdenCompra || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3.5 text-gray-700">
                      {f.empresa?.razonSocial || <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`${TD_NUM} text-gray-400`}>
                      {Number(f.subtotal ?? f.monto ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`${TD_NUM} text-gray-400`}>
                      {Number(f.igv ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`${TD_NUM} text-gray-600`}>
                      {Number(f.total ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`${TD_NUM} text-gray-400`}>
                      {Number(f.detraccion ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`${TD_NUM} font-bold text-gray-900`}>
                      {Number(f.totalAPagar ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-center gap-1.5 min-w-[110px]">
                        <DotChip chip={badgePago(f.estadoPago)} dot={dotPago(f.estadoPago)}>
                          {f.estadoPago}
                        </DotChip>
                        {(() => {
                          const bloqueada = f.estadoPago === "pagado" && rolActual !== "admin";
                          const disabled = f.anulado || !(Number(f.totalAPagar) > 0) || bloqueada;
                          return (
                            <label className={`flex items-center gap-1.5 text-xs text-gray-500 select-none ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                              title={f.anulado ? "Factura anulada" : !(Number(f.totalAPagar) > 0) ? "Sin monto a pagar" : bloqueada ? "Solo un administrador puede deshacer un pago" : undefined}>
                              <input type="checkbox"
                                checked={f.estadoPago === "pagado"}
                                disabled={disabled}
                                onChange={e => handlePagoCheck(f._id, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400" />
                              Pagado
                            </label>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Fila de totales */}
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-sm">
                  <td colSpan={6} className="px-3 py-3.5 text-right text-xs uppercase tracking-wide text-gray-400">
                    Totales ({facturas.length})
                  </td>
                  <td className={`${TD_NUM} text-gray-500`}>{totales.subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className={`${TD_NUM} text-gray-500`}>{totales.igv.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className={`${TD_NUM} text-gray-700`}>{totales.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className={`${TD_NUM} text-gray-500`}>{totales.detraccion.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className={`${TD_NUM} font-bold text-gray-900`}>{totales.totalAPagar.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-3.5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Cobrado</span>
                      <span className="tabular-nums text-emerald-700 font-bold">{totales.pagado.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </td>
                </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ListaFacturas() {
  const [facturas, setFacturas]       = useState([]);
  const [filtros, setFiltros]         = useState(FILTROS_VACIO);
  const [seleccionada, setSeleccionada] = useState(null);
  const [crearOpen, setCrearOpen]     = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [sortBy, setSortBy]           = useState("fecha");

  const cargar = () =>
    Promise.all([
      fetchAuth("/facturas").then(r => r.ok ? r.json() : []),
      fetchAuth("/cotizaciones").then(r => r.ok ? r.json() : []),
      fetchAuth("/ordenes-trabajo").then(r => r.ok ? r.json() : []),
    ]).then(([facts, cots, ots]) => {
      // La Factura no siempre trae su propia cotizacion/OT pobladas (p.ej.
      // creada por la cadena vía OC) — se resuelven por numeroDocumento
      // compartido, igual que en DetalleFactura.jsx.
      const cotPorNumDoc = new Map(cots.filter(c => c.numeroDocumento != null).map(c => [c.numeroDocumento, c.numeroCotizacion]));
      const otPorNumDoc  = new Map(ots.filter(o => o.numeroDocumento != null).map(o => [o.numeroDocumento, o.numeroOT]));
      const enriquecidas = facts.map(f => ({
        ...f,
        _numeroCotizacion: cotPorNumDoc.get(f.numeroDocumento) || "",
        _numeroOT: otPorNumDoc.get(f.numeroDocumento) || "",
      }));
      setFacturas(enriquecidas);
    });

  useEffect(() => { cargar(); }, []);

  const empresasLista = [
    ...new Map(
      facturas.filter(f => f.empresa?._id).map(f => [f.empresa._id, f.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [...new Set(
    (filtros.empresa ? facturas.filter(f => f.empresa?._id === filtros.empresa) : facturas)
      .map(f => f.planta)
      .filter(Boolean)
  )].sort();

  const anos = [...new Set(
    facturas.map(f => new Date(f.fechaEmision).getFullYear())
  )].sort((a, b) => b - a);

  const handleFiltro = e => setFiltros({ ...filtros, [e.target.name]: e.target.value });
  const handleEmpresa = e => setFiltros({ ...filtros, empresa: e.target.value, planta: "" });

  const filtradas = facturas.filter(f => {
    const fecha = new Date(f.fechaEmision);
    const q     = filtros.busqueda.toLowerCase();
    return (
      (!filtros.empresa    || f.empresa?._id === filtros.empresa) &&
      (!filtros.planta     || f.planta === filtros.planta) &&
      (!filtros.ano        || fecha.getFullYear() === parseInt(filtros.ano)) &&
      (!filtros.mes        || fecha.getMonth() + 1 === parseInt(filtros.mes)) &&
      (!filtros.estadoPago || f.estadoPago === filtros.estadoPago) &&
      (!q ||
        f.numeroFactura?.toLowerCase().includes(q) ||
        (f.ordenCompra?.numeroOrden || f.numeroOrdenCompra || "").toLowerCase().includes(q) ||
        f._numeroOT?.toLowerCase().includes(q) ||
        f._numeroCotizacion?.toLowerCase().includes(q) ||
        f.descripcion?.toLowerCase().includes(q) ||
        f.empresa?.razonSocial?.toLowerCase().includes(q) ||
        f.empresa?.ruc?.includes(q) ||
        f.encargado?.toLowerCase().includes(q) ||
        f.planta?.toLowerCase().includes(q))
    );
  });

  filtradas.sort((a, b) => {
    if (sortBy === "numeroOT") return compararTexto(a._numeroOT, b._numeroOT);
    if (sortBy === "numeroCotizacion") return compararTexto(a._numeroCotizacion, b._numeroCotizacion);
    return new Date(b.fechaEmision) - new Date(a.fechaEmision);
  });

  const handlePagoCheck = async (id, pagada) => {
    const factura = facturas.find(f => f._id === id);
    if (!factura) return;

    if (pagada) {
      if (!window.confirm("¿Confirmas marcar esta factura como pagada?")) return;
    } else if (getUsuario()?.rol !== "admin") {
      alert("Solo un administrador puede deshacer un pago.");
      return;
    }

    const totalAPagar = Number(factura.totalAPagar) || 0;
    const pago = pagada ? totalAPagar : 0;
    const estadoPago = pagada ? "pagado" : "sin pago";
    // Al pagar se cierra toda la cadena (Cotización/OT/Informe/OC/Factura); se
    // refleja de inmediato en memoria, el backend hace lo mismo en la BD.
    const estadoCadena = pagada ? "cerrado" : "abierto";
    const previo = {
      montoPagado: factura.montoPagado,
      estadoPago: factura.estadoPago,
      estadoCadena: factura.estadoCadena,
    };
    setFacturas(prev =>
      prev.map(f => f._id === id ? { ...f, montoPagado: pago, estadoPago, estadoCadena } : f)
    );
    try {
      const res = await fetchAuth(`/facturas/${id}/estado-pago`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montoPagado: pago }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Revertir el cambio optimista para que la UI no mienta si no se guardó
      setFacturas(prev => prev.map(f => f._id === id ? { ...f, ...previo } : f));
      alert("No se pudo guardar el estado de pago. Verifica que el servidor esté disponible e intenta de nuevo.");
    }
  };

  const cerradas = filtradas.filter(f => f.estadoCadena === "cerrado");
  const abiertas = filtradas.filter(f => f.estadoCadena !== "cerrado");
  const hayFiltro = Object.values(filtros).some(Boolean);

  // Mismas columnas que TablaFacturas, agregando Monto pagado (hoy solo visible
  // en el chip de estado de pago).
  const filaFactura = (f) => ({
    "N° OT":             f._numeroOT || "—",
    "N° Factura":        f.numeroFactura || "—",
    "Fecha emisión":     new Date(f.fechaEmision).toLocaleDateString("es-PE"),
    "Fecha cancelación": f.fechaCancelacion ? new Date(f.fechaCancelacion).toLocaleDateString("es-PE") : "—",
    "Orden de Compra":   f.ordenCompra?.numeroOrden || f.numeroOrdenCompra || "—",
    "Empresa":           f.empresa?.razonSocial || "—",
    "Subtotal":          Number(f.subtotal ?? f.monto ?? 0).toFixed(2),
    "IGV 18%":           Number(f.igv ?? 0).toFixed(2),
    "Total":             Number(f.total ?? 0).toFixed(2),
    "Detracción 12%":    Number(f.detraccion ?? 0).toFixed(2),
    "Total a pagar":     Number(f.totalAPagar ?? 0).toFixed(2),
    "Estado pago":       f.estadoPago,
    "Monto pagado":      Number(f.montoPagado ?? 0).toFixed(2),
  });

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    [
      ["Facturas", abiertas],
      ["Facturas cerradas", cerradas],
    ].forEach(([nombre, lista]) => {
      const ws = XLSX.utils.json_to_sheet(lista.map(filaFactura));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    XLSX.writeFile(wb, "facturas.xlsx");
  };

  return (
    <>
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Facturas</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filtradas.length} registro{filtradas.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Exportar Excel
          </button>
          <button onClick={() => setCrearOpen(true)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition font-medium">
            + Nueva Factura
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
        <select name="empresa" value={filtros.empresa} onChange={handleEmpresa} className={SELECT}>
          <option value="">Toda empresa</option>
          {empresasLista.map(e => (
            <option key={e._id} value={e._id}>
              {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
            </option>
          ))}
        </select>
        {plantasLista.length > 0 && (
          <select name="planta" value={filtros.planta} onChange={handleFiltro} className={SELECT}>
            <option value="">Toda planta</option>
            {plantasLista.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select name="ano" value={filtros.ano} onChange={handleFiltro} className={SELECT}>
          <option value="">Todos los años</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="mes" value={filtros.mes} onChange={handleFiltro} className={SELECT}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select name="estadoPago" value={filtros.estadoPago} onChange={handleFiltro} className={SELECT}>
          <option value="">Todos los estados</option>
          {ESTADOS_PAGO.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
        <input name="busqueda" value={filtros.busqueda} onChange={handleFiltro}
          placeholder="Buscar por N° OT, cotización, OC, factura, título, empresa o RUC…"
          className={`${SELECT} flex-1 min-w-52`} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={SELECT}>
          {SORTS.map(({ valor, label }) => (
            <option key={valor} value={valor}>Ordenar: {label}</option>
          ))}
        </select>
        {Object.values(filtros).some(Boolean) && (
          <button onClick={() => setFiltros(FILTROS_VACIO)}
            className="text-sm text-gray-400 hover:text-gray-700 transition">Limpiar</button>
        )}
      </div>

      <TablaFacturas
        titulo="Facturas"
        acento="bg-emerald-500"
        facturas={abiertas}
        onSelect={setSeleccionada}
        handlePagoCheck={handlePagoCheck}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin facturas registradas"}
      />

      <TablaFacturas
        titulo="Facturas cerradas"
        acento="bg-gray-500"
        facturas={cerradas}
        onSelect={setSeleccionada}
        handlePagoCheck={handlePagoCheck}
        vacioMsg={hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin facturas cerradas"}
      />
    </div>

    {crearOpen && (
      <ModalCrearFactura
        onClose={() => setCrearOpen(false)}
        onCreada={(nueva) => { setFacturas(prev => [nueva, ...prev]); setCrearOpen(false); }}
      />
    )}

    {importarOpen && (
      <ModalImportarExcel
        tipo="Facturas"
        columnas={COLS_FACTURAS}
        endpoint="/facturas/importar"
        color="emerald"
        onClose={() => setImportarOpen(false)}
        onImportado={cargar}
      />
    )}

    {seleccionada && (
      <DetalleDocumento
        tipo="factura"
        data={seleccionada}
        onClose={() => { setSeleccionada(null); cargar(); }}
        onGuardadaFactura={(actualizada) => {
          setFacturas(prev => prev.map(f => f._id === actualizada._id ? actualizada : f));
        }}
      />
    )}
    </>
  );
}
