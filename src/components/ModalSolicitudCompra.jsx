import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";

// Categoría "Otros" — catch-all de texto libre, no vive en la BD (así el
// almacenero no puede borrarla por accidente y no hace falta protegerla).
const OTROS = { _id: "otros", nombre: "Otros", campos: [] };

// Arma un ítem de "solicitud de compra" para el Requerimiento: cuando el
// técnico no encuentra un SKU en SelectorMateriales, describe lo que necesita
// según la categoría (campos dinámicos administrados por el almacenero).
export default function ModalSolicitudCompra({ onAgregar, onClose }) {
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [valores, setValores] = useState({});
  const [descripcionOtros, setDescripcionOtros] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuth("/categorias-material").then((r) => r.ok && r.json()).then((d) => setCategorias(d || []));
  }, []);

  const categoria = categoriaId === "otros" ? OTROS : categorias.find((c) => c._id === categoriaId);

  const handleValor = (clave, v) => setValores((prev) => ({ ...prev, [clave]: v }));

  const agregar = () => {
    if (!categoria) { setError("Selecciona una categoría"); return; }
    if (!cantidad || cantidad <= 0) { setError("Ingresa la cantidad"); return; }
    if (categoria._id === "otros") {
      if (!descripcionOtros.trim()) { setError("Describe el material"); return; }
    } else {
      for (const campo of categoria.campos) {
        if (campo.requerido && !valores[campo.clave]) {
          setError(`Falta el campo "${campo.nombre}"`);
          return;
        }
      }
    }
    onAgregar({
      esSolicitudCompra: true,
      cantidad: Number(cantidad),
      categoriaMaterial: categoria._id === "otros" ? null : categoria._id,
      categoriaNombre: categoria.nombre,
      camposCompra: categoria._id === "otros" ? { descripcion: descripcionOtros.trim() } : valores,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800">Solicitud de compra</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Categoría *</label>
            <select value={categoriaId}
              onChange={(e) => { setCategoriaId(e.target.value); setValores({}); setError(""); }}
              className={INP}>
              <option value="">Seleccionar…</option>
              {categorias.map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}
              <option value="otros">Otros</option>
            </select>
          </div>

          {categoria?._id === "otros" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción *</label>
              <textarea value={descripcionOtros} onChange={(e) => setDescripcionOtros(e.target.value)}
                className={INP} rows={3} placeholder="Describe el material que necesitas" />
            </div>
          )}

          {categoria && categoria._id !== "otros" && categoria.campos.map((campo) => (
            <div key={campo.clave}>
              <label className="text-xs text-gray-500 block mb-1">{campo.nombre}{campo.requerido && " *"}</label>
              {campo.tipo === "select" ? (
                <select value={valores[campo.clave] || ""} onChange={(e) => handleValor(campo.clave, e.target.value)} className={INP}>
                  <option value="">Seleccionar…</option>
                  {campo.opciones.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              ) : (
                <input type={campo.tipo === "numero" ? "number" : "text"}
                  value={valores[campo.clave] || ""} onChange={(e) => handleValor(campo.clave, e.target.value)} className={INP} />
              )}
            </div>
          ))}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Cantidad *</label>
            <input type="number" min={0.01} step="any" value={cantidad}
              onChange={(e) => setCantidad(e.target.value)} className={INP} />
          </div>
        </div>
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={agregar} className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
