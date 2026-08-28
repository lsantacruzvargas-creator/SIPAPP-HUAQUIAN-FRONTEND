import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import DetalleDocumento from "../components/DetalleDocumento";
import TablaScroll from "../components/TablaScroll";
import { DotChip, badgeOT, dotOT } from "../components/detalleShared";

const TH = "px-4 py-3 font-semibold text-gray-500 whitespace-nowrap";

const money = (v) => "S/ " + Number(v ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 });

function TablaCotizaciones({ titulo, acento, cotizaciones, otGroupMap, mostrarOT, onSelect, onToggleAprobar, mostrarAprobacion, vacioMsg }) {
  const totalColumnas = mostrarAprobacion ? 8 : 7;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({cotizaciones.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <TablaScroll className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "900px" }}>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
              <tr>
                <th className={`${TH} text-left`}>N° Cotización</th>
                {mostrarOT && <th className={`${TH} text-left`}>N° OT</th>}
                <th className={`${TH} text-left`}>Empresa</th>
                <th className={`${TH} text-left`}>Título</th>
                <th className={`${TH} text-right`}>Total</th>
                <th className={`${TH} text-center`}>Fecha</th>
                {mostrarAprobacion && <th className={`${TH} text-left`}>Aprobado por</th>}
                <th className={`${TH} text-center`}>Aprobar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotizaciones.length === 0 ? (
                <tr>
                  <td colSpan={totalColumnas} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td>
                </tr>
              ) : (
                cotizaciones.flatMap((c) => {
                  const grupoOT = otGroupMap?.[c.numeroDocumento];
                  const otPadre = grupoOT?.parent || null;
                  const subs = grupoOT?.subs || [];

                  const filaPrincipal = (
                    <tr key={c._id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${c.anulado ? "opacity-50" : ""}`}
                      onClick={() => onSelect(c)}>
                      <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {c.numeroCotizacion || <span className="text-gray-300 font-sans">—</span>}
                          {c.anulado && (
                            <span title={c.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                              Anulada
                            </span>
                          )}
                        </div>
                      </td>
                      {mostrarOT && (
                        <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                          {otPadre?.numeroOT || <span className="text-gray-300 font-sans">Sin OT</span>}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-gray-700">{c.empresa?.razonSocial || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3.5 text-gray-700">{c.titulo}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-700">{money(c.total)}</td>
                      <td className="px-4 py-3.5 text-center text-gray-500 whitespace-nowrap">
                        {c.fecha ? new Date(c.fecha).toLocaleDateString("es-PE") : "—"}
                      </td>
                      {mostrarAprobacion && (
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                          {c.aprobadoPor || "—"}
                          {c.fechaAprobacion && (
                            <span className="block text-xs text-gray-400">
                              {new Date(c.fechaAprobacion).toLocaleDateString("es-PE")}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={c.aprobado} disabled={c.anulado}
                          onChange={() => onToggleAprobar(c)}
                          className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-400 disabled:opacity-40" />
                      </td>
                    </tr>
                  );

                  if (!mostrarOT || subs.length === 0) return [filaPrincipal];

                  const filasSub = subs.map((s) => (
                    <tr key={s._id} className="bg-indigo-50/30">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 font-semibold text-indigo-700 whitespace-nowrap pl-8">↳ {s.numeroOT}</td>
                      <td className="px-4 py-3 text-gray-600" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <span>{s.titulo}</span>
                          <DotChip chip={badgeOT(s.estado)} dot={dotOT(s.estado)}>{s.estado}</DotChip>
                        </div>
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      {mostrarAprobacion && <td className="px-4 py-3" />}
                      <td className="px-4 py-3" />
                    </tr>
                  ));

                  return [filaPrincipal, ...filasSub];
                })
              )}
            </tbody>
          </table>
        </TablaScroll>
      </div>
    </div>
  );
}

export default function AprobacionCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [otGroupMap, setOtGroupMap] = useState({});
  const [seleccionada, setSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const usuario = getUsuario();
  const puedeAprobar = ["admin", "jefatura"].includes(usuario?.rol);
  // Pedido explícito: jefatura ve, para cada cotización, la OT padre
  // generada y sus sub-OTs (mismo agrupado por numeroDocumento ya usado en
  // ListaOrdenesCompra.jsx) — no se muestra para el resto de roles.
  const esJefatura = usuario?.rol === "jefatura";

  const cargar = () => {
    fetchAuth("/cotizaciones").then((r) => r.ok && r.json()).then((d) => setCotizaciones(d || []));
    if (esJefatura) {
      fetchAuth("/ordenes-trabajo").then((r) => r.ok && r.json()).then((ots) => {
        const otG = {};
        (ots || []).forEach((ot) => {
          if (ot.numeroDocumento == null) return;
          if (!otG[ot.numeroDocumento]) otG[ot.numeroDocumento] = { parent: null, subs: [] };
          if (ot.ordenPadre) otG[ot.numeroDocumento].subs.push(ot);
          else otG[ot.numeroDocumento].parent = ot;
        });
        setOtGroupMap(otG);
      });
    }
  };

  useEffect(() => { cargar(); }, []);

  const toggleAprobar = async (cot) => {
    if (!puedeAprobar) return;
    const res = await fetchAuth(`/cotizaciones/${cot._id}/aprobar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobado: !cot.aprobado }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCotizaciones((prev) => prev.map((c) => (c._id === actualizada._id ? actualizada : c)));
    }
  };

  // Busca por N° de cotización, N° de OT (padre o sub-OT, ver otGroupMap) o
  // título — coincide con cualquiera de los tres, sin distinguir mayúsculas.
  const coincideBusqueda = (c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    const grupo = otGroupMap[c.numeroDocumento];
    const numerosOT = [grupo?.parent?.numeroOT, ...(grupo?.subs?.map((s) => s.numeroOT) || [])]
      .filter(Boolean).join(" ").toLowerCase();
    return (
      c.numeroCotizacion?.toLowerCase().includes(q) ||
      c.titulo?.toLowerCase().includes(q) ||
      numerosOT.includes(q)
    );
  };

  const pendientes = cotizaciones.filter((c) => !c.aprobado && coincideBusqueda(c));
  const aprobadas  = cotizaciones.filter((c) => c.aprobado && coincideBusqueda(c));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Aprobación de Cotizaciones</h2>
          <span className="text-sm text-gray-400">{cotizaciones.length} cotización{cotizaciones.length !== 1 ? "es" : ""}</span>
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por N° cotización, N° OT o título…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-full max-w-xs"
        />
      </div>

      <TablaCotizaciones
        titulo="Pendientes de aprobar"
        acento="bg-amber-500"
        cotizaciones={pendientes}
        otGroupMap={otGroupMap}
        mostrarOT={esJefatura}
        onSelect={setSeleccionada}
        onToggleAprobar={toggleAprobar}
        mostrarAprobacion={false}
        vacioMsg="Sin cotizaciones pendientes de aprobar"
      />

      <TablaCotizaciones
        titulo="Aprobadas"
        acento="bg-green-500"
        cotizaciones={aprobadas}
        otGroupMap={otGroupMap}
        mostrarOT={esJefatura}
        onSelect={setSeleccionada}
        onToggleAprobar={toggleAprobar}
        mostrarAprobacion={true}
        vacioMsg="Sin cotizaciones aprobadas"
      />

      {seleccionada && (
        <DetalleDocumento
          tipo="cotizacion"
          data={seleccionada}
          onClose={() => { setSeleccionada(null); cargar(); }}
          onGuardadaCotizacion={(actualizada) => {
            setCotizaciones((prev) => prev.map((c) => (c._id === actualizada._id ? actualizada : c)));
          }}
        />
      )}
    </div>
  );
}
