import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

// Vista compartida del tipo de cambio (un solo valor vigente, sin
// historial) — admin y facturacion lo actualizan, el resto de roles
// comerciales solo lo consultan (lo necesitan al ver la conversión PEN/USD
// en la tabla de Cotizaciones).
export default function TipoCambio() {
  const usuario = getUsuario();
  const puedeEditar = ["admin", "facturacion"].includes(usuario?.rol);

  const [tc, setTc] = useState(null);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const cargar = () => {
    fetchAuth("/tipo-cambio").then((r) => r.ok && r.json()).then((d) => {
      if (d) { setTc(d); setValor(String(d.valor)); }
    });
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    const num = Number(valor);
    if (!num || num <= 0) { setError("Ingresa un valor mayor a 0."); return; }
    setGuardando(true);
    setError("");
    setOk(false);
    const r = await fetchAuth("/tipo-cambio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: num }),
    });
    if (r.ok) {
      setTc(await r.json());
      setOk(true);
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al guardar");
    }
    setGuardando(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Tipo de Cambio</h1>
        <p className="text-sm text-gray-400 mt-0.5">Valor compartido usado para convertir Soles / Dólares en Cotizaciones</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vigente</p>
          <p className="text-4xl font-bold text-gray-800">S/ {tc ? Number(tc.valor).toFixed(3) : "—"}</p>
          <p className="text-xs text-gray-400 mt-1">por 1 US$</p>
          {tc?.actualizadoPor && (
            <p className="text-xs text-gray-400 mt-3">
              Actualizado por {tc.actualizadoPor}
              {tc.fechaActualizacion && ` · ${new Date(tc.fechaActualizacion).toLocaleString("es-PE")}`}
            </p>
          )}
        </div>

        {puedeEditar && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {ok && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">Tipo de cambio actualizado.</p>}
            <label className="text-xs text-gray-500 block mb-1">Nuevo valor (S/ por 1 US$)</label>
            <div className="flex gap-2">
              <input type="number" min="0.01" step="0.001" value={valor}
                onChange={(e) => { setValor(e.target.value); setOk(false); }}
                className={`flex-1 ${INP}`} placeholder="3.750" />
              <button onClick={guardar} disabled={guardando}
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
                {guardando ? "Guardando…" : "Actualizar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
