import { TIPOS_INFORME } from "../utils/informesTecnicos";

const ICONOS = {
  bombas: "🔧",
  protocolo_jaula_ardilla: "⚙️",
  bobina_estator_mtto: "🧵",
  bobina_estator_rebo: "🧵",
  tecnico_mantenimiento: "📋",
};

// Primer paso del flujo "+ Crear informe": elegir uno de los 5 tipos antes
// de abrir FormInformeTecnico con las secciones correspondientes.
export default function ModalSeleccionarTipoInforme({ onSeleccionar, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Nuevo Informe Técnico</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-2">
          <p className="text-xs text-gray-500 mb-3">Selecciona el tipo de informe a generar:</p>
          {TIPOS_INFORME.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => onSeleccionar(t.valor)}
              className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition"
            >
              <span className="text-2xl shrink-0">{ICONOS[t.valor] || "📄"}</span>
              <span className="text-sm font-medium text-gray-800">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
