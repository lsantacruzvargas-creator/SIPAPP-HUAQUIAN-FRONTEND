import { useState } from "react";

// Picker de 2 pasos para autocompletar destinatario + punto de llegada en
// Emitir Guía: primero busca la empresa por RUC/razón social/alias (mismo
// criterio que SelectorEmpresas.jsx), después elige una de sus plantas con
// ubigeo/dirección guardados (ver Empresa.plantas.ubigeo/direccion,
// ModalEmpresa.jsx). Devuelve la empresa Y la planta elegidas — quien use
// este selector decide qué hacer con cada una (destinatario vs punto de
// llegada).
export default function SelectorDireccionGuardada({ empresas, onClose, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState("");
  const [empresaSel, setEmpresaSel] = useState(null);

  const q = busqueda.trim().toLowerCase();
  const filtradas = !q
    ? empresas
    : empresas.filter((e) => [e.razonSocial, e.alias, e.ruc].some((v) => v?.toLowerCase().includes(q)));

  const plantasConDireccion = (empresaSel?.plantas || []).filter((p) => p.ubigeo && p.direccion);

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
              <h4 className="font-semibold text-gray-800">
                {empresaSel ? empresaSel.razonSocial : "Direcciones guardadas"}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {empresaSel ? "Elige la planta de destino" : "Busca la empresa por RUC, razón social o alias"}
              </p>
            </div>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0">✕</button>
          </div>
          {!empresaSel && (
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por RUC, razón social o alias…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          )}
          {empresaSel && (
            <button type="button" onClick={() => setEmpresaSel(null)}
              className="text-xs text-blue-600 hover:text-blue-800 underline">
              ← Elegir otra empresa
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!empresaSel ? (
            filtradas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">
                {empresas.length === 0 ? "No hay empresas registradas." : `Sin resultados para “${busqueda}”.`}
              </p>
            ) : (
              filtradas.map((e) => (
                <button
                  key={e._id}
                  type="button"
                  onClick={() => setEmpresaSel(e)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                  </p>
                  <p className="text-xs text-gray-400">{e.ruc || "Sin RUC"}</p>
                </button>
              ))
            )
          ) : plantasConDireccion.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              Esta empresa no tiene plantas con ubigeo y dirección guardados — agrégalos desde Empresas.
            </p>
          ) : (
            plantasConDireccion.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSeleccionar?.(empresaSel, p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                <p className="text-xs text-gray-400">{p.ubigeo} — {p.direccion}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
