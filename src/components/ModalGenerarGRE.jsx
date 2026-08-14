import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Solo se usa cuando la OT padre tiene sub-OTs — deja elegir cuáles van en
// esta GRE (permite envíos parciales: no todas las sub-OTs salen a la vez).
// Con una sola OT (sin hijas) no hace falta este paso — DetalleOrdenTrabajo.jsx
// navega directo a EmitirGuia con un solo ítem prellenado.
export default function ModalGenerarGRE({ ot, subOTs, onClose }) {
  const navigate = useNavigate();
  const [seleccionados, setSeleccionados] = useState(() => new Set(subOTs.map((s) => s._id)));

  const toggle = (id) => setSeleccionados((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const generar = () => {
    const elegidas = subOTs.filter((s) => seleccionados.has(s._id));
    navigate("/facturacion-electronica/guias/emitir", {
      state: {
        prellenarGRE: {
          items: elegidas.map((s) => ({ descripcion: s.titulo, cantidad: 1, unidad: "NIU" })),
          destinatario: ot.empresa
            ? { schemeID: "6", numDoc: ot.empresa.ruc || "", nombre: ot.empresa.razonSocial || "" }
            : undefined,
          ordenesTrabajo: elegidas.map((s) => s._id),
        },
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800">Generar Guía de Remisión</h3>
            <p className="text-xs text-gray-400 mt-0.5">Elige qué sub-órdenes van en esta GRE</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {subOTs.map((s) => (
            <label key={s._id}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition ${
                seleccionados.has(s._id) ? "border-violet-300 bg-violet-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <input type="checkbox" checked={seleccionados.has(s._id)} onChange={() => toggle(s._id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{s.numeroOT}</p>
                <p className="text-xs text-gray-500 truncate">{s.titulo}</p>
              </div>
              {s.irreparable && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 uppercase shrink-0">
                  Irreparable
                </span>
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button type="button" onClick={generar} disabled={seleccionados.size === 0}
            className="text-sm bg-violet-600 text-white px-5 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition font-medium">
            Continuar con {seleccionados.size} ítem{seleccionados.size !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
