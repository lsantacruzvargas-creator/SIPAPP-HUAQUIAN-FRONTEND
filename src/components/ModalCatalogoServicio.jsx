import { useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 w-full";

export default function ModalCatalogoServicio({ grupoServicio, onClose, onGuardado }) {
  const esEdicion = !!grupoServicio;
  const [form, setForm] = useState({
    grupo: grupoServicio?.grupo ?? "",
    items: grupoServicio?.items?.length ? [...grupoServicio.items] : [""],
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const setItem = (i, valor) =>
    setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? valor : it)) }));
  const agregarItem = () => setForm((f) => ({ ...f, items: [...f.items, ""] }));
  const quitarItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const guardar = async () => {
    if (!form.grupo.trim()) { setError("El nombre del grupo es obligatorio."); return; }
    const items = form.items.map((it) => it.trim()).filter(Boolean);
    if (items.length === 0) { setError("Agrega al menos un ítem."); return; }
    setError("");
    setGuardando(true);
    const res = await fetchAuth(
      esEdicion ? `/catalogo-servicios/${grupoServicio._id}` : "/catalogo-servicios",
      {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: form.grupo.trim(), items }),
      }
    );
    if (res.ok) {
      onGuardado(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.mensaje ?? "Error al guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-800">
            {esEdicion ? "Editar grupo de servicios" : "Nuevo grupo de servicios"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre del grupo</label>
            <input
              value={form.grupo}
              onChange={(e) => setForm((f) => ({ ...f, grupo: e.target.value }))}
              className={INP}
              placeholder="Ej. Mantenimiento del Estator"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Ítems del grupo</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={item}
                    onChange={(e) => setItem(i, e.target.value)}
                    className={INP}
                    placeholder={`Ítem ${i + 1}`}
                  />
                  <button type="button" onClick={() => quitarItem(i)}
                    className="text-red-300 hover:text-red-500 shrink-0">✕</button>
                </div>
              ))}
              <button type="button" onClick={agregarItem}
                className="text-xs text-gray-400 hover:text-amber-600 transition">+ agregar ítem</button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}
