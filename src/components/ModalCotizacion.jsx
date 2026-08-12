import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { exportarCotizacionPdf } from "../utils/cotizacionPdf";
import ModalCrearOT from "./ModalCrearOT";
import ModalOrdenCompra from "./ModalOrdenCompra";
import {
  calcSubtotal, INP, INP_RO,
  itemDesdeDb, itemVacioVenta, itemVacioServicio,
} from "../utils/cotizacionItems";
import CeldasNumericas from "./CeldasNumericas";

// Módulo-nivel: evita desmontaje/remontaje en cada render (previene pérdida de foco)
function FilaDescripcionEditable({ item, tipo, onUpdate, onAddSub, onUpdateSub, onDeleteSub }) {
  return (
    <td className="px-3 py-2 align-top">
      <input
        type="text"
        value={item.descripcion}
        onChange={(e) => onUpdate(item._key, "descripcion", e.target.value)}
        required
        className={`w-full ${INP}`}
        placeholder="Descripción"
      />
      {tipo === "servicio" && (
        <div className="mt-1 space-y-1 pl-2">
          {item.subItems.map((sub) => (
            <div key={sub._subKey} className="flex gap-1 items-center">
              <span className="text-gray-400 text-xs">•</span>
              <input
                type="text"
                value={sub.texto}
                onChange={(e) => onUpdateSub(item._key, sub._subKey, e.target.value)}
                className={`flex-1 ${INP} text-xs`}
                placeholder="Sub-ítem"
              />
              <button
                type="button"
                onClick={() => onDeleteSub(item._key, sub._subKey)}
                className="text-red-400 hover:text-red-600 text-xs px-1 leading-none"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onAddSub(item._key)}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1"
          >
            + sub-ítem
          </button>
        </div>
      )}
    </td>
  );
}

function PanelIngresoEquipo({ ie }) {
  if (!ie) return null;
  return (
    <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3 mb-5">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        Ingreso de equipo · <span className="font-mono">{ie.codigo}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Tipo de equipo</label>
          <input value={ie.tipoEquipo || "—"} disabled className={`w-full ${INP_RO}`} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Marca / Modelo</label>
          <input value={[ie.marca, ie.modelo].filter(Boolean).join(" / ") || "—"} disabled className={`w-full ${INP_RO}`} />
        </div>
        {ie.planta && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Planta</label>
            <input value={ie.planta} disabled className={`w-full ${INP_RO}`} />
          </div>
        )}
        {ie.fechaIngreso && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Fecha de ingreso</label>
            <input value={new Date(ie.fechaIngreso).toLocaleDateString("es-PE")} disabled className={`w-full ${INP_RO}`} />
          </div>
        )}
        {ie.caracteristicasElectricas && (
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Características eléctricas</label>
            <input value={ie.caracteristicasElectricas} disabled className={`w-full ${INP_RO}`} />
          </div>
        )}
        {ie.accesorios && (
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Accesorios</label>
            <input value={ie.accesorios} disabled className={`w-full ${INP_RO}`} />
          </div>
        )}
        {ie.descripcionProblema && (
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Descripción del problema</label>
            <textarea value={ie.descripcionProblema} disabled rows={2} className={`w-full ${INP_RO} resize-none`} />
          </div>
        )}
        {ie.numeroGuiaEmision && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">N° guía de remisión</label>
            <input value={ie.numeroGuiaEmision} disabled className={`w-full ${INP_RO} font-mono`} />
          </div>
        )}
        {ie.garantia && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Garantía</label>
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              En garantía
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function VistaDetalle({ cot, ie, ocVinculada, onVincularOC, vinculandoOC }) {
  return (
    <div>
      <PanelIngresoEquipo ie={ie} />
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Empresa</p>
          {cot.empresa ? (
            <p className="text-sm font-medium">
              {cot.empresa.alias} — {cot.empresa.razonSocial}
            </p>
          ) : (
            <p className="text-sm text-gray-400">Sin empresa</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Condición de pago</p>
          <p className="text-sm">{cot.condicionPago}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
          <p className="text-sm">{new Date(cot.fecha).toLocaleDateString("es-PE")}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Fecha recibida</p>
          <p className="text-sm">{cot.fechaRecibida ? new Date(cot.fechaRecibida).toLocaleDateString("es-PE") : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Título</p>
          <p className="text-sm font-medium">{cot.titulo}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">N° Cotización</p>
          <p className="text-sm">{cot.numeroCotizacion || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">N° guía de llegada</p>
          <p className="text-sm">{cot.numeroGuiaEmision || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">N° guía de salida</p>
          <p className="text-sm">{cot.numeroGuiaRemision || "—"}</p>
        </div>
      </div>

      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Descripción</th>
              <th className="px-3 py-2 text-center">Cant.</th>
              <th className="px-3 py-2 text-center">F. Entrega</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-center">Mon.</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cot.items.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-800">{item.descripcion}</p>
                  {item.subItems?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {item.subItems.map((s, j) => (
                        <li key={j} className="text-xs text-gray-500 flex gap-1.5">
                          <span>•</span><span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-center">{item.cantidad}</td>
                <td className="px-3 py-2 text-center text-gray-500">
                  {item.fechaEntrega
                    ? new Date(item.fechaEntrega).toLocaleDateString("es-PE")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">{Number(item.precio).toFixed(2)}</td>
                <td className="px-3 py-2 text-center">{item.moneda === "PEN" ? "S/" : "$"}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {Number(item.subtotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-8 text-sm border-t border-gray-100 pt-4">
        <div className="text-right space-y-1 text-gray-500">
          <p>Subtotal</p>
          <p>IGV 18%</p>
          <p className="font-semibold text-gray-800 text-base">Total</p>
        </div>
        <div className="text-right space-y-1">
          <p>{Number(cot.subtotal).toFixed(2)}</p>
          <p>{Number(cot.igv).toFixed(2)}</p>
          <p className="font-semibold text-gray-800 text-base">{Number(cot.total).toFixed(2)}</p>
        </div>
      </div>

      {/* OC vinculada */}
      <div className="mt-5 border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Orden de Compra vinculada</p>
        {ocVinculada ? (
          <div className="flex items-center gap-4">
            <div>
              <p className="font-mono text-xs text-blue-600">{ocVinculada.numeroOrden || ocVinculada.codigo}</p>
              <p className="text-sm text-gray-700">{ocVinculada.titulo}</p>
              {ocVinculada.empresa && (
                <p className="text-xs text-gray-400">{ocVinculada.empresa.razonSocial}</p>
              )}
            </div>
            <span className="text-xs font-medium text-gray-500 ml-auto">
              S/ {Number(ocVinculada.monto ?? 0).toFixed(2)}
            </span>
          </div>
        ) : (
          <button onClick={onVincularOC} disabled={vinculandoOC}
            className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-40">
            {vinculandoOC ? "Vinculando…" : "+ Vincular OC existente"}
          </button>
        )}
      </div>
    </div>
  );
}

function BuscadorOrdenCompra({ onSelect, onClose }) {
  const INP_LOCAL = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
  const [lista, setLista] = useState([]);
  const [q, setQ]         = useState("");
  useEffect(() => {
    fetchAuth("/ordenes-compra").then(r => r.ok && r.json()).then(d => setLista(d || []));
  }, []);
  const filtradas = lista.filter(o => !q ||
    [o.numeroOrden, o.titulo, o.empresa?.razonSocial]
      .some(v => v?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800">Buscar Orden de Compra</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="px-4 pt-4">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="N° orden, título o empresa…" className={INP_LOCAL} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtradas.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
            : filtradas.map(o => (
              <button key={o._id} onClick={() => onSelect(o)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition">
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-blue-600">{o.numeroOrden || o.codigo}</span>
                  <span className="text-xs text-gray-400">S/ {Number(o.monto ?? 0).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{o.titulo}</p>
                {o.empresa && <p className="text-xs text-gray-400">{o.empresa.razonSocial}</p>}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function ModalCotizacion({ cotizacion: inicial, onClose, onSaved }) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cot, setCot] = useState(inicial);
  const [crearOT, setCrearOT] = useState(false);
  const [otCreada, setOtCreada] = useState(false);
  const [confirmarOC, setConfirmarOC] = useState(false);
  const [crearOC, setCrearOC]         = useState(false);
  const [form, setForm] = useState({});
  const [items, setItems] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [ie, setIe] = useState(null);
  const [ocVinculada, setOcVinculada] = useState(null);
  const [buscadorOC, setBuscadorOC]   = useState(false);
  const [vinculandoOC, setVinculandoOC] = useState(false);

  useEffect(() => {
    fetchAuth("/ordenes-trabajo").then((r) => r.ok && r.json()).then((ots) => {
      if (!ots) return;
      const ot = ots.find((o) => o.cotizacion?._id === cot._id && o.ingresoEquipo);
      setIe(ot?.ingresoEquipo || null);
    });
  }, [cot._id]);

  useEffect(() => {
    fetchAuth("/ordenes-compra").then(r => r.ok && r.json()).then(ocs => {
      if (!ocs) return;
      const oc = ocs.find(o => (o.cotizacion?._id || o.cotizacion) === cot._id);
      setOcVinculada(oc || null);
    });
  }, [cot._id]);

  const vincularOC = async (oc) => {
    setBuscadorOC(false); setVinculandoOC(true);
    await fetchAuth(`/ordenes-compra/${oc._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cotizacion: cot._id }),
    });
    setOcVinculada(oc);
    setVinculandoOC(false);
  };

  const entrarEdicion = () => {
    fetchAuth("/empresas").then((r) => r.ok && r.json().then(setEmpresas));
    setForm({
      tipo: cot.tipo,
      empresa: cot.empresa?._id || "",
      condicionPago: cot.condicionPago,
      fecha: cot.fecha ? new Date(cot.fecha).toISOString().split("T")[0] : "",
      fechaRecibida: cot.fechaRecibida ? new Date(cot.fechaRecibida).toISOString().split("T")[0] : "",
      titulo: cot.titulo,
      numeroCotizacion: cot.numeroCotizacion || "",
      numeroGuiaEmision: cot.numeroGuiaEmision || "",
      numeroGuiaRemision: cot.numeroGuiaRemision || "",
    });
    setItems((cot.items || []).map(itemDesdeDb));
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setConfirmando(false);
  };

  const handleForm = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const actualizarItem = (key, campo, valor) =>
    setItems((prev) => prev.map((it) => (it._key === key ? { ...it, [campo]: valor } : it)));

  const agregarSubItem = (key) =>
    setItems((prev) =>
      prev.map((it) =>
        it._key === key
          ? { ...it, subItems: [...it.subItems, { _subKey: Date.now() + Math.random(), texto: "" }] }
          : it
      )
    );

  const actualizarSubItem = (key, subKey, texto) =>
    setItems((prev) =>
      prev.map((it) =>
        it._key === key
          ? { ...it, subItems: it.subItems.map((s) => (s._subKey === subKey ? { ...s, texto } : s)) }
          : it
      )
    );

  const eliminarSubItem = (key, subKey) =>
    setItems((prev) =>
      prev.map((it) =>
        it._key === key
          ? { ...it, subItems: it.subItems.filter((s) => s._subKey !== subKey) }
          : it
      )
    );

  const agregarItem = () =>
    setItems((prev) => [
      ...prev,
      form.tipo === "servicio" ? itemVacioServicio() : itemVacioVenta(),
    ]);

  const eliminarItem = (key) => setItems((prev) => prev.filter((it) => it._key !== key));

  const subtotal = parseFloat(items.reduce((s, it) => s + calcSubtotal(it), 0).toFixed(2));
  const igv = parseFloat((subtotal * 0.18).toFixed(2));
  const total = parseFloat((subtotal + igv).toFixed(2));

  const guardar = async () => {
    setGuardando(true);
    setConfirmando(false);
    const payload = {
      ...form,
      items: items.map((it) => ({
        descripcion: it.descripcion,
        subItems: (it.subItems || []).map((s) => s.texto).filter(Boolean),
        cantidad: it.cantidad,
        fechaEntrega: it.fechaEntrega || null,
        precio: it.precio,
        moneda: it.moneda,
        subtotal: calcSubtotal(it),
      })),
      subtotal,
      igv,
      total,
    };
    if (!payload.empresa) delete payload.empresa;
    if (!payload.fechaRecibida) delete payload.fechaRecibida;

    const res = await fetchAuth(`/cotizaciones/${cot._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada);
      setEditando(false);
      onSaved(actualizada);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-500">{cot.codigo}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                cot.tipo === "venta"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-purple-50 text-purple-700"
              }`}
            >
              {cot.tipo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {otCreada && cot.tipo === "servicio" && (
              <span className="text-xs text-emerald-600 font-medium">✓ OT creada</span>
            )}
            <button
              type="button"
              onClick={() => exportarCotizacionPdf(cot)}
              className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
            >
              Exportar PDF
            </button>
            {!editando && (
              <>
                <button
                  type="button"
                  onClick={entrarEdicion}
                  className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                >
                  Editar
                </button>
                {/* {cot.tipo === "servicio" && (
                  <button
                    type="button"
                    onClick={() => setCrearOT(true)}
                    className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition font-medium"
                  >
                    + Crear OT
                  </button>
                )} */}
                <button
                  type="button"
                  onClick={() => setConfirmarOC(true)}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Orden de Compra
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 ml-1 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {!editando ? (
            <VistaDetalle cot={cot} ie={ie}
              ocVinculada={ocVinculada}
              onVincularOC={() => setBuscadorOC(true)}
              vinculandoOC={vinculandoOC}
            />
          ) : (
            <form onSubmit={(e) => e.preventDefault()}>
              <PanelIngresoEquipo ie={ie} />
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                  <select
                    name="empresa"
                    value={form.empresa}
                    onChange={handleForm}
                    className={`w-full ${INP}`}
                  >
                    <option value="">Sin empresa</option>
                    {empresas.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.alias} — {e.razonSocial}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Condición de pago</label>
                  <input
                    name="condicionPago"
                    value={form.condicionPago}
                    onChange={handleForm}
                    className={`w-full ${INP}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    value={form.fecha}
                    onChange={handleForm}
                    className={`w-full ${INP}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Título</label>
                  <input
                    name="titulo"
                    value={form.titulo}
                    onChange={handleForm}
                    className={`w-full ${INP}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha recibida</label>
                  <input
                    type="date"
                    name="fechaRecibida"
                    value={form.fechaRecibida}
                    onChange={handleForm}
                    className={`w-full ${INP}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">N° Cotización</label>
                  <input
                    name="numeroCotizacion"
                    value={form.numeroCotizacion}
                    onChange={handleForm}
                    placeholder="—"
                    className={`w-full ${INP}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">N° guía de llegada</label>
                  <input
                    name="numeroGuiaEmision"
                    value={form.numeroGuiaEmision}
                    onChange={handleForm}
                    placeholder="—"
                    className={`w-full ${INP}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">N° guía de salida</label>
                  <input
                    name="numeroGuiaRemision"
                    value={form.numeroGuiaRemision}
                    onChange={handleForm}
                    placeholder="—"
                    className={`w-full ${INP}`}
                  />
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-center">Cant.</th>
                      <th className="px-3 py-2 text-center">F. Entrega</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                      <th className="px-3 py-2 text-center">Mon.</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr key={item._key}>
                        <FilaDescripcionEditable
                          item={item}
                          tipo={form.tipo}
                          onUpdate={actualizarItem}
                          onAddSub={agregarSubItem}
                          onUpdateSub={actualizarSubItem}
                          onDeleteSub={eliminarSubItem}
                        />
                        <CeldasNumericas item={item} ro={false} onUpdate={actualizarItem} />
                        <td className="px-3 py-2 text-right font-medium">
                          {calcSubtotal(item).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => eliminarItem(item._key)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={agregarItem}
                className="text-sm text-gray-500 hover:text-gray-800 mb-5 transition"
              >
                + Agregar ítem
              </button>

              <div className="flex justify-end gap-8 text-sm border-t border-gray-100 pt-4 mb-5">
                <div className="text-right space-y-1 text-gray-500">
                  <p>Subtotal</p>
                  <p>IGV 18%</p>
                  <p className="font-semibold text-gray-800 text-base">Total</p>
                </div>
                <div className="text-right space-y-1">
                  <p>{subtotal.toFixed(2)}</p>
                  <p>{igv.toFixed(2)}</p>
                  <p className="font-semibold text-gray-800 text-base">{total.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Confirmación orden de compra */}
      {confirmarOC && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h4 className="font-semibold text-gray-800">¿Crear orden de compra?</h4>
            <p className="text-sm text-gray-500">
              Se generará una orden de compra a partir de la cotización <span className="font-mono font-medium">{cot.codigo}</span>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmarOC(false)}
                className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmarOC(false); setCrearOC(true); }}
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {crearOC && (
        <ModalOrdenCompra
          cotizacion={cot}
          onClose={() => setCrearOC(false)}
          onCreada={() => setCrearOC(false)}
        />
      )}

      {/* Modal crear OT — solo para tipo servicio */}
      {crearOT && cot.tipo === "servicio" && (
        <ModalCrearOT
          cotizacion={cot}
          onClose={() => setCrearOT(false)}
          onCreada={() => {
            setCrearOT(false);
            setOtCreada(true);
            setTimeout(() => setOtCreada(false), 3000);
          }}
        />
      )}

      {/* Modal de confirmación */}
      {confirmando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 shadow-2xl w-80">
            <p className="text-sm text-gray-700 mb-4">
              ¿Confirmar los cambios en la cotización?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
              >
                {guardando ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {buscadorOC && (
        <BuscadorOrdenCompra onSelect={vincularOC} onClose={() => setBuscadorOC(false)} />
      )}
    </div>
  );
}
