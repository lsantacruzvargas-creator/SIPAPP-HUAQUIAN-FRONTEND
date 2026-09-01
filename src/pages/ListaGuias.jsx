import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import TablaScroll from "../components/TablaScroll";
import {
  TIPO_GUIA,
  MODALIDAD_TRASLADO,
  MOTIVO_TRASLADO,
  ESTADO_COMPROBANTE,
  estadoComprobanteClase,
} from "../utils/catalogosSunat";

const FILTROS_VACIO = { tipoGuia: "", estado: "", desde: "", hasta: "" };
const SELECT = "input-field w-auto";

const labelMotivo = (v) => MOTIVO_TRASLADO.find((m) => m.valor === v)?.label ?? v;
const labelModalidad = (v) => MODALIDAD_TRASLADO.find((m) => m.valor === v)?.label ?? v;

// Un "[404] Resource not found" (código HTTP de 3 dígitos) es un fallo de la consulta del
// ticket, no un rechazo real de SUNAT (esos van con código del catálogo CDR, siempre 4 dígitos)
// — ver Backend/src/utils/sunatConsultaResultado.js. En ese caso "Forzar actualización" sigue
// disponible aunque el estado guardado sea RECHAZADO.
const esFalloDeConsulta = (mensaje) => /^\[[45]\d{2}\]/.test(mensaje || "");

