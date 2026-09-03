import { useState, useEffect, useCallback } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import SelectorMateriales from "../components/SelectorMateriales";
import PromptAccion from "../components/PromptAccion";

const ESTADO_ITEM = {
  pendiente: "bg-blue-100 text-blue-700",
  atendido: "bg-green-100 text-green-700",
  cerrado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
};

function resumenCompra(item) {
  return Object.entries(item.camposCompra || {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

// ─── Salida de un ítem de stock: pide lote (FIFO disponible) + cantidad ────

function PanelSalida({ requerimientoId, item, onClose, onListo }) {
  const [lotes, setLotes] = useState([]);
  const [lote, setLote] = useState("");
  const [precioAuto, setPrecioAuto] = useState(0);
  const [cantidad, setCantidad] = useState(item.cantidad);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Ítem de stock existente: usa `item.material`. Ítem de compra ya vinculado
  // a un SKU: usa `item.materialAsociado` — mismo flujo de Atender para ambos.
  const materialId = item.esSolicitudCompra
    ? (item.materialAsociado?._id || item.materialAsociado)
    : item.material._id;

  useEffect(() => {
    fetchAuth(`/movimientos-almacen/lotes/${materialId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setLotes);
  }, [materialId]);

  const seleccionarLote = (l) => { setLote(l.lote); setPrecioAuto(l.precioUnitario); };

  const confirmar = async () => {
    if (!lote || !cantidad || cantidad <= 0) { setError("Selecciona el lote e ingresa la cantidad."); return; }
    setGuardando(true);
    const r = await fetchAuth(`/requerimientos/${requerimientoId}/items/${item._id}/salida`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote, cantidad: Number(cantidad), precioUnitario: precioAuto }),
    });
    if (r.ok) {
      onListo(await r.json());
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al registrar la salida");
    }
    setGuardando(false);
  };

  return (
    <div className="bg-blue-50/60 rounded-xl p-3 mt-2 space-y-2">
      {error && <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">{error}</p>}
      {lotes.length === 0 ? (
        // Sin stock, no hay nada que seleccionar — mostrar cantidad/confirmar
        // acá sería un callejón sin salida (el botón nunca se habilita porque
        // nunca hay un lote que elegir). Se avisa y se corta el flujo acá.
        <>
          <p className="text-xs text-gray-500">
            Sin lotes disponibles para este material — registra un ingreso en Almacén antes de poder atenderlo.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            {lotes.map((l) => (
              <button key={l.lote} type="button" onClick={() => seleccionarLote(l)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${
                  lote === l.lote ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
                <div className="flex justify-between">
                  <span className="font-mono font-semibold text-gray-700">{l.lote}</span>
                  <span className="font-semibold text-gray-800">S/ {Number(l.precioUnitario).toFixed(2)}</span>
                </div>
                <div className="flex gap-3 text-gray-400 mt-0.5">
                  <span>Disponible: <strong>{l.cantidadDisponible}</strong></span>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={0.01} step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right bg-white" />
            <button onClick={confirmar} disabled={guardando || !lote}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium">
              {guardando ? "Guardando…" : "Confirmar salida"}
            </button>
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Devolución de un ítem ya atendido: registra un INGRESO en Movimientos ──

function PanelDevolucion({ requerimientoId, item, onClose, onListo }) {
  const unidad = item.esSolicitudCompra ? item.materialAsociado?.unidad : item.material?.unidad;
  const maxDevolvible = item.cantidad - (item.cantidadDevuelta || 0);
  const [cantidad, setCantidad] = useState(maxDevolvible);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const confirmar = async () => {
    if (!cantidad || cantidad <= 0) { setError("Ingresa una cantidad válida."); return; }
    setGuardando(true);
    const r = await fetchAuth(`/requerimientos/${requerimientoId}/items/${item._id}/devolucion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: Number(cantidad) }),
    });
    if (r.ok) {
      onListo(await r.json());
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al registrar la devolución");
    }
    setGuardando(false);
  };

  return (
    <div className="bg-red-50/60 rounded-xl p-3 mt-2 space-y-2">
      {error && <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">{error}</p>}
      <p className="text-xs text-gray-500">Disponible para devolver: <strong>{maxDevolvible}</strong> {unidad}</p>
      <div className="flex items-center gap-2">
        <input type="number" min={0.01} max={maxDevolvible} step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
          className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right bg-white" />
        <button onClick={confirmar} disabled={guardando || maxDevolvible <= 0}
          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium">
          {guardando ? "Guardando…" : "Confirmar devolución"}
        </button>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">Cancelar</button>
      </div>
    </div>
  );
}

// Ubicación / Stock actual / Cantidad solicitada, visibles de un vistazo —
// el stock se colorea en rojo cuando no alcanza para cubrir lo pedido
// (respuesta a que antes quedaba enterrado en una línea de texto gris chica).
function BadgesMaterial({ material, cantidad }) {
  if (!material) return null;
  const stock = material.stock ?? 0;
  const alcanza = stock >= cantidad;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
        Ubicación: {material.ubicacion?.nombre || "Sin ubicación"}
      </span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alcanza ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        Stock: {stock} {material.unidad}
      </span>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
        Solicitado: {cantidad} {material.unidad}
      </span>
    </div>
  );
}

// ─── Fila de un ítem dentro de un requerimiento ─────────────────────────────

function FilaItem({ requerimiento, item, puedeAtender, onActualizado }) {
  const [panelSalida, setPanelSalida] = useState(false);
  const [panelDevolucion, setPanelDevolucion] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const unidad = item.esSolicitudCompra ? item.materialAsociado?.unidad : item.material?.unidad;

  const accion = async (endpoint, body) => {
    const r = await fetchAuth(`/requerimientos/${requerimiento._id}/items/${item._id}/${endpoint}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (r.ok) onActualizado(await r.json());
  };

  const rechazar = async (motivo) => {
    setRechazando(true);
    await accion("rechazar", { motivo });
    setRechazando(false);
    setConfirmandoRechazo(false);
  };

  const vincular = (material) => {
    setBuscadorAbierto(false);
    accion("vincular-material", { material: material._id });
  };

  return (
    <div className="border-t border-gray-50 first:border-t-0 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {item.esSolicitudCompra ? (
            <>
              <p className="text-sm font-medium text-gray-800">
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 mr-1.5">Compra</span>
                {item.categoriaNombre} — {item.cantidad}
              </p>
              <p className="text-xs text-gray-400 truncate">{resumenCompra(item)}</p>
              {item.materialAsociado && (
                <>
                  <p className="text-xs text-blue-600 mt-0.5">Vinculado a: {item.materialAsociado.sku} — {item.materialAsociado.nombre}</p>
                  <BadgesMaterial material={item.materialAsociado} cantidad={item.cantidad} />
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800">{item.material?.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{item.material?.sku}</p>
              <BadgesMaterial material={item.material} cantidad={item.cantidad} />
            </>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${ESTADO_ITEM[item.estado]}`}>
          {item.estado}
        </span>
        {puedeAtender && item.estado === "pendiente" && (!item.esSolicitudCompra || item.materialAsociado) && (
          <button onClick={() => setPanelSalida((v) => !v)}
            className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition font-medium shrink-0">
            Atender
          </button>
        )}
        {puedeAtender && item.estado === "pendiente" && item.esSolicitudCompra && !item.materialAsociado && (
          <button onClick={() => setBuscadorAbierto(true)}
            className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition font-medium shrink-0">
            Vincular SKU
          </button>
        )}
        {puedeAtender && item.estado === "pendiente" && (
          <button onClick={() => setConfirmandoRechazo(true)} className="text-xs text-gray-400 hover:text-red-500 transition shrink-0">
            Rechazar
          </button>
        )}
        {puedeAtender && item.estado === "atendido" && item.movimientoAlmacen && (
          <button onClick={() => setPanelDevolucion((v) => !v)}
            disabled={item.cantidad - (item.cantidadDevuelta || 0) <= 0}
            className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium shrink-0">
            Devolución
          </button>
        )}
      </div>
      {item.cantidadDevuelta > 0 && (
        <p className="text-xs text-red-500 mt-1">Devuelto: {item.cantidadDevuelta} {unidad}</p>
      )}

      {panelSalida && (
        <PanelSalida requerimientoId={requerimiento._id} item={item}
          onClose={() => setPanelSalida(false)}
          onListo={(r) => { setPanelSalida(false); onActualizado(r); }} />
      )}
      {panelDevolucion && (
        <PanelDevolucion requerimientoId={requerimiento._id} item={item}
          onClose={() => setPanelDevolucion(false)}
          onListo={(r) => { setPanelDevolucion(false); onActualizado(r); }} />
      )}
      {buscadorAbierto && (
        <SelectorMateriales onSelect={vincular} onClose={() => setBuscadorAbierto(false)} />
      )}
      {confirmandoRechazo && (
        <PromptAccion
          titulo="Rechazar ítem"
          label="Motivo del rechazo"
          onCancelar={() => setConfirmandoRechazo(false)}
          onConfirmar={rechazar}
          procesando={rechazando}
          textoConfirmar="Rechazar"
        />
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function Requerimientos() {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("activos");
  const usuario = getUsuario();
  const puedeAtender = ["admin", "almacenero"].includes(usuario?.rol);

  const cargar = useCallback(async () => {
    const r = await fetchAuth("/requerimientos");
    if (r.ok) setLista(await r.json());
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const actualizarEnLista = (actualizado) => {
    setLista((prev) => prev.map((r) => r._id === actualizado._id ? actualizado : r));
  };

  const tieneItemsPendientes = (r) => r.items.some((it) => it.estado === "pendiente");
  // "Materiales pendientes": solicitudes de compra (sin SKU todavía)
  // pendientes de comprar — distinto de "Activos", que incluye también los
  // ítems de stock existente pendientes de dar salida.
  const esPendientePorComprar = (it) => it.esSolicitudCompra && it.estado === "pendiente";
  const tieneItemsPendientesCompra = (r) => r.items.some(esPendientePorComprar);
  const filtrados = lista.filter((r) => {
    if (filtro === "activos") return tieneItemsPendientes(r);
    if (filtro === "pendientes-compra") return tieneItemsPendientesCompra(r);
    return !tieneItemsPendientes(r);
  });

  const fmtFecha = (d) => d ? formatearFecha(d, { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Requerimientos de material</h1>
        <p className="text-sm text-gray-400 mt-0.5">Solicitudes de material hechas desde las Órdenes de Trabajo</p>
      </div>

      <div className="flex border-b border-gray-200 gap-1">
        {[
          { id: "activos", label: "Activos" },
          { id: "completados", label: "Completados" },
          { id: "pendientes-compra", label: "Materiales pendientes" },
        ].map((t) => (
          <button key={t.id} onClick={() => setFiltro(t.id)}
            className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              filtro === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtrados.length === 0 && (
          <p className="text-center py-10 text-gray-300 text-sm">
            Sin requerimientos {filtro === "activos" ? "activos" : filtro === "pendientes-compra" ? "con materiales pendientes por comprar" : "completados"}
          </p>
        )}
        {filtrados.map((r) => {
          const itemsAMostrar = filtro === "pendientes-compra" ? r.items.filter(esPendientePorComprar) : r.items;
          return (
          <div key={r._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
              <div>
                <p className="font-mono text-xs text-gray-400">{r.codigo}</p>
                <p className="text-sm font-semibold text-gray-800">
                  {r.ordenTrabajo?.numeroOT} — {r.ordenTrabajo?.titulo}
                </p>
                <p className="text-xs text-gray-500">{r.solicitadoPor}{r.dni ? ` — DNI ${r.dni}` : ""}</p>
              </div>
              <span className="text-xs text-gray-400">{fmtFecha(r.createdAt)}</span>
            </div>
            {r.observaciones && <p className="text-xs text-gray-400 italic mb-2">{r.observaciones}</p>}
            <div>
              {itemsAMostrar.map((item) => (
                <FilaItem key={item._id} requerimiento={r} item={item} puedeAtender={puedeAtender}
                  onActualizado={actualizarEnLista} />
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
