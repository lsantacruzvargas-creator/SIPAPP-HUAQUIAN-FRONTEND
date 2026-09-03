import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";

const ROLES_VEN = ["admin", "jefatura"];
// El espacio libre en disco no cambia segundo a segundo — 5 min alcanza de
// sobra para avisar a tiempo sin pegarle a GET /sistema/disco sin necesidad.
const INTERVALO_MS = 5 * 60 * 1000;

// Banner fijo (no la campana de notificaciones, que solo la ve quien la abre
// a propósito) que avisa cuando el disco del servidor está por debajo del
// umbral configurado (ver Backend/src/routes/sistema.js) — solo admin/
// jefatura, a pedido explícito del usuario.
export default function AlertaDiscoLleno() {
  const puedeVer = ROLES_VEN.includes(getUsuario()?.rol);
  const [info, setInfo] = useState(null);
  const [descartada, setDescartada] = useState(false);

  useEffect(() => {
    if (!puedeVer) return;
    const cargar = () => {
      fetchAuth("/sistema/disco").then((r) => r.ok && r.json()).then((data) => data && setInfo(data));
    };
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [puedeVer]);

  if (!puedeVer || !info?.critico || descartada) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4">
      <div className="bg-red-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-start gap-3">
        <span className="text-lg leading-none">⚠</span>
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-semibold">Espacio en disco crítico</p>
          <p className="text-white/90 mt-0.5">
            Quedan {info.libreGB} GB libres ({info.porcentajeLibre}%) — por debajo del umbral de {info.umbralGB} GB.
            Libera espacio pronto para evitar fallos al guardar fotos, archivos o la base de datos.
          </p>
        </div>
        <button onClick={() => setDescartada(true)} aria-label="Cerrar"
          className="text-white/70 hover:text-white text-lg leading-none shrink-0">
          ✕
        </button>
      </div>
    </div>
  );
}