export default function ListaGuias() {
  const navigate = useNavigate();
  const [guias, setGuias] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIO);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIO);
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState({ total: 0, pages: 1 });
  const [seleccionada, setSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState("");
  const [consultando, setConsultando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const params = new URLSearchParams();
    Object.entries(filtrosAplicados).forEach(([k, v]) => v && params.set(k, v));
    params.set("page", pagina);
    params.set("limit", 20);
    const res  = await fetchAuth(`/guias?${params.toString()}`);
    const data = await res.json();
    if (data.ok) { setGuias(data.data); setPaginacion(data.pagination); }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [filtrosAplicados, pagina]);

  const handleFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

  const buscar = () => {
    setFiltrosAplicados(filtros);
    setPagina(1);
  };

  const limpiar = () => {
    setFiltros(FILTROS_VACIO);
    setFiltrosAplicados(FILTROS_VACIO);
    setPagina(1);
  };

  const descargar = async (tipo) => {
    setErrorDescarga("");
    const res = await fetchAuth(`/guias/${seleccionada._id}/${tipo}`);
    if (!res.ok) { setErrorDescarga(`${tipo.toUpperCase()} no disponible para esta guía.`); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    // El nombre y la extensión real (.xml o .zip) los decide el backend según el contenido —
    // SmartPSE no siempre envuelve el XML firmado de la GRE en un ZIP.
    const cd     = res.headers.get("Content-Disposition") || "";
    const nombre = cd.match(/filename="([^"]+)"/)?.[1] || seleccionada.nombreArchivo;
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Reconsulta el estado real en SUNAT (útil para guías EN_PROCESO que SmartPSE dejó con solo
  // ticket) — endpoint ya existente en el backend (GET /api/guias/:id/consultar) que antes no se
  // usaba desde ningún lado del frontend.
  const forzarActualizacion = async () => {
    if (!seleccionada) return;
    setConsultando(true);
    setErrorDescarga("");
    try {
      const res  = await fetchAuth(`/guias/${seleccionada._id}/consultar`);
      const data = await res.json();
      if (!data.ok) { setErrorDescarga(data.error || "No se pudo consultar el estado en SUNAT."); return; }
      await cargar();
      const actualizada = {
        ...seleccionada,
        estado: data.estado,
        sunat: { ...seleccionada.sunat, mensaje: data.mensaje, linkSunat: data.linkSunat },
      };
      setSeleccionada(actualizada);
    } catch {
      setErrorDescarga("Error de conexión al consultar SUNAT.");
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Guías de Remisión SUNAT</h2>
          <span className="text-sm text-gray-400">{paginacion.total} guía{paginacion.total !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/facturacion-electronica")}
            className="text-sm text-blue-600 hover:text-blue-800 underline">
            Ver Comprobantes
          </button>
          <button onClick={() => navigate("/facturacion-electronica/guias/emitir")} className="btn-primary">
            + Emitir Guía
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
        <select name="tipoGuia" value={filtros.tipoGuia} onChange={handleFiltro} className={SELECT}>
          <option value="">Todo tipo</option>
          {TIPO_GUIA.map((t) => (
            <option key={t.valor} value={t.valor}>{t.label}</option>
          ))}
        </select>
        <select name="estado" value={filtros.estado} onChange={handleFiltro} className={SELECT}>
          <option value="">Todo estado</option>
          {ESTADO_COMPROBANTE.map((e) => (
            <option key={e.valor} value={e.valor}>{e.label}</option>
          ))}
        </select>
        <input type="date" name="desde" value={filtros.desde} onChange={handleFiltro} className={SELECT} />
        <input type="date" name="hasta" value={filtros.hasta} onChange={handleFiltro} className={SELECT} />
        <button onClick={buscar} className="btn-primary">Buscar</button>
        <button onClick={limpiar} className="text-sm text-gray-400 hover:text-gray-800 transition">Limpiar</button>
        <button onClick={cargar} disabled={cargando}
          className="ml-auto border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50">
          {cargando ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <TablaScroll className="overflow-x-auto">
        <table className="erp-table w-full text-sm min-w-[1050px]">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Serie-Correlativo</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-left">Destinatario</th>
              <th className="px-4 py-3 text-center">OT</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              <th className="px-4 py-3 text-right">Peso bruto</th>
              <th className="px-4 py-3 text-center">Traslado</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : guias.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin guías para los filtros aplicados</td></tr>
            ) : (
              guias.map((g) => (
                <tr key={g._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSeleccionada(g)}>
                  <td className="px-4 py-3 font-mono text-xs">{g.serie}-{String(g.correlativo).padStart(4, "0")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.tipoGuia === "REMITENTE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {g.tipoGuia === "REMITENTE" ? "Remitente" : "Transportista"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{g.destinatario?.nombre || "—"}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">
                    {g.ordenesTrabajo?.length ? g.ordenesTrabajo.map((o) => o.numeroOT || o.codigo).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {g.items?.length ? g.items.map((it) => it.descripcion).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {g.items?.length ? g.items.map((it) => `${it.cantidad} ${it.unidad || ""}`.trim()).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{g.pesoBrutoTotal != null ? `${g.pesoBrutoTotal} ${g.unidadPeso || "KGM"}` : "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{g.fechaTraslado ? formatearFecha(g.fechaTraslado) : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoComprobanteClase(g.estado)}`}>
                      {g.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </TablaScroll>
        {paginacion.pages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 text-sm">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ← Anterior
            </button>
            <span className="text-gray-400">Página {pagina} de {paginacion.pages}</span>
            <button
              onClick={() => setPagina((p) => Math.min(paginacion.pages, p + 1))}
              disabled={pagina >= paginacion.pages}
              className="text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {seleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-800">
                  Guía {seleccionada.serie}-{String(seleccionada.correlativo).padStart(4, "0")}
                </h3>
                <span className="font-mono text-xs text-gray-400">{seleccionada.nombreArchivo}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoComprobanteClase(seleccionada.estado)}`}>
                {seleccionada.estado}
              </span>
            </div>

            {(seleccionada.estado === "RECHAZADO" || seleccionada.estado === "ERROR") && seleccionada.sunat?.mensaje && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 whitespace-pre-wrap">
                {seleccionada.sunat.mensaje}
              </div>
            )}
            {errorDescarga && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-2 mb-4">
                {errorDescarga}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Emisor</p>
                <p className="text-sm text-gray-800">{seleccionada.emisor?.nombre}</p>
                <p className="text-xs text-gray-400">{seleccionada.emisor?.numDoc}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Destinatario</p>
                <p className="text-sm text-gray-800">{seleccionada.destinatario?.nombre}</p>
                <p className="text-xs text-gray-400">{seleccionada.destinatario?.numDoc}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Motivo de traslado</p>
                <p className="text-sm text-gray-800">{labelMotivo(seleccionada.motivoTraslado)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Modalidad</p>
                <p className="text-sm text-gray-800">{labelModalidad(seleccionada.modalidadTraslado)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Punto de partida</p>
                <p className="text-sm text-gray-800">{seleccionada.puntoPartida?.direccion}</p>
                <p className="text-xs text-gray-400">Ubigeo {seleccionada.puntoPartida?.ubigeo}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">Punto de llegada</p>
                <p className="text-sm text-gray-800">{seleccionada.puntoLlegada?.direccion}</p>
                <p className="text-xs text-gray-400">Ubigeo {seleccionada.puntoLlegada?.ubigeo}</p>
              </div>
              {seleccionada.modalidadTraslado === "02" ? (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Vehículo / Conductor</p>
                  <p className="text-sm text-gray-800">{seleccionada.vehiculo?.placa}</p>
                  <p className="text-xs text-gray-400">
                    {seleccionada.conductor?.nombres} {seleccionada.conductor?.apellidos} — {seleccionada.conductor?.numDoc}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Transportista</p>
                  <p className="text-sm text-gray-800">{seleccionada.transportista?.razonSocial}</p>
                  <p className="text-xs text-gray-400">{seleccionada.transportista?.ruc}</p>
                </div>
              )}
            </div>

            <table className="erp-table w-full text-sm mb-4">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2 text-right">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seleccionada.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{it.descripcion}</td>
                    <td className="px-3 py-2 text-right">{it.cantidad}</td>
                    <td className="px-3 py-2 text-right">{it.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end gap-3 pt-2">
              {(seleccionada.estado === "EN_PROCESO" ||
                (seleccionada.estado === "RECHAZADO" && esFalloDeConsulta(seleccionada.sunat?.mensaje))) && (
                <button onClick={forzarActualizacion} disabled={consultando}
                  className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50">
                  {consultando ? "Consultando SUNAT…" : "↻ Forzar actualización con SUNAT"}
                </button>
              )}
              <button onClick={() => descargar("xml")} className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                Descargar XML
              </button>
              <button onClick={() => descargar("cdr")} className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                Descargar CDR
              </button>
              {seleccionada.sunat?.linkSunat && (
                <a href={seleccionada.sunat.linkSunat} target="_blank" rel="noopener noreferrer"
                  className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                  PDF SUNAT ↗
                </a>
              )}
              <button onClick={() => { setSeleccionada(null); setErrorDescarga(""); }} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
