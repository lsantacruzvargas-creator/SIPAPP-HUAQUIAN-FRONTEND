import { useState, useEffect, useCallback } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";
const LIMIT = 50;

const badgeStock = (m) => {
  if (m.stock <= 0) return "bg-red-100 text-red-700";
  if (m.stock <= m.stockMinimo) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
};

// El input se actualiza al instante (escritura fluida); el valor debounced
// es el que realmente dispara la búsqueda al backend, para no mandar una
// request por cada tecla sobre una colección de ~9000 materiales.
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Vista de solo consulta de stock, compartida entre almacenero y técnico —
// a diferencia de Almacén, acá no se puede crear/editar SKUs ni ubicaciones.
// Paginada server-side ("Cargar más") — con ~9000 materiales, traer y
// renderizar la colección completa de una vez (como antes) era el cuello de
// botella real: 5.4MB de payload + ~9000 filas sin paginar en el DOM.
export default function Inventario() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);

  const cargarPagina = useCallback(async (paginaAPedir, reemplazar) => {
    const params = new URLSearchParams({ page: String(paginaAPedir), limit: String(LIMIT) });
    if (busquedaDebounced.trim()) params.set("q", busquedaDebounced.trim());
    const r = await fetchAuth(`/materiales?${params}`);
    if (!r.ok) return;
    const data = await r.json();
    setTotal(data.total);
    setItems((prev) => (reemplazar ? data.items : [...prev, ...data.items]));
    setPage(paginaAPedir);
  }, [busquedaDebounced]);

  // Cambió la búsqueda (debounced) — reinicia desde la página 1 y reemplaza
  // la lista acumulada, en vez de seguir agregando sobre resultados viejos.
  useEffect(() => {
    setCargando(true);
    cargarPagina(1, true).finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaDebounced]);

  const cargarMas = async () => {
    setCargandoMas(true);
    await cargarPagina(page + 1, false);
    setCargandoMas(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Inventario</h1>
        <p className="text-sm text-gray-400 mt-0.5">Consulta de stock disponible por material</p>
      </div>

      <input
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        className={`w-full ${INP}`} placeholder="Buscar por SKU, título o descripción…" />

      {/* Tabla — ancha al 90vw (se sale del contenedor max-w-5xl de la página), columnas con ancho fijo para evitar desborde */}
      <div className="relative left-1/2 -ml-[45vw] w-[90vw] max-w-[90vw] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Título</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo Componente</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ubicación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!cargando && items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-300 text-sm">Sin materiales</td></tr>
            )}
            {items.map((m) => (
              <tr key={m._id} className="hover:bg-gray-50/50 transition align-top">
                <td className="px-3 py-3 font-mono text-xs text-gray-500"><div className="line-clamp-2 break-words">{m.sku}</div></td>
                <td className="px-3 py-3 font-mono text-xs text-gray-500"><div className="line-clamp-2 break-words">{m.codigo || <span className="text-gray-300">—</span>}</div></td>
                <td className="px-3 py-3 font-medium text-gray-800"><div className="line-clamp-2 break-words">{m.nombre}</div></td>
                <td className="px-3 py-3 text-gray-500"><div className="line-clamp-2 break-words">{m.descripcion || <span className="text-gray-300">—</span>}</div></td>
                <td className="px-3 py-3 text-gray-500"><div className="line-clamp-2 break-words">{m.tipoComponente?.nombre || <span className="text-gray-300">—</span>}</div></td>
                <td className="px-3 py-3 text-gray-500"><div className="line-clamp-2 break-words">{m.categoria?.nombre || <span className="text-gray-300">—</span>}</div></td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${badgeStock(m)}`}>
                    {m.stock} {m.unidad}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500"><div className="line-clamp-2 break-words">{m.ubicacion?.nombre || "—"}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-400">
          <span>{cargando ? "Cargando…" : `Mostrando ${items.length} de ${total} resultados`}</span>
          {!cargando && items.length < total && (
            <button
              onClick={cargarMas}
              disabled={cargandoMas}
              className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {cargandoMas ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
