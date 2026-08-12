const formatoFecha = (fecha) =>
  new Date(fecha).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });

export default function PanelNotificaciones({ notificaciones, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[90]"
      onClick={onClose}
    >
      <div
        className="absolute top-16 right-4 sm:right-8 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <h4 className="font-semibold text-gray-800">Notificaciones</h4>
          <p className="text-xs text-gray-500 mt-0.5">Últimos cambios registrados en el sistema</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notificaciones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Sin novedades.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {notificaciones.map((n) => (
                <li key={n._id} className="px-5 py-3">
                  <p className="text-sm text-gray-800">{n.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{n.usuarioNombre} · {formatoFecha(n.fecha)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
