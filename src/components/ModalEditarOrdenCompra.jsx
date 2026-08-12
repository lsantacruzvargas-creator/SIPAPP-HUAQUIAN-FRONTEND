import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP     = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_RO  = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";
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

function BuscadorCotizacion({ onSelect, onClose }) {
  const [lista, setLista] = useState([]);
  const [q, setQ]         = useState("");
  useEffect(() => {
    fetchAuth("/cotizaciones").then(r => r.ok && r.json()).then(d => setLista(d || []));
  }, []);
  const filtradas = lista.filter(c => !q ||
    [c.codigo, c.titulo, c.empresa?.razonSocial]
      .some(v => v?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800">Buscar cotización</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="px-4 pt-4">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Código, título o empresa…" className={INP} />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtradas.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
            : filtradas.map(c => (
              <button key={c._id} onClick={() => onSelect(c)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition">
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-blue-600">{c.codigo}</span>
                  <span className="text-xs text-gray-400">S/ {Number(c.total ?? 0).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{c.titulo}</p>
                {c.empresa && <p className="text-xs text-gray-400">{c.empresa.razonSocial}</p>}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function PanelIngresoEquipo({ ie }) {
  if (!ie) return null;
  return (
    <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        Ingreso de equipo · <span className="font-mono">{ie.codigo}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Tipo de equipo</label>
          <input value={ie.tipoEquipo || "—"} disabled className={INP_RO} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Marca / Modelo</label>
          <input value={[ie.marca, ie.modelo].filter(Boolean).join(" / ") || "—"} disabled className={INP_RO} />
        </div>
        {ie.planta && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Planta</label>
            <input value={ie.planta} disabled className={INP_RO} />
          </div>
        )}
        {ie.fechaIngreso && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Fecha de ingreso</label>
            <input value={new Date(ie.fechaIngreso).toLocaleDateString("es-PE")} disabled className={INP_RO} />
          </div>
        )}
        {ie.caracteristicasElectricas && (
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Características eléctricas</label>
            <input value={ie.caracteristicasElectricas} disabled className={INP_RO} />
          </div>
        )}
        {ie.descripcionProblema && (
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Descripción del problema</label>
            <textarea value={ie.descripcionProblema} disabled rows={2} className={`${INP_RO} resize-none`} />
          </div>
        )}
        {ie.numeroGuiaEmision && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">N° guía de remisión</label>
            <input value={ie.numeroGuiaEmision} disabled className={`${INP_RO} font-mono`} />
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

export default function ModalEditarOrdenCompra({ orden, onClose, onGuardada }) {
  const subtotalInicial = orden.subtotal ?? orden.monto ?? 0;

  const [form, setForm] = useState({
    numeroOrden:   orden.numeroOrden   || "",
    numeroFactura: orden.numeroFactura || "",
    empresa:       orden.empresa?._id  || "",
    titulo:        orden.titulo        || "",
    subtotal:      subtotalInicial > 0 ? String(subtotalInicial) : "",
    descripcion:   orden.descripcion   || "",
    encargado:     orden.encargado     || "",
    planta:        orden.planta        || "",
  });
  const [calc, setCalc]             = useState(calcular(subtotalInicial));
  const [cotVinculada, setCot]      = useState(orden.cotizacion || null);
  const [vinculando, setVinculando] = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");
  const [ie, setIe]                 = useState(null);
  const [buscadorCot, setBCot]      = useState(false);
  const [empresas, setEmpresas]     = useState([]);

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(d => setEmpresas(d || []));
  }, []);

  useEffect(() => {
    fetchAuth("/ordenes-trabajo").then(r => r.ok && r.json()).then(ots => {
      if (!ots) return;
      const ot = ots.find(o => o.cotizacion?._id === orden.cotizacion?._id && o.ingresoEquipo);
      setIe(ot?.ingresoEquipo || null);
    });
  }, [orden.cotizacion?._id]);

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

  const guardar = async () => {
    setGuardando(true); setError("");
    const payload = {
      numeroOrden:   form.numeroOrden,
      numeroFactura: form.numeroFactura,
      titulo:        form.titulo    || "por definir",
      subtotal:      Number(form.subtotal) || 0,
      igv:           calc.igv,
      total:         calc.total,
      monto:         Number(form.subtotal) || 0,
      descripcion:   form.descripcion,
      encargado:     form.encargado,
      planta:        form.planta,
    };
    if (form.empresa) payload.empresa = form.empresa;

    const res = await fetchAuth(`/ordenes-compra/${orden._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { onGuardada(await res.json()); }
    else { setError("Error al guardar los cambios."); }
    setGuardando(false);
  };

  const vincularCotizacion = async (cot) => {
    setBCot(false); setVinculando(true);
    const res = await fetchAuth(`/ordenes-compra/${orden._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cotizacion: cot._id }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setCot(actualizada.cotizacion || cot);
    }
    setVinculando(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] ${ie ? "max-w-4xl" : "max-w-lg"}`}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="font-semibold text-gray-800">Orden de Compra</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{orden.codigo}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex">
            {ie && (
              <div className="w-2/5 overflow-y-auto p-6 border-r border-gray-100 bg-blue-50/10">
                <PanelIngresoEquipo ie={ie} />
              </div>
            )}
            <div className={`${ie ? "w-3/5" : "w-full"} overflow-y-auto p-6 space-y-4`}>

              {/* Cotización vinculada */}
              <div className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Cotización vinculada
                </p>
                {cotVinculada ? (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-blue-600">{cotVinculada.codigo || "—"}</p>
                      <p className="text-sm text-gray-700">{cotVinculada.titulo || "—"}</p>
                    </div>
                    <button onClick={() => setBCot(true)} disabled={vinculando}
                      className="text-xs text-gray-400 hover:text-blue-600 underline shrink-0 disabled:opacity-40">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setBCot(true)} disabled={vinculando}
                    className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-40">
                    {vinculando ? "Vinculando…" : "+ Vincular cotización"}
                  </button>
                )}
              </div>

              {/* Identificación */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">N° de orden</label>
                  <input name="numeroOrden" value={form.numeroOrden} onChange={handleChange}
                    placeholder="Ej. OC-2024-001" className={INP} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">N° de factura</label>
                  <input name="numeroFactura" value={form.numeroFactura} onChange={handleChange}
                    placeholder="Ej. F001-00123" className={INP} />
                </div>
              </div>

              {/* Empresa */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Empresa</label>
                <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                  <option value="">— Sin empresa —</option>
                  {empresas.map(e => (
                    <option key={e._id} value={e._id}>
                      {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                    </option>
                  ))}
                </select>
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

              {/* Título */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Título / Descripción</label>
                <input name="titulo" value={form.titulo} onChange={handleChange}
                  placeholder="Descripción del servicio u obra" className={INP} />
              </div>

              {/* Encargado y Planta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Encargado</label>
                  <input name="encargado" value={form.encargado} onChange={handleChange}
                    placeholder="Nombre del encargado" className={INP} />
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
                      placeholder="Planta o sede" className={INP} />
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
            <button onClick={onClose}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>

      {buscadorCot && (
        <BuscadorCotizacion
          onSelect={vincularCotizacion}
          onClose={() => setBCot(false)}
        />
      )}

    </>
  );
}
