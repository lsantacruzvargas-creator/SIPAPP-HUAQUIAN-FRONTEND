import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP     = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_DIS = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full";

// Empresa emisora fija para la emisión electrónica SUNAT. Las credenciales
// SUNAT las resuelve el hub central por RUC (Backend/src/services/hub.service.js)
// — este ERP no guarda ningún registro de credenciales.
// TODO: RUC/razón social/serie reales pendientes de configurar (deben coincidir
// con RUC_EMISOR/RAZON_SOCIAL_EMISOR del backend) antes de usar el toggle
// "Emitir factura electrónica SUNAT" contra SUNAT de verdad.
const RUC_EMISOR = "00000000000";
const NOMBRE_EMISOR = "HUAQUIAN (RUC pendiente de configurar)";
const SERIE_FACTURA = "F001";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  const total = Math.round((s + igv) * 100) / 100;
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = total >= 701 ? Math.round(total * 0.12) : 0;
  return { igv, total, detraccion, totalAPagar: Math.round((total - detraccion) * 100) / 100 };
}

// Base facturable: con el toggle SUNAT activo se factura el subtotal ya neto
// del descuento (igual que el ítem del CPE); en modo manual no hay descuento.
function baseFacturable(subtotal, descuentoPorcentaje, emitirSunat) {
  const sub = Number(subtotal) || 0;
  if (!emitirSunat) return sub;
  const desc = Number(descuentoPorcentaje) || 0;
  return Math.round(sub * (1 - desc / 100) * 100) / 100;
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

export default function ModalCrearFactura({ onClose, onCreada, ocInicial }) {
  const hoy = new Date().toISOString().split("T")[0];
  // Si viene una OC ya conocida (p.ej. al crear la Factura desde la tarjeta
  // vacía de una OC), se precarga como si se hubiera buscado y seleccionado
  // manualmente — sin useEffect, para no disparar un setState en el montaje.
  const [form, setForm] = useState(() => {
    const base = {
      numeroFactura: "", numeroOrdenCompra: "",
      fechaEmision: hoy, fechaCancelacion: "",
      empresa: "", subtotal: "", descuentoPorcentaje: "0", descripcion: "",
      encargado: "", planta: "", numeroGuiaEmision: "", numeroGuiaRemision: "",
    };
    if (!ocInicial) return base;
    return {
      ...base,
      numeroOrdenCompra:  ocInicial.numeroOrden || "",
      empresa:            ocInicial.empresa?._id || "",
      subtotal:           ocInicial.subtotal > 0 ? String(ocInicial.subtotal) : "",
      descripcion:        ocInicial.descripcion || ocInicial.titulo || "",
      planta:             ocInicial.planta || "",
      encargado:          ocInicial.encargado || "",
      numeroGuiaEmision:  ocInicial.numeroGuiaEmision || "",
      numeroGuiaRemision: ocInicial.numeroGuiaRemision || "",
    };
  });
  // Emitir vía SUNAT es el modo por defecto; el toggle permite volver al
  // registro manual de siempre (sin llamar a /cpe/factura) para casos que no
  // requieren comprobante electrónico.
  const [emitirSunat, setEmitirSunat] = useState(true);
  const [calc, setCalc]           = useState(() => calcular(baseFacturable(ocInicial?.subtotal > 0 ? ocInicial.subtotal : 0, 0, true)));
  const [ocVinculada, setOcVinc]  = useState(ocInicial || null);
  const [empresas, setEmpresas]   = useState([]);
  const [buscadorOC, setBOC]      = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [exito, setExito]         = useState(null);

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(d => setEmpresas(d || []));
  }, []);

  const plantasEmpresa = empresas.find(e => e._id === form.empresa)?.plantas ?? [];
  const empresaSeleccionada = empresas.find(e => e._id === form.empresa) ?? null;

  const recalcular = (subtotal, descuento, sunat) => {
    setCalc(calcular(baseFacturable(subtotal, descuento, sunat)));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "subtotal" || name === "descuentoPorcentaje") {
      recalcular(
        name === "subtotal" ? value : form.subtotal,
        name === "descuentoPorcentaje" ? value : form.descuentoPorcentaje,
        emitirSunat
      );
    }
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const toggleSunat = () => {
    setEmitirSunat(prev => {
      const next = !prev;
      recalcular(form.subtotal, form.descuentoPorcentaje, next);
      return next;
    });
  };

  const seleccionarOC = (oc) => {
    setOcVinc(oc);
    setBOC(false);
    setForm(prev => {
      const nuevoSub = prev.subtotal || (oc.subtotal > 0 ? String(oc.subtotal) : prev.subtotal);
      if (!prev.subtotal && oc.subtotal > 0) recalcular(oc.subtotal, prev.descuentoPorcentaje, emitirSunat);
      return {
        ...prev,
        numeroOrdenCompra:  oc.numeroOrden   || prev.numeroOrdenCompra,
        empresa:            prev.empresa     || oc.empresa?._id || "",
        subtotal:           nuevoSub,
        descripcion:        prev.descripcion || oc.descripcion  || oc.titulo || "",
        planta:             prev.planta      || oc.planta       || "",
        encargado:          prev.encargado   || oc.encargado    || "",
        numeroGuiaEmision:  prev.numeroGuiaEmision  || oc.numeroGuiaEmision  || "",
        numeroGuiaRemision: prev.numeroGuiaRemision || oc.numeroGuiaRemision || "",
      };
    });
  };

  // Resuelve la OC vinculada (o crea una nueva) — paso compartido por el
  // registro manual y por la emisión SUNAT, para que la Factura nazca con
  // `ordenCompra` ya seteado (así hereda su numeroDocumento).
  const resolverOrdenCompra = async () => {
    if (ocVinculada) return { ocId: ocVinculada._id };

    const ocPayload = {
      titulo:        form.descripcion || "por definir",
      numeroOrden:   form.numeroOrdenCompra || "",
      numeroFactura: form.numeroFactura,
      subtotal:      Number(form.subtotal),
      igv:           calc.igv,
      total:         calc.total,
      monto:         Number(form.subtotal),
      descripcion:   form.descripcion,
      planta:        form.planta,
      encargado:     form.encargado,
    };
    if (form.empresa) ocPayload.empresa = form.empresa;
    const resOC = await fetchAuth("/ordenes-compra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ocPayload),
    });
    if (!resOC.ok) return { error: "No se pudo crear la orden de compra." };
    const newOC = await resOC.json();
    return { ocId: newOC._id };
  };

  const guardarManual = async () => {
    if (!form.numeroFactura.trim()) return setError("El N° de factura es obligatorio.");
    if (!form.subtotal || Number(form.subtotal) <= 0) return setError("El subtotal debe ser mayor a 0.");
    setError(""); setGuardando(true);

    const { ocId, error: errorOC } = await resolverOrdenCompra();
    if (errorOC) { setError(errorOC); setGuardando(false); return; }

    const factPayload = {
      numeroFactura:      form.numeroFactura,
      fechaEmision:       form.fechaEmision,
      subtotal:           Number(form.subtotal),
      descripcion:        form.descripcion,
      encargado:          form.encargado,
      planta:             form.planta,
      numeroGuiaEmision:  form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      ordenCompra:        ocId,
    };
    if (form.fechaCancelacion) factPayload.fechaCancelacion = form.fechaCancelacion;
    if (form.empresa)          factPayload.empresa          = form.empresa;
    if (ocVinculada) {
      factPayload.codigoSap   = ocVinculada.codigoSap;
      factPayload.fechaSalida = ocVinculada.fechaSalida;
    }

    const resF = await fetchAuth("/facturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(factPayload),
    });
    if (!resF.ok) {
      setError("No se pudo guardar la factura.");
      setGuardando(false);
      return;
    }
    const factura = await resF.json();

    setExito(factura.codigo);
    setTimeout(() => onCreada(factura), 1800);
    // No se reactiva `guardando`: el botón queda deshabilitado durante el
    // mensaje de éxito, evitando una segunda creación por doble click.
  };

  const guardarConSunat = async () => {
    if (!form.descripcion.trim()) return setError("La descripción es obligatoria.");
    if (!form.subtotal || Number(form.subtotal) <= 0) return setError("El subtotal debe ser mayor a 0.");
    if (!empresaSeleccionada?.ruc || !/^\d{11}$/.test(empresaSeleccionada.ruc))
      return setError("La empresa seleccionada no tiene un RUC válido — la factura SUNAT requiere un receptor con RUC.");
    setError(""); setGuardando(true);

    const { ocId, error: errorOC } = await resolverOrdenCompra();
    if (errorOC) { setError(errorOC); setGuardando(false); return; }

    // Paso 1: emitir la Factura SUNAT real (correlativo atómico vía SerieCorrelativo).
    const resCpe = await fetchAuth("/cpe/factura", {
      method: "POST",
      body: JSON.stringify({
        tipoDoc: "01",
        serie: SERIE_FACTURA,
        rucEmisor: RUC_EMISOR,
        receptor: { numDoc: empresaSeleccionada.ruc, nombre: empresaSeleccionada.razonSocial, schemeID: "6" },
        items: [{
          descripcion: form.descripcion.trim(),
          cantidad: 1,
          unidad: "ZZ",
          valorUnitario: Number(form.subtotal),
          precioUnitario: Math.round(Number(form.subtotal) * 1.18 * 100) / 100,
          afectacion: "10",
          descuentoPorcentaje: (Number(form.descuentoPorcentaje) || 0) / 100,
        }],
        formaPago: "Contado",
        moneda: "PEN",
        numeroOrdenCompra: form.numeroOrdenCompra || "",
        ordenCompra: ocId,
      }),
    });
    const dataCpe = await resCpe.json();
    if (!dataCpe.ok) {
      setError(dataCpe.mensaje || dataCpe.error || "SUNAT rechazó el comprobante.");
      setGuardando(false);
      return;
    }

    // Paso 2: crear el registro interno Factura con el número real ya emitido.
    const factPayload = {
      numeroFactura:      dataCpe.serie,
      fechaEmision:       form.fechaEmision,
      subtotal:           baseFacturable(form.subtotal, form.descuentoPorcentaje, true),
      descripcion:        form.descripcion,
      encargado:          form.encargado,
      planta:             form.planta,
      numeroGuiaEmision:  form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      ordenCompra:        ocId,
      empresa:            form.empresa,
    };
    if (form.fechaCancelacion) factPayload.fechaCancelacion = form.fechaCancelacion;
    if (ocVinculada) {
      factPayload.codigoSap   = ocVinculada.codigoSap;
      factPayload.fechaSalida = ocVinculada.fechaSalida;
    }

    const resF = await fetchAuth("/facturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(factPayload),
    });
    if (!resF.ok) {
      setError(`La factura SUNAT ${dataCpe.serie} se emitió correctamente, pero no se pudo crear el registro interno. Verifica manualmente.`);
      setGuardando(false);
      return;
    }
    const factura = await resF.json();

    setExito(factura.codigo);
    setTimeout(() => onCreada(factura), 1800);
  };

  const guardar = () => (emitirSunat ? guardarConSunat() : guardarManual());

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-800">Nueva Factura</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Toggle emisión SUNAT vs registro manual */}
          <label className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 cursor-pointer">
            <input type="checkbox" checked={emitirSunat} onChange={toggleSunat} className="w-4 h-4" />
            <div>
              <p className="text-sm font-medium text-gray-800">Emitir factura electrónica SUNAT</p>
              <p className="text-xs text-gray-500">
                {emitirSunat
                  ? "Se emite un comprobante real ante SUNAT y el N° de factura se asigna automáticamente."
                  : "Se registra solo en el ERP, sin comprobante electrónico — el N° de factura se ingresa a mano."}
              </p>
            </div>
          </label>

          {emitirSunat && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p><strong>Empresa emisora:</strong> {NOMBRE_EMISOR} — RUC {RUC_EMISOR}</p>
              <p><strong>Serie:</strong> {SERIE_FACTURA} · <strong>Tipo:</strong> Factura (01)</p>
            </div>
          )}

          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-4">
            {!emitirSunat && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° Factura *</label>
                <input name="numeroFactura" value={form.numeroFactura} onChange={handleChange}
                  placeholder="Ej. F001-00123" className={INP} />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° Orden de Compra</label>
              {ocVinculada ? (
                <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs text-blue-600 flex-1">
                    {ocVinculada.codigo}{ocVinculada.numeroOrden ? ` · ${ocVinculada.numeroOrden}` : ""}
                  </span>
                  <button
                    onClick={() => { setOcVinc(null); setForm(prev => ({ ...prev, numeroOrdenCompra: "" })); }}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none">✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input name="numeroOrdenCompra" value={form.numeroOrdenCompra}
                    placeholder="Ej. OC-2024-001" disabled className={INP_DIS} />
                  <button type="button" onClick={() => setBOC(true)}
                    className="shrink-0 text-xs border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap transition">
                    Buscar OC
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha emisión</label>
              <input type="date" name="fechaEmision" value={form.fechaEmision} onChange={handleChange} className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha cancelación</label>
              <input type="date" name="fechaCancelacion" value={form.fechaCancelacion} onChange={handleChange} className={INP} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Empresa{emitirSunat ? " (receptor SUNAT) *" : ""}</label>
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
            <div className={emitirSunat ? "" : "col-span-2"}>
              <label className="text-xs text-gray-500 block mb-1">
                {emitirSunat ? "Valor unitario sin IGV *" : "Subtotal sin IGV *"}
              </label>
              <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                step="0.01" min="0" placeholder="0.00" className={INP} />
            </div>
            {emitirSunat && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Descuento %</label>
                <input type="number" name="descuentoPorcentaje" value={form.descuentoPorcentaje} onChange={handleChange}
                  step="0.01" min="0" max="100" className={INP} />
              </div>
            )}
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
                placeholder="Descripción del trabajo…" className={INP} />
            </div>
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
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° guía de llegada</label>
              <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange} placeholder="—" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">N° guía de salida</label>
              <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} placeholder="—" className={INP} />
            </div>
          </div>

          {exito && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Factura <strong>{exito}</strong> creada exitosamente.
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
          <button onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition font-medium">
            {guardando ? (emitirSunat ? "Emitiendo…" : "Guardando…") : (emitirSunat ? "Emitir y crear factura" : "Crear factura")}
          </button>
        </div>
      </div>
    </div>

    {buscadorOC && <BuscadorOrdenCompra onSelect={seleccionarOC} onClose={() => setBOC(false)} />}
    </>
  );
}
