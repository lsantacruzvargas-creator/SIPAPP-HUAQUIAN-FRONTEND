import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

export default function Sistema() {
  const [info, setInfo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = () => {
    fetchAuth("/sistema/disco")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setInfo(data); setError(""); })
      .catch(() => setError("No se pudo obtener el estado del servidor."))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const refrescar = () => { setCargando(true); cargar(); };

  const usadoPct = info ? Math.max(0, Math.min(100, 100 - info.porcentajeLibre)) : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Estado del servidor</h2>
          <p className="text-xs text-gray-400 mt-0.5">Espacio en disco disponible</p>
        </div>
        <button
          onClick={refrescar}
          disabled={cargando}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {info && (
          <>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${info.critico ? "text-red-600" : "text-gray-800"}`}>
                {info.libreGB} GB libres
              </span>
              <span className="text-sm text-gray-400">de {info.totalGB} GB</span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${info.critico ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${usadoPct}%` }}
              />
            </div>

            <p className="text-xs text-gray-400">
              {info.porcentajeLibre}% libre — umbral crítico configurado en {info.umbralGB} GB
            </p>

            {info.critico && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                El espacio libre está por debajo del umbral. Libera espacio pronto para evitar fallos al guardar fotos, archivos o la base de datos.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
