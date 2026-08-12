import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP     = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_RO  = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full";
const INP_DIS = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  const total = Math.round((s + igv) * 100) / 100;
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = total >= 701 ? Math.round(total * 0.12) : 0;
  return { igv, total, detraccion, totalAPagar: Math.round((total - detraccion) * 100) / 100 };
}

function BuscadorOrdenCompra({ onSelect, onClose }) {
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetchAuth("/ordenes-compra").then(r => r.ok && r.json()).then(d => setLista(d || []));
  }, []);
  const filtradas = lista.filter(o => !q ||
    [o.numeroOrden, o.titulo, o.empresa?.razonSocial, o.codigo]
      .some(v => v?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800">Buscar orden de compra</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="px-4 pt-4">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="N° orden, título o empresa…" className={INP} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtradas.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
            : filtradas.map(o => (
              <button key={o._id} onClick={() => onSelect(o)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition">
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-blue-600">{o.codigo}</span>
                  <span className="text-xs text-gray-400">S/ {Number(o.monto ?? 0).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{o.numeroOrden || "Sin número"} — {o.titulo}</p>
                {o.empresa && <p className="text-xs text-gray-400">{o.empresa.razonSocial}</p>}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function ModalEditarFactura({ factura: inicial, onClose, onGuardada }) {
  const subtotalInicial = inicial.subtotal ?? inicial.monto ?? 0;

  const [form, setForm] = useState({
    numeroFactura:      inicial.numeroFactura      || "",
    fechaCancelacion:   inicial.fechaCancelacion
      ? new Date(inicial.fechaCancelacion).toISOString().split("T")[0] : "",
    empresa:            inicial.empresa?._id       || "",
    subtotal:           subtotalInicial != null ? String(subtotalInicial) : "",
    descripcion:        inicial.descripcion        || "",
    encargado:          inicial.encargado          || "",
    planta:             inicial.planta             || "",
    numeroGuiaEmision:  inicial.numeroGuiaEmision  || "",
    numeroGuiaRemision: inicial.numeroGuiaRemision || "",
  });
  const [calc, setCalc]           = useState(calcular(subtotalInicial));
  const [ocVinculada, setOC]      = useState(inicial.ordenCompra || null);
  const [empresas, setEmpresas]   = useState([]);
  const [buscadorOC, setBOC]      = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(d => setEmpresas(d || []));
  }, []);

  const plantasEmpresa = empresas.find(e => e._id === form.empresa)?.plantas ?? [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "subtotal") setCalc(calcular(value));
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const seleccionarOC = (oc) => {
    setOC(oc);
    setBOC(false);
    setForm(prev => {
      const nuevoSub = prev.subtotal || (oc.subtotal > 0 ? String(oc.subtotal) : prev.subtotal);
      if (!prev.subtotal && oc.subtotal > 0) setCalc(calcular(oc.subtotal));
      return {
        ...prev,
        empresa:     prev.empresa     || oc.empresa?._id || "",
        subtotal:    nuevoSub,
        descripcion: prev.descripcion || oc.descripcion  || oc.titulo || "",
        planta:      prev.planta      || oc.planta       || "",
        encargado:   prev.encargado   || oc.encargado    || "",
      };
    });
  };

  const guardar = async () => {
    setError(""); setGuardando(true);
    const payload = {
      numeroFactura:      form.numeroFactura,
      subtotal:           Number(form.subtotal) || 0,
      descripcion:        form.descripcion,
      encargado:          form.encargado,
      planta:             form.planta,
      numeroGuiaEmision:  form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      montoPagado:        inicial.montoPagado,
      estadoPago:         inicial.estadoPago,
      ordenCompra:        ocVinculada?._id || null,
    };
    if (form.fechaCancelacion) payload.fechaCancelacion = form.fechaCancelacion;
    if (form.empresa)          payload.empresa          = form.empresa;
    if (!payload.ordenCompra)  delete payload.ordenCompra;

    const res = await fetchAuth(`/facturas/${inicial._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      onGuardada(await res.json());
    } else {
      setError("No se pudo guardar los cambios.");
    }
    setGuardando(false);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800">Modificar factura</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{inicial.codigo}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° de factura</label>
              <input name="numeroFactura" value={form.numeroFactura} onChange={handleChange}
                placeholder="Ej. F001-00123" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° Orden de Compra</label>
              {ocVinculada ? (
                <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs text-blue-600 flex-1">
                    {ocVinculada.codigo}{ocVinculada.numeroOrden ? ` · ${ocVinculada.numeroOrden}` : ""}
                  </span>
                  <button onClick={() => setBOC(true)}
                    className="text-xs text-gray-400 hover:text-blue-600 underline shrink-0">Cambiar</button>
                  <button onClick={() => setOC(null)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none">✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => setBOC(true)}
                  className="w-full text-xs border border-dashed border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 text-blue-600 hover:text-blue-800 transition text-left">
                  + Buscar OC existente
                </button>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha emisión</label>
              <input value={inicial.fechaEmision
                ? new Date(inicial.fechaEmision).toLocaleDateString("es-PE") : "—"}
                disabled className={INP_RO} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha cancelación</label>
              <input type="date" name="fechaCancelacion" value={form.fechaCancelacion}
                onChange={handleChange} className={INP} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Empresa</label>
              <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                <option value="">— Sin empresa —</option>
                {empresas.map(e => (
                  <option key={e._id} value={e._id}>{e.alias ? `${e.alias} — ` : ""}{e.razonSocial}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cálculos */}
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Subtotal sin IGV</label>
              <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                step="0.01" min="0" placeholder="0.00" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">IGV 18%</label>
              <input value={calc.igv.toFixed(2)} disabled className={INP_DIS} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Total</label>
              <input value={calc.total.toFixed(2)} disabled className={INP_DIS} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Detracción (12%)</label>
              <input value={calc.detraccion.toFixed(2)} disabled className={INP_DIS} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Total a pagar</label>
              <input value={calc.totalAPagar.toFixed(2)} disabled className={`${INP_DIS} font-semibold`} />
            </div>
          </div>

          {/* Descripción y personal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Descripción</label>
              <input name="descripcion" value={form.descripcion} onChange={handleChange}
                placeholder="—" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Encargado</label>
              <input name="encargado" value={form.encargado} onChange={handleChange}
                placeholder="—" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Planta</label>
              {plantasEmpresa.length > 0 ? (
                <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                  <option value="">— Seleccionar planta —</option>
                  {plantasEmpresa.map((p, i) => (
                    <option key={i} value={p.nombre}>{p.nombre}</option>
                  ))}
                </select>
              ) : (
                <input name="planta" value={form.planta} onChange={handleChange}
                  placeholder="—" className={INP} />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° guía de llegada</label>
              <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange}
                placeholder="—" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° guía de salida</label>
              <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange}
                placeholder="—" className={INP} />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
          <button onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>

    {buscadorOC && <BuscadorOrdenCompra onSelect={seleccionarOC} onClose={() => setBOC(false)} />}
    </>
  );
}
