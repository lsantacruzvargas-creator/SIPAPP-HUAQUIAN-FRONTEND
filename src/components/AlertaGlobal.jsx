import { useState, useEffect, useCallback } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";

const ROLES_TECNICOS = ["tecnico", "tecnico_prueba", "tecnico_intervencion"];
const CLAVE_DESCARTADAS = "alertas_descartadas";

const leerDescartadas = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_DESCARTADAS) || "[]"));
  } catch {
    return new Set();
  }
};

const formatoFecha = (fecha) =>
  new Date(fecha).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });

// Alertas destacadas (a diferencia de la campana de PanelNotificaciones,
// estas se muestran siempre en pantalla como banners, sin necesidad de abrir
// nada) — nunca para roles técnicos, ver GET /notificaciones/alertas.
export default function AlertaGlobal() {
  const esTecnico = ROLES_TECNICOS.includes(getUsuario()?.rol);
  const [alertas, setAlertas] = useState([]);
  const [descartadas, setDescartadas] = useState(leerDescartadas);

  const cargar = useCallback(() => {
    fetchAuth("/notificaciones/alertas")
      .then((r) => r.ok && r.json())
      .then((data) => data && setAlertas(data));
  }, []);

  useEffect(() => {
    if (esTecnico) return;
    cargar();
    const intervalo = setInterval(cargar, 60000);
    window.addEventListener("app:cambio-guardado", cargar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("app:cambio-guardado", cargar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esTecnico]);

  if (esTecnico) return null;

  const descartar = (id) => {
    const next = new Set(descartadas);
    next.add(id);
    setDescartadas(next);
    localStorage.setItem(CLAVE_DESCARTADAS, JSON.stringify([...next]));
  };

  const visibles = alertas.filter((a) => !descartadas.has(a._id));
  if (visibles.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-2 pointer-events-none">
      {visibles.map((a) => (
        <div
          key={a._id}
          className="pointer-events-auto bg-white border border-sky-200 border-l-4 border-l-sky-500 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{a.mensaje}</p>
            <p className="text-xs text-gray-400 mt-1">{formatoFecha(a.fecha)}</p>
          </div>
          <button
            onClick={() => descartar(a._id)}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-700 text-lg leading-none shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
