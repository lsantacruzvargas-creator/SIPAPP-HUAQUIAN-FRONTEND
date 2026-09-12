import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import TablaScroll from "../components/TablaScroll";
import ModalDetalleGuia from "../components/ModalDetalleGuia";
import {
  TIPO_GUIA,
  ESTADO_COMPROBANTE,
  estadoComprobanteClase,
} from "../utils/catalogosSunat";

const FILTROS_VACIO = { tipoGuia: "", estado: "", desde: "", hasta: "" };
const SELECT = "input-field w-auto";

export default function ListaGuias() {
  const navigate = useNavigate();
  const [guias, setGuias] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIO);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIO);
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState({ total: 0, pages: 1 });
  const [seleccionada, setSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(false);

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
        <ModalDetalleGuia guia={seleccionada} onClose={() => setSeleccionada(null)} onActualizada={cargar} />
      )}
    </div>
  );
}
