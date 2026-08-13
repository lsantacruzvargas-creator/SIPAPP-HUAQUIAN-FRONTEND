import { useState } from "react";
import ModalEmpresa from "./ModalEmpresa";

// Panel para elegir/editar/crear empresas sin abandonar el modal padre (Nueva
// OT, Detalle de OT, etc.) — clic en una fila selecciona esa empresa en el
// formulario que lo abrió; "Editar" o "+ Nueva" abren ModalEmpresa apilado
// encima. z-index por encima de cualquier modal padre conocido (máx. z-[70]).
export default function SelectorEmpresas({ empresas, onClose, onSeleccionar, onCambio }) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // empresa | "nueva" | null

  const q = busqueda.trim().toLowerCase();
  const filtradas = !q
    ? empresas
    : empresas.filter((e) =>
        [e.razonSocial, e.alias, e.ruc].some((v) => v?.toLowerCase().includes(q))
      );

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="font-semibold text-gray-800">Empresas</h4>
              <p className="text-xs text-gray-500 mt-0.5">Busca, edita o crea una empresa sin perder lo que ya llenaste</p>
            </div>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0">✕</button>
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por razón social, alias o RUC…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button type="button" onClick={() => setEditando("nueva")}
              className="shrink-0 text-sm bg-sky-600 text-white px-4 rounded-lg hover:bg-sky-700 transition">
              + Nueva
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtradas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              {empresas.length === 0 ? "No hay empresas registradas." : `Sin resultados para “${busqueda}”.`}
            </p>
          ) : (
            filtradas.map((e) => (
              <div key={e._id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <button
                  type="button"
                  onClick={() => onSeleccionar?.(e)}
                  disabled={!onSeleccionar}
                  className="flex-1 min-w-0 text-left py-1.5 disabled:cursor-default"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                  </p>
                  <p className="text-xs text-gray-400">{e.ruc}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(e)}
                  className="shrink-0 text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
                >
                  Editar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {editando && (
        <ModalEmpresa
          empresa={editando === "nueva" ? null : editando}
          onClose={() => setEditando(null)}
          onGuardada={(guardada) => {
            const esNueva = editando === "nueva";
            setEditando(null);
            onCambio?.(guardada, { esNueva });
          }}
        />
      )}
    </div>
  );
}
