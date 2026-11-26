import { useEffect, useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { formatearFechaHora } from "../utils/fecha";

const MAX = 1000;
// Misma caja para el input y para cada nota guardada.
const CAJA = "block w-full h-24 resize-none rounded-lg border px-3 py-2 text-sm";
const FORMATO_FECHA ={ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };

// Historial de observaciones compartido entre una cotización y sus OT/sub-OT (ver
// Backend/src/utils/observaciones.js): solo se agregan; cada nota queda fija con usuario y fecha-hora de Lima.
// `endpoint`: "/cotizaciones/:id/notas" u "/ordenes-trabajo/:id/notas". Va en la columna junto a Relaciones.
export default function TarjetaObservaciones({ endpoint }) {
  const [notas, setNotas] = useState([]);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    fetchAuth(endpoint)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (vigente) setNotas(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [endpoint]);

  const guardar = async () => {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const res = await fetchAuth(endpoint, { method: "POST", body: JSON.stringify({ texto: texto.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotas(data);
        setTexto("");
      } else {
        setError(data.mensaje || "No se pudo guardar la observación.");
      }
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-5 rounded-full bg-amber-500" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Observaciones ({notas.length})</h2>
      </div>

      <div className="space-y-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX}
          placeholder="Escribe una observación o nota…"
          className={`${CAJA} bg-white border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300`}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-gray-400 tabular-nums">{texto.length}/{MAX}</span>
          <button type="button" onClick={guardar} disabled={!texto.trim() || guardando}
            className="text-sm bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {notas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin observaciones</p>
      ) : (
        <div className="space-y-3">
          {notas.map((n) => (
            <div key={n._id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 truncate" title={n.origen}>
                  {n.origen}
                </span>
                <span className="text-[11px] text-gray-400 truncate" title={n.usuario}>{n.usuario || "—"}</span>
              </div>
              <textarea value={n.texto} disabled readOnly
                className={`${CAJA} bg-gray-50 border-gray-100 text-gray-700 disabled:cursor-default`} />
              <p className="text-[11px] text-gray-400 text-right">{formatearFechaHora(n.fecha, FORMATO_FECHA)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
