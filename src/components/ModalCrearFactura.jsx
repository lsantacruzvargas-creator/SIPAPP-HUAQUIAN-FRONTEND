import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const INP     = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_DIS = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full";

// Empresa emisora y serie fijas — Huaquian solo factura a su propio nombre
// ante SUNAT (el hub central resuelve las credenciales por RUC, ver
// Backend/src/services/hub.service.js). Deben coincidir con RUC_EMISOR /
// RAZON_SOCIAL_EMISOR de Backend/.env. Serie terminada en "2", igual que
// EmitirComprobante.jsx, para evitar conflictos de correlativo con series
// de prueba/históricas.
const RUC_EMISOR = "20601565235";
const NOMBRE_EMISOR = "HUAQUIAN";
const SERIE_FACTURA = "F002";

function calcular(subtotal, descuentoPct) {
  const sub = Math.round(Number(subtotal) * 100) / 100 || 0;
  const desc = Number(descuentoPct) || 0;
  const base = Math.round(sub * (1 - desc / 100) * 100) / 100;
  const igv = Math.round(base * 0.18 * 100) / 100;
  const total = Math.round((base + igv) * 100) / 100;
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = total >= 701 ? Math.round(total * 0.12) : 0;
  return { base, igv, total, detraccion, totalAPagar: Math.round((total - detraccion) * 100) / 100 };
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

// Este modal emite siempre la Factura SUNAT real (POST /cpe/factura — mismo
// endpoint y correlativo atómico que "Emitir CPE") y, si la emisión no es
// rechazada, crea además el registro interno Factura (POST /facturas) con
// ese mismo número — igual que ModalFactura.jsx en SIPAPP-IMAQUITEC.
export default function ModalCrearFactura({ onClose, onCreada, ocInicial }) {
  const hoy = new Date().toISOString().split("T")[0];
  // Si viene una OC ya conocida (p.ej. al crear la Factura desde la tarjeta
  // vacía de una OC), se precarga como si se hubiera buscado y seleccionado
  // manualmente — sin useEffect, para no disparar un setState en el montaje.
  const [form, setForm] = useState(() => {
    const base = {
      numeroOrdenCompra: "",
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
  const [calc, setCalc]           = useState(() => calcular(ocInicial?.subtotal > 0 ? ocInicial.subtotal : 0, 0));
  const [ocVinculada, setOcVinc]  = useState(ocInicial || null);
  const [empresas, setEmpresas]   = useState([]);
  const [buscadorOC, setBOC]      = useState(false);
  const [formaPago, setFormaPago] = useState("Contado");
  const [cuotas, setCuotas]       = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [exito, setExito]         = useState(null);

  const cambiarFormaPago = (v) => {
    setFormaPago(v);
    if (v === "Credito" && cuotas.length === 0) {
      setCuotas([{ _key: Date.now(), monto: "", fechaVencimiento: "" }]);
    }
  };
  const agregarCuota = () => setCuotas([...cuotas, { _key: Date.now() + Math.random(), monto: "", fechaVencimiento: "" }]);
  const eliminarCuota = (key) => setCuotas(cuotas.filter((c) => c._key !== key));
  const handleCuota = (key, campo, valor) =>
    setCuotas(cuotas.map((c) => (c._key === key ? { ...c, [campo]: valor } : c)));
  const sumaCuotas = cuotas.reduce((s, c) => s + (Number(c.monto) || 0), 0);

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(d => setEmpresas(d || []));
  }, []);

  const plantasEmpresa = empresas.find(e => e._id === form.empresa)?.plantas ?? [];
  const empresaSeleccionada = empresas.find(e => e._id === form.empresa) ?? null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "subtotal" || name === "descuentoPorcentaje") {
      setCalc(calcular(
        name === "subtotal" ? value : form.subtotal,
        name === "descuentoPorcentaje" ? value : form.descuentoPorcentaje,
      ));
    }
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "" } : {}),
    }));
  };

  const seleccionarOC = (oc) => {
    setOcVinc(oc);
    setBOC(false);
    setForm(prev => {
      const nuevoSub = prev.subtotal || (oc.subtotal > 0 ? String(oc.subtotal) : prev.subtotal);
      if (!prev.subtotal && oc.subtotal > 0) setCalc(calcular(oc.subtotal, prev.descuentoPorcentaje));
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

  // Resuelve la OC vinculada (o crea una nueva) — paso previo a la emisión
  // SUNAT, para que la Factura nazca con `ordenCompra` ya seteado (así
  // hereda su numeroDocumento).
  const resolverOrdenCompra = async () => {
    if (ocVinculada) return { ocId: ocVinculada._id };

    const ocPayload = {
      titulo:      form.descripcion || "por definir",
      numeroOrden: form.numeroOrdenCompra || "",
      subtotal:    Number(form.subtotal),
      igv:         calc.igv,
      total:       calc.total,
      monto:       Number(form.subtotal),
      descripcion: form.descripcion,
      planta:      form.planta,
      encargado:   form.encargado,
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

  const guardar = async () => {
    if (!form.descripcion.trim()) return setError("La descripción es obligatoria.");
    if (!form.subtotal || Number(form.subtotal) <= 0) return setError("El valor unitario debe ser mayor a 0.");
    if (!empresaSeleccionada?.ruc || !/^\d{11}$/.test(empresaSeleccionada.ruc))
      return setError("La empresa seleccionada no tiene un RUC válido — la factura SUNAT requiere un receptor con RUC.");
    if (formaPago === "Credito") {
      if (cuotas.length === 0) return setError("Agrega al menos una cuota de pago para el crédito.");
      for (const c of cuotas) {
        if (!c.monto || Number(c.monto) <= 0) return setError("Cada cuota debe tener un monto mayor a 0.");
        if (!c.fechaVencimiento) return setError("Cada cuota debe tener una fecha de vencimiento.");
      }
      if (Math.abs(sumaCuotas - calc.total) >= 0.01) {
        return setError(`La suma de las cuotas (S/ ${sumaCuotas.toFixed(2)}) debe ser igual al total (S/ ${calc.total.toFixed(2)}).`);
      }
    }
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
        formaPago,
        ...(formaPago === "Credito" && cuotas.length ? {
          cuotas: cuotas.map((c, idx) => ({
            numero: idx + 1,
            monto: Number(c.monto),
            fechaVencimiento: c.fechaVencimiento,
          })),
        } : {}),
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
      subtotal:           calc.base,
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
    // No se reactiva `guardando`: el botón queda deshabilitado durante el
    // mensaje de éxito, evitando una segunda creación por doble click.
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-800">Nueva Factura</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Datos fijos de emisión SUNAT — autocompletados internamente */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Emisión SUNAT</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <input value="Factura" disabled className={INP_DIS} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Serie</label>
                <input value={SERIE_FACTURA} disabled className={INP_DIS} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Empresa emisora</label>
                <input value={`${NOMBRE_EMISOR} — RUC ${RUC_EMISOR}`} disabled className={INP_DIS} />
              </div>
            </div>
          </div>

          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-4">
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
              <label className="text-xs text-gray-500 block mb-1">Empresa (receptor SUNAT) *</label>
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
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valor unitario sin IGV *</label>
              <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                step="0.01" min="0" placeholder="0.00" className={INP} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descuento %</label>
              <input type="number" name="descuentoPorcentaje" value={form.descuentoPorcentaje} onChange={handleChange}
                step="0.01" min="0" max="100" className={INP} />
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

          {/* Forma de pago — igual que "Emitir CPE": Crédito exige cuotas con fecha de
              vencimiento (SUNAT rechaza con error 3249 si falta la info de cuotas). */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Forma de pago</label>
            <div className="flex gap-3">
              {["Contado", "Credito"].map((v) => (
                <button
                  key={v} type="button"
                  onClick={() => cambiarFormaPago(v)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    formaPago === v
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  }`}
                >
                  {v === "Contado" ? "Contado" : "Crédito"}
                </button>
              ))}
            </div>
          </div>

          {formaPago === "Credito" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Cuotas de pago</label>
                <span className="text-xs text-gray-400">Total: S/ {calc.total.toFixed(2)}</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left w-20">Cuota</th>
                      <th className="px-3 py-2 text-left">Monto</th>
                      <th className="px-3 py-2 text-left">Fecha de vencimiento</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cuotas.map((c, idx) => (
                      <tr key={c._key}>
                        <td className="px-3 py-2 text-gray-400">Cuota{String(idx + 1).padStart(3, "0")}</td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={c.monto}
                            onChange={(e) => handleCuota(c._key, "monto", e.target.value)}
                            required className={INP} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" value={c.fechaVencimiento}
                            onChange={(e) => handleCuota(c._key, "fechaVencimiento", e.target.value)}
                            required className={INP} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => eliminarCuota(c._key)} className="text-red-400 hover:text-red-600">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <button type="button" onClick={agregarCuota} className="text-sm text-gray-500 hover:text-gray-700 transition">
                    + Agregar cuota
                  </button>
                  <span className={`text-xs font-medium ${Math.abs(sumaCuotas - calc.total) < 0.01 ? "text-green-600" : "text-red-500"}`}>
                    Suma de cuotas: S/ {sumaCuotas.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

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
            {guardando ? "Emitiendo…" : "Emitir y crear factura"}
          </button>
        </div>
      </div>
    </div>

    {buscadorOC && <BuscadorOrdenCompra onSelect={seleccionarOC} onClose={() => setBOC(false)} />}
    </>
  );
}
