import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Input de búsqueda de material + dropdown de resultados, con fetch propio
// (paginado/buscado server-side vía GET /materiales?page=&q=) — reemplaza el
// patrón repetido de "traer los ~9000 materiales a un array local y
// filtrarlo en el cliente" que antes tenían ModalIngreso/ModalEgreso/
// SeccionMovimientos (ver Almacen.jsx) y SelectorMateriales.jsx.
export default function BuscadorMaterialInline({
  value, onChange, onSelect, placeholder = "Buscar por SKU, nombre o ubicación…",
  mostrarStock = false, autoFocus = false, className = "",
}) {
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const qDebounced = useDebounce(value);

  useEffect(() => {
    const q = qDebounced.trim();
    if (!q) { setResultados([]); return; }
    setCargando(true);
    fetchAuth(`/materiales?page=1&limit=30&q=${encodeURIComponent(q)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setResultados(data?.items || []))
      .finally(() => setCargando(false));
  }, [qDebounced]);

  const seleccionar = (m) => {
    onSelect(m);
    setAbierto(false);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        placeholder={placeholder}
        className={INP}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {abierto && value.trim() && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {cargando ? (
            <p className="px-3 py-2 text-sm text-gray-400">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
          ) : (
            resultados.map((m) => (
              <button type="button" key={m._id}
                onMouseDown={() => seleccionar(m)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition border-b border-gray-50 last:border-0">
                <span className="font-mono text-xs text-blue-600">{m.sku}</span> — {m.nombre}
                {mostrarStock && <span className="text-xs text-gray-400"> (stock: {m.stock} {m.unidad})</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
