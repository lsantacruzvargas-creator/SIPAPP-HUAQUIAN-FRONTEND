// Igual espíritu que ConfirmacionAccion/PromptAccion (ver ConfirmacionAccion.jsx
// para el motivo completo) pero para un aviso de un solo botón — reemplaza
// window.alert().
export default function AvisoAccion({ mensaje, onCerrar }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <p className="text-sm text-gray-700 mb-6">{mensaje}</p>
        <div className="flex justify-end">
          <button onClick={onCerrar}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
