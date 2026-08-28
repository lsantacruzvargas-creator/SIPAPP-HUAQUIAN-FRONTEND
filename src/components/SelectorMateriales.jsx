import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";

const badgeStock = (m) => {
  if (m.stock <= 0) return "bg-red-100 text-red-700";
  if (m.stock <= m.stockMinimo) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
};

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Buscador de materiales con stock + ubicación — usado tanto para armar un
// Requerimiento (técnico busca stock existente) como para vincular un SKU
// nuevo a una solicitud de compra (almacenero). Búsqueda server-side (con
// ~9000 materiales, traer la colección completa al abrir el modal era el
// cuello de botella — ver GET /materiales?page=&q= en materiales.js).
export default function SelectorMateriales({ onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const qDebounced = useDebounce(q);

  useEffect(() => {
    const texto = qDebounced.trim();
    if (!texto) { setResultados([]); return; }
    setCargando(true);
    fetchAuth(`/materiales?page=1&limit=50&q=${encodeURIComponent(texto)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setResultados(data?.items || []))
      .finally(() => setCargando(false));
  }, [qDebounced]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800">Buscar material</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="px-4 pt-4">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, código o ubicación…" className={INP} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {!q.trim() ? (
            <p className="text-sm text-gray-400 text-center py-8">Escribe para buscar…</p>
          ) : cargando ? (
            <p className="text-sm text-gray-400 text-center py-8">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
          ) : (
            resultados.map((m) => (
              <button key={m._id} onClick={() => onSelect(m)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-mono text-xs text-blue-600">{m.sku}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStock(m)}`}>
                    {m.stock} {m.unidad}
                  </span>
                </div>
                <p className="text-sm text-gray-700 truncate">{m.nombre}</p>
                {m.ubicacion?.nombre && <p className="text-xs text-gray-400">{m.ubicacion.nombre}</p>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
