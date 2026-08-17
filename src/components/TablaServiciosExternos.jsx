import { useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import ModalServicioExterno from "./ModalServicioExterno";

const money = (v) => "S/ " + Number(v ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 });

// Sección full-width de Servicios Externos (terceros) para el detalle de una
// OT/sub-OT — no la ve el rol técnico (gate ya hecho en el componente padre
// vía `puedeVerServicios`, este componente asume que ya se filtró). Se
// monta igual en DetalleOrdenTrabajo.jsx (vista agregada padre+sub-OTs vía
// `?ordenTrabajoPadre=`) y en DetalleSubOT.jsx (solo lo propio).
export default function TablaServiciosExternos({ ot, subOTs = [], servicios, puedeEditar, onCambio }) {
  const [crearOpen, setCrearOpen] = useState(false);

  const anular = async (servicio) => {
    const motivo = window.prompt("Motivo de anulación:");
    if (motivo === null) return;
    const res = await fetchAuth(`/servicios-externos/${servicio._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) onCambio();
  };

  const totalCosto = servicios.filter(s => !s.anulado).reduce((s, v) => s + (Number(v.costo) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-8 pb-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-purple-500" />
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Servicios Externos ({servicios.length})
            </h2>
          </div>
          {puedeEditar && !ot.anulado && (
            <button type="button" onClick={() => setCrearOpen(true)}
              className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium">
              + Agregar servicio
            </button>
          )}
        </div>

        {servicios.length === 0 ? (
          <p className="text-sm text-gray-400">Sin servicios externos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 pr-3">Código</th>
                  <th className="text-left py-2 pr-3">RUC</th>
                  <th className="text-left py-2 pr-3">Proveedor</th>
                  <th className="text-left py-2 pr-3">Tipo de trabajo</th>
                  <th className="text-left py-2 pr-3">Sub-OT</th>
                  <th className="text-right py-2 pr-3">Cantidad</th>
                  <th className="text-right py-2 pr-3">Costo</th>
                  <th className="text-left py-2 pr-3">Fecha</th>
                  {puedeEditar && <th className="text-left py-2 pr-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {servicios.map(s => {
                  const otOrigenId = s.ordenTrabajo?._id || s.ordenTrabajo;
                  const esPrincipal = otOrigenId === ot._id;
                  const subOrigen = subOTs.find(sub => sub._id === otOrigenId);
                  return (
                    <tr key={s._id} className={s.anulado ? "opacity-50" : ""}>
                      <td className="py-2 pr-3 font-mono text-xs text-gray-700">{s.codigo}</td>
                      <td className="py-2 pr-3 text-gray-500 font-mono text-xs">{s.rucProveedor || "—"}</td>
                      <td className="py-2 pr-3 text-gray-700">{s.nombreProveedor}</td>
                      <td className="py-2 pr-3 text-gray-600">{s.tipoTrabajo}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {esPrincipal ? "Principal" : (subOrigen?.numeroOT || s.ordenTrabajo?.numeroOT || "—")}
                      </td>
                      <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{s.cantidad}</td>
                      <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{s.costo > 0 ? money(s.costo) : "—"}</td>
                      <td className="py-2 pr-3 text-gray-500">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("es-PE") : "—"}
                      </td>
                      {puedeEditar && (
                        <td className="py-2 pr-3">
                          {!s.anulado && (
                            <button type="button" onClick={() => anular(s)}
                              className="text-xs text-gray-400 hover:text-red-500 transition">
                              Anular
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {totalCosto > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-100 font-semibold">
                    <td colSpan={6} className="py-2 pr-3 text-right text-xs uppercase tracking-wide text-gray-400">Total</td>
                    <td className="py-2 pr-3 text-right text-gray-800 tabular-nums">{money(totalCosto)}</td>
                    <td colSpan={puedeEditar ? 2 : 1} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {crearOpen && (
        <ModalServicioExterno ot={ot} onClose={() => setCrearOpen(false)}
          onCreado={() => { setCrearOpen(false); onCambio(); }} />
      )}
    </div>
  );
}
