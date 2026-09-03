// Confirmación propia (NO window.confirm) — en la app de Electron, el
// diálogo nativo de window.confirm() puede dejar la ventana sin foco de
// teclado/mouse al cerrarse (bug conocido de Electron con BrowserWindow: la
// devolución de foco a los webContents tras un diálogo nativo no siempre
// ocurre), congelando el formulario hasta que algún otro evento del SO le
// devuelve el foco — reportado en Ingreso/Egreso de Almacén, solo dentro de
// la app de escritorio, nunca en el navegador normal. Este panel vive dentro
// de la misma página, sin esa capa nativa. z-[200]: por encima de cualquier
// modal/selector conocido de la app (el más alto hoy es z-[100]).
export default function ConfirmacionAccion({ mensaje, onCancelar, onConfirmar, procesando, textoConfirmar = "Confirmar" }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <p className="text-sm text-gray-700 mb-6">{mensaje}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancelar} disabled={procesando}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirmar} disabled={procesando}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-50">
            {procesando ? "Guardando…" : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
