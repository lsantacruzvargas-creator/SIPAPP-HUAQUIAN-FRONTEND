import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import { calcSubtotal, itemInvalido } from "../utils/cotizacionItems";
import TablaItemsCotizacion from "./TablaItemsCotizacion";
import { FlujoNegocio, TarjetaRelacion, money } from "./detalleShared";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 w-full transition";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  return { subtotal: s, igv, total: Math.round((s + igv) * 100) / 100 };
}

const FORM_VACIO = {
  empresa: "", tipo: "venta", numeroCotizacion: "", atencion: "",
  fecha: new Date().toISOString().split("T")[0], fechaRecibida: "",
  titulo: "", encargado: "", planta: "", condicionPago: "",
  plazoEntrega: "", lugarEntrega: "", validezOferta: "",
  numeroGuiaEmision: "", numeroGuiaRemision: "", codigoSap: "", fechaSalida: "",
  subtotal: "", moneda: "PEN",
};

const PASOS_VACIOS = [
  { tipo: "ot", activo: false },
  { tipo: "informe", activo: false },
  { tipo: "oc", activo: false },
  { tipo: "factura", activo: false },
];

// Cotización "en frío": se crea sin partir de ninguna Orden de Trabajo (se
// cotiza antes de inspeccionar el equipo). Reutiliza TablaItemsCotizacion
// para el catálogo de servicios; "Generar OT" queda deshabilitado aquí
// (seleccionables=false) porque la cotización aún no tiene `_id`.
//
// El shell (header degradado + stepper + panel de Relaciones) replica el
// de DetalleCotizacion.jsx a propósito, para que crear y ver/editar una
// cotización se sientan como la misma pantalla — antes esto era un modal
// centrado sin ese diseño.
export default function ModalNuevaCotizacion({ onClose, onCreada }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [items, setItems] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(d => setEmpresas(d || []));
    fetchAuth("/cotizaciones/siguiente-numero-cotizacion").then(r =>
      r.ok && r.json().then(d => setForm(f => ({ ...f, numeroCotizacion: d.siguiente })))
    );
  }, []);

  const empresaSel = empresas.find(e => e._id === form.empresa);
  const plantasEmpresa = empresaSel?.plantas ?? [];
  const plantaSel = plantasEmpresa.find(p => p.nombre === form.planta);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value, ...(name === "empresa" ? { planta: "" } : {}) }));
  };

  const subtotalItems = parseFloat(items.reduce((acc, i) => acc + calcSubtotal(i), 0).toFixed(2));
  const usarTotalesDeItems = items.length > 0;
  const totalesMostrados = usarTotalesDeItems ? calcular(subtotalItems) : calcular(form.subtotal);

  const guardar = async () => {
    setIntentoGuardar(true);
    if (!form.titulo.trim()) return setError("El título / descripción es obligatorio.");
    if (items.some(itemInvalido)) {
      return setError("Hay ítems con campos obligatorios sin completar (descripción, cantidad o precio). Corrígelos antes de guardar — resaltados en rojo.");
    }
    setError(""); setGuardando(true);

    const payload = {
      tipo: form.tipo,
      condicionPago: form.condicionPago,
      titulo: form.titulo,
      numeroCotizacion: form.numeroCotizacion,
      atencion: form.atencion,
      encargado: form.encargado,
      planta: form.planta,
      plazoEntrega: form.plazoEntrega,
      lugarEntrega: form.lugarEntrega,
      validezOferta: form.validezOferta,
      moneda: form.moneda,
      subtotal: totalesMostrados.subtotal,
      igv: totalesMostrados.igv,
      total: totalesMostrados.total,
      numeroGuiaEmision: form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      codigoSap: form.codigoSap,
      fechaSalida: form.fechaSalida || null,
      items: items.map(i => {
        const it = {
          descripcion: i.descripcion, cantidad: i.cantidad, precio: i.precio,
          moneda: i.moneda, subtotal: calcSubtotal(i),
        };
        if (i.subItems?.length > 0) it.subItems = i.subItems.map(s => s.texto).filter(Boolean);
        return it;
      }),
    };
    if (form.empresa) payload.empresa = form.empresa;
    if (form.fecha) payload.fecha = form.fecha;
    if (form.fechaRecibida) payload.fechaRecibida = form.fechaRecibida;

    const res = await fetchAuth("/cotizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const nueva = await res.json();
      onCreada?.(nueva);
    } else {
      setError("Error al crear la cotización.");
      setGuardando(false);
    }
  };

  const pasos = [{ tipo: "cotizacion", activo: true, codigo: "Nueva" }, ...PASOS_VACIOS];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-sky-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose}
              className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
              <span className="group-hover:-translate-x-0.5 transition">←</span> Cotizaciones
            </button>
            <span className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Cotización</p>
              <h1 className="text-lg font-bold font-mono leading-tight">
                {form.numeroCotizacion || "Nueva Cotización"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Total</p>
              <p className="text-lg font-bold leading-tight">{money(totalesMostrados.total, form.moneda)}</p>
            </div>
            <button onClick={guardar} disabled={guardando}
              className="bg-white text-sky-700 text-sm px-5 py-2 rounded-lg hover:bg-sky-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
              {guardando ? "Creando…" : "Crear Cotización"}
            </button>
          </div>
        </div>
      </div>

      {/* Stepper de flujo */}
      <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-8 py-5">
          <FlujoNegocio pasos={pasos} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Datos editables */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-sky-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la cotización</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° Cotización</label>
                <input name="numeroCotizacion" value={form.numeroCotizacion} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Empresa</label>
              <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                <option value="">— Sin empresa —</option>
                {empresas.map(e => (
                  <option key={e._id} value={e._id}>{e.alias ? `${e.alias} — ` : ""}{e.razonSocial}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Planta</label>
                {plantasEmpresa.length > 0 ? (
                  <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                    <option value="">— Seleccionar planta —</option>
                    {plantasEmpresa.map((p, i) => <option key={i} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                ) : (
                  <input name="planta" value={form.planta} onChange={handleChange} placeholder="Planta o sede" className={INP} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4" hidden>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Encargado</label>
                <input name="encargado" value={form.encargado} onChange={handleChange} placeholder="Nombre del encargado" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Atención</label>
                <input name="atencion" value={form.atencion} onChange={handleChange} placeholder="Ej. Área de Compras" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} className={INP}>
                  <option value="venta">Venta</option>
                  <option value="servicio">Servicio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Moneda de la cotización</label>
                <select name="moneda" value={form.moneda} onChange={handleChange} className={INP}>
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares (US$)</option>
                </select>
              </div>
            </div>

            {plantaSel?.contactoNombre && (
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">Contacto de la planta</p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{plantaSel.contactoNombre}</span>
                  {(plantaSel.contactoTelefono || plantaSel.contactoCorreo) && (
                    <span className="text-gray-500"> — {[plantaSel.contactoTelefono, plantaSel.contactoCorreo].filter(Boolean).join(" · ")}</span>
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Título / Descripción</label>
              <input name="titulo" value={form.titulo} onChange={handleChange} placeholder="Descripción de la cotización" className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Forma de pago</label>
                <input name="condicionPago" value={form.condicionPago} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">Fecha recibida</label>
                <input type="date" name="fechaRecibida" value={form.fechaRecibida} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plazo de entrega</label>
                <input name="plazoEntrega" value={form.plazoEntrega} onChange={handleChange} placeholder="Ej. 2 días de recibida su O/C." className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Lugar de entrega</label>
                <input name="lugarEntrega" value={form.lugarEntrega} onChange={handleChange} placeholder="Ej. Planta Chilca" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Validez de la oferta</label>
                <input name="validezOferta" value={form.validezOferta} onChange={handleChange} placeholder="Ej. 15 días" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4" hidden>
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° guía de llegada</label>
                <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° guía de salida</label>
                <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
                <input name="codigoSap" value={form.codigoSap} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
                <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
              </div>
            </div>

            {/* Cálculos */}
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-sky-50/40 border border-gray-100 p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Subtotal sin IGV
                  {usarTotalesDeItems && <span className="text-gray-400 font-normal"> (calculado desde Ítems)</span>}
                </label>
                {usarTotalesDeItems ? (
                  <p className={`${INP} text-lg font-semibold bg-gray-50 text-gray-700 border-transparent`}>
                    {totalesMostrados.subtotal.toFixed(2)}
                  </p>
                ) : (
                  <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                    step="0.01" min="0" placeholder="0.00" className={`${INP} text-lg font-semibold`} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-400">IGV 18%</p>
                  <p className="font-semibold text-gray-700">{totalesMostrados.igv.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold text-gray-700">{totalesMostrados.total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            <TarjetaRelacion tipo="cotizacion" codigo="Nueva" numero={form.numeroCotizacion} actual>
              <p className="text-sm text-gray-600 line-clamp-2">{form.titulo || "—"}</p>
            </TarjetaRelacion>
            <TarjetaRelacion tipo="ot" vacio />
            <TarjetaRelacion tipo="informe" vacio />
            <TarjetaRelacion tipo="oc" vacio />
            <TarjetaRelacion tipo="factura" vacio />
          </section>
        </div>

        {/* Ítems — ancho completo, debajo de Datos + Relaciones */}
        <div className="max-w-6xl mx-auto px-8 pb-8">
          <TablaItemsCotizacion
            items={items}
            onItemsChange={setItems}
            tipo={form.tipo}
            puedeEditar
            disabled={false}
            intentoGuardar={intentoGuardar}
            totalesMostrados={totalesMostrados}
            seleccionables={false}
          />
        </div>
      </div>
    </div>
  );
}
