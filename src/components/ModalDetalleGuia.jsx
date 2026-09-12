import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import {
  MODALIDAD_TRASLADO,
  MOTIVO_TRASLADO,
  estadoComprobanteClase,
} from "../utils/catalogosSunat";

const labelMotivo = (v) => MOTIVO_TRASLADO.find((m) => m.valor === v)?.label ?? v;
const labelModalidad = (v) => MODALIDAD_TRASLADO.find((m) => m.valor === v)?.label ?? v;

// Un "[404] Resource not found" (código HTTP de 3 dígitos) es un fallo de la consulta del
// ticket, no un rechazo real de SUNAT (esos van con código del catálogo CDR, siempre 4 dígitos)
// — ver Backend/src/utils/sunatConsultaResultado.js. En ese caso "Forzar actualización" sigue
// disponible aunque el estado guardado sea RECHAZADO.
const esFalloDeConsulta = (mensaje) => /^\[[45]\d{2}\]/.test(mensaje || "");

// Extraído de ListaGuias.jsx (su modal inline) para poder abrir el mismo
// detalle de GRE desde las tarjetas de relación de Cotización/OT/OC.
// `onActualizada` es opcional — ListaGuias.jsx lo usa para refrescar su tabla
// tras "Forzar actualización"; las tarjetas de relación no necesitan pasarlo.
export default function ModalDetalleGuia({ guia, onClose, onActualizada }) {
  const [actual, setActual] = useState(guia);
  const [errorDescarga, setErrorDescarga] = useState("");
  const [consultando, setConsultando] = useState(false);

  useEffect(() => { setActual(guia); setErrorDescarga(""); }, [guia]);

  if (!actual) return null;

  const descargar = async (tipo) => {
    setErrorDescarga("");
    const res = await fetchAuth(`/guias/${actual._id}/${tipo}`);
    if (!res.ok) { setErrorDescarga(`${tipo.toUpperCase()} no disponible para esta guía.`); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const cd     = res.headers.get("Content-Disposition") || "";
    const nombre = cd.match(/filename="([^"]+)"/)?.[1] || actual.nombreArchivo;
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const forzarActualizacion = async () => {
    setConsultando(true);
    setErrorDescarga("");
    try {
      const res  = await fetchAuth(`/guias/${actual._id}/consultar`);
      const data = await res.json();
      if (!data.ok) { setErrorDescarga(data.error || "No se pudo consultar el estado en SUNAT."); return; }
      await onActualizada?.();
      const actualizada = {
        ...actual,
        estado: data.estado,
        sunat: { ...actual.sunat, mensaje: data.mensaje, linkSunat: data.linkSunat },
      };
      setActual(actualizada);
    } catch {
      setErrorDescarga("Error de conexión al consultar SUNAT.");
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">
              Guía {actual.serie}-{String(actual.correlativo).padStart(4, "0")}
            </h3>
            <span className="font-mono text-xs text-gray-400">{actual.nombreArchivo}</span>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoComprobanteClase(actual.estado)}`}>
            {actual.estado}
          </span>
        </div>

        {(actual.estado === "RECHAZADO" || actual.estado === "ERROR") && actual.sunat?.mensaje && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 whitespace-pre-wrap">
            {actual.sunat.mensaje}
            {!!actual.sunat?.errores?.length && (
              <ul className="list-disc list-inside mt-2 space-y-0.5">
                {actual.sunat.errores.map((e, i) => (
                  <li key={i}>{typeof e === "string" ? e : (e.mensaje || e.descripcion || JSON.stringify(e))}</li>
                ))}
              </ul>
            )}
            {!!actual.sunat?.observaciones?.length && (
              <ul className="list-disc list-inside mt-2 space-y-0.5 text-amber-700">
                {actual.sunat.observaciones.map((o, i) => (
                  <li key={i}>{typeof o === "string" ? o : (o.mensaje || o.descripcion || JSON.stringify(o))}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {errorDescarga && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-2 mb-4">
            {errorDescarga}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Emisor</p>
            <p className="text-sm text-gray-800">{actual.emisor?.nombre}</p>
            <p className="text-xs text-gray-400">{actual.emisor?.numDoc}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Destinatario</p>
            <p className="text-sm text-gray-800">{actual.destinatario?.nombre}</p>
            <p className="text-xs text-gray-400">{actual.destinatario?.numDoc}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Motivo de traslado</p>
            <p className="text-sm text-gray-800">{labelMotivo(actual.motivoTraslado)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Modalidad</p>
            <p className="text-sm text-gray-800">{labelModalidad(actual.modalidadTraslado)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Punto de partida</p>
            <p className="text-sm text-gray-800">{actual.puntoPartida?.direccion}</p>
            <p className="text-xs text-gray-400">Ubigeo {actual.puntoPartida?.ubigeo}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Punto de llegada</p>
            <p className="text-sm text-gray-800">{actual.puntoLlegada?.direccion}</p>
            <p className="text-xs text-gray-400">Ubigeo {actual.puntoLlegada?.ubigeo}</p>
          </div>
          {actual.modalidadTraslado === "02" ? (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Vehículo / Conductor</p>
              <p className="text-sm text-gray-800">{actual.vehiculo?.placa}</p>
              <p className="text-xs text-gray-400">
                {actual.conductor?.nombres} {actual.conductor?.apellidos} — {actual.conductor?.numDoc}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">Transportista</p>
              <p className="text-sm text-gray-800">{actual.transportista?.razonSocial}</p>
              <p className="text-xs text-gray-400">{actual.transportista?.ruc}</p>
            </div>
          )}
        </div>

        <table className="erp-table w-full text-sm mb-4">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Descripción</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2 text-right">Unidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {actual.items?.map((it, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2">{it.descripcion}</td>
                <td className="px-3 py-2 text-right">{it.cantidad}</td>
                <td className="px-3 py-2 text-right">{it.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end gap-3 pt-2">
          {(actual.estado === "EN_PROCESO" ||
            (actual.estado === "RECHAZADO" && esFalloDeConsulta(actual.sunat?.mensaje))) && (
            <button onClick={forzarActualizacion} disabled={consultando}
              className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50">
              {consultando ? "Consultando SUNAT…" : "↻ Forzar actualización con SUNAT"}
            </button>
          )}
          <button onClick={() => descargar("xml")} className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Descargar XML
          </button>
          <button onClick={() => descargar("cdr")} className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Descargar CDR
          </button>
          {actual.sunat?.linkSunat && (
            <a href={actual.sunat.linkSunat} target="_blank" rel="noopener noreferrer"
              className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              PDF SUNAT ↗
            </a>
          )}
          <button onClick={onClose} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
