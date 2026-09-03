import { useState } from "react";

// Igual que ConfirmacionAccion pero pide un texto antes de confirmar (motivo
// de anulación/rechazo, etc.) — reemplaza window.prompt() por el mismo
// motivo (ver ConfirmacionAccion.jsx): en Electron, el diálogo nativo puede
// dejar la ventana sin foco de teclado/mouse al cerrarse.
export default function PromptAccion({ titulo, label = "Motivo", placeholder, onCancelar, onConfirmar, procesando, textoConfirmar = "Confirmar" }) {
  const [valor, setValor] = useState("");
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        {titulo && <h3 className="font-semibold text-gray-800 mb-3">{titulo}</h3>}
        <label className="text-xs text-gray-500 block mb-1">{label}</label>
        <textarea
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none mb-6"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancelar} disabled={procesando}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={() => onConfirmar(valor.trim())} disabled={procesando || !valor.trim()}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-50">
            {procesando ? "Guardando…" : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
