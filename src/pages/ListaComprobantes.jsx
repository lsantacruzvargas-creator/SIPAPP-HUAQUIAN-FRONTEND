import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import {
  TIPO_DOC_CPE,
  ESTADO_COMPROBANTE,
  estadoComprobanteClase,
} from "../utils/catalogosSunat";
import { generarComprobantePdf } from "../utils/comprobantePdf";

const FILTROS_VACIO = { tipoDoc: "", estado: "", desde: "", hasta: "", receptorDoc: "" };
const SELECT = "input-field w-auto";

const TIPO_DOC_CLASE = {
  "01": "bg-blue-100 text-blue-700",
  "03": "bg-purple-100 text-purple-700",
  "07": "bg-amber-100 text-amber-700",
  "08": "bg-rose-100 text-rose-700",
};

const tipoDocTexto = (v) => TIPO_DOC_CPE.find((t) => t.valor === v)?.label.split(" — ")[1] ?? v;

export default function ListaComprobantes() {
  const navigate = useNavigate();
  const [comprobantes, setComprobantes] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIO);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIO);
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState({ total: 0, pages: 1 });
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState("");

  const cargar = async () => {
    setCargando(true);
    const params = new URLSearchParams();
    Object.entries(filtrosAplicados).forEach(([k, v]) => v && params.set(k, v));
    params.set("page", pagina);
    params.set("limit", 20);
    const res  = await fetchAuth(`/cpe?${params.toString()}`);
    const data = await res.json();
    if (data.ok) { setComprobantes(data.data); setPaginacion(data.pagination); }
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
    const res = await fetchAuth(`/cpe/${seleccionado._id}/${tipo}`);
    if (!res.ok) { setErrorDescarga(`${tipo.toUpperCase()} no disponible para este comprobante.`); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    // El nombre y la extensión real (.xml o .zip) los decide el backend según el contenido —
    // SmartPSE no siempre envuelve el XML firmado en un ZIP.
    const cd     = res.headers.get("Content-Disposition") || "";
    const nombre = cd.match(/filename="([^"]+)"/)?.[1] || seleccionado.nombreArchivo;
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-semibold text-ink">Comprobantes SUNAT</h2>
          <span className="text-sm text-ink-muted">{paginacion.total} comprobante{paginacion.total !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-surface rounded-xl border border-line shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
        <select name="tipoDoc" value={filtros.tipoDoc} onChange={handleFiltro} className={SELECT}>
          <option value="">Todo tipo</option>
          {TIPO_DOC_CPE.map((t) => (
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
        <input
          name="receptorDoc"
          value={filtros.receptorDoc}
          onChange={handleFiltro}
          placeholder="Doc. del receptor…"
          className={`${SELECT} flex-1 min-w-40`}
        />
        <button onClick={buscar} className="btn-primary">Buscar</button>
        <button onClick={limpiar} className="text-sm text-ink-muted hover:text-ink transition">Limpiar</button>
      </div>

      {/* Tabla */}
      <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="erp-table w-full text-sm min-w-[700px]">
          <thead className="bg-surface-alt text-xs uppercase tracking-wide border-b-2 border-line">
            <tr>
              <th className="px-4 py-3 text-left">Serie-Correlativo</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-left">Receptor</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Emisión</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">Cargando…</td></tr>
            ) : comprobantes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">Sin comprobantes para los filtros aplicados</td></tr>
            ) : (
              comprobantes.map((c) => (
                <tr key={c._id} className="hover:bg-surface-alt cursor-pointer transition-colors" onClick={() => setSeleccionado(c)}>
                  <td className="px-4 py-3 font-mono text-xs">{c.serie}-{String(c.correlativo).padStart(4, "0")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_DOC_CLASE[c.tipoDoc] ?? "bg-gray-100 text-gray-700"}`}>
                      {tipoDocTexto(c.tipoDoc)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">{c.receptor?.nombre || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{c.totales?.totalPagar?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-ink-soft">{new Date(c.fechaEmision).toLocaleDateString("es-PE")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoComprobanteClase(c.estado)}`}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        {paginacion.pages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-line text-sm">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="text-ink-soft hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ← Anterior
            </button>
            <span className="text-ink-muted">Página {pagina} de {paginacion.pages}</span>
            <button
              onClick={() => setPagina((p) => Math.min(paginacion.pages, p + 1))}
              disabled={pagina >= paginacion.pages}
              className="text-ink-soft hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {seleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-ink">
                  {tipoDocTexto(seleccionado.tipoDoc)} {seleccionado.serie}-{String(seleccionado.correlativo).padStart(4, "0")}
                </h3>
                <span className="font-mono text-xs text-ink-muted">{seleccionado.nombreArchivo}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoComprobanteClase(seleccionado.estado)}`}>
                {seleccionado.estado}
              </span>
            </div>

            {(seleccionado.estado === "RECHAZADO" || seleccionado.estado === "ERROR") && seleccionado.sunat?.mensaje && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 whitespace-pre-wrap">
                {seleccionado.sunat.mensaje}
              </div>
            )}
            {errorDescarga && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-2 mb-4">
                {errorDescarga}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-medium text-ink-muted mb-1">Emisor</p>
                <p className="text-sm text-ink">{seleccionado.emisor?.nombre}</p>
                <p className="text-xs text-ink-muted">{seleccionado.emisor?.numDoc}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted mb-1">Receptor</p>
                <p className="text-sm text-ink">{seleccionado.receptor?.nombre}</p>
                <p className="text-xs text-ink-muted">{seleccionado.receptor?.numDoc}</p>
              </div>
            </div>

            {(seleccionado.tipoDoc === "07" || seleccionado.tipoDoc === "08") && seleccionado.referencia && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs font-medium text-amber-700 mb-1">Documento afectado</p>
                <p className="text-sm text-ink">{seleccionado.referencia.docId}</p>
                <p className="text-xs text-ink-muted mt-1">
                  Motivo {seleccionado.referencia.motivoCodigo}: {seleccionado.referencia.motivoDesc}
                </p>
              </div>
            )}

            <table className="erp-table w-full text-sm mb-4">
              <thead className="bg-surface-alt text-xs uppercase tracking-wide border-b-2 border-line">
                <tr>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2 text-right">P. Unit.</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seleccionado.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{it.descripcion}</td>
                    <td className="px-3 py-2 text-right">{it.cantidad} {it.unidad}</td>
                    <td className="px-3 py-2 text-right">{Number(it.precioUnitario).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">{Number(it.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-surface-alt">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-xs text-ink-soft">Base imponible</td>
                  <td className="px-3 py-2 text-right font-medium">{seleccionado.totales?.baseImponible?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-xs text-ink-soft">IGV</td>
                  <td className="px-3 py-2 text-right font-medium">{seleccionado.totales?.totalIGV?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-ink">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-ink">{seleccionado.totales?.totalPagar?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="flex justify-end gap-3 pt-2">
              {seleccionado.estado === "ACEPTADO" && (seleccionado.tipoDoc === "01" || seleccionado.tipoDoc === "03") && (
                <button
                  onClick={() => navigate("/facturacion-electronica/emitir", { state: { comprobante: seleccionado } })}
                  className="border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-sm hover:bg-amber-50 transition"
                >
                  Emitir Nota de Crédito/Débito
                </button>
              )}
              <button onClick={() => descargar("cdr")} className="border border-line-strong text-ink px-4 py-2 rounded-lg text-sm hover:bg-surface-alt transition">
                Descargar CDR
              </button>
              <button onClick={() => descargar("xml")} className="border border-line-strong text-ink px-4 py-2 rounded-lg text-sm hover:bg-surface-alt transition">
                Descargar XML
              </button>
              <button onClick={() => generarComprobantePdf(seleccionado)} className="border border-line-strong text-ink px-4 py-2 rounded-lg text-sm hover:bg-surface-alt transition">
                Descargar PDF
              </button>
              <button onClick={() => { setSeleccionado(null); setErrorDescarga(""); }} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
