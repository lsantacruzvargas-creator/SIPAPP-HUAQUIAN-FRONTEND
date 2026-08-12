import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import ModalCrearFactura from "./ModalCrearFactura";
import {
  FlujoNegocio, TarjetaRelacion, Chip,
  badgePago, badgeOT, money, BotonAnular, BannerAnulado,
} from "./detalleShared";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full transition";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  const total = Math.round((s + igv) * 100) / 100;
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = total >= 701 ? Math.round(total * 0.12) : 0;
  return { igv, total, detraccion, totalAPagar: Math.round((total - detraccion) * 100) / 100 };
}

export default function DetalleOrdenCompra({ orden, onClose, onGuardada, facturaVinculada, onNavegar }) {
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
    numeroGuiaEmision:  orden.numeroGuiaEmision  || "",
    numeroGuiaRemision: orden.numeroGuiaRemision || "",
    codigoSap:          orden.codigoSap          || "",
    fechaSalida: orden.fechaSalida
      ? new Date(orden.fechaSalida).toISOString().split("T")[0] : "",
  });
  const [calc, setCalc]           = useState(calcular(subtotalInicial));
  const [empresas, setEmpresas]   = useState([]);
  const [ot, setOt]               = useState(null);
  const [informes, setInformes]   = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [cargandoFactura, setCargandoFactura] = useState(false);
  const [crearFacturaOpen, setCrearFacturaOpen] = useState(false);
  const puedeEditar = ["admin", "asistente"].includes(getUsuario()?.rol);

  const abrirFactura = async () => {
    if (!facturaVinculada || cargandoFactura) return;
    setCargandoFactura(true);
    const res = await fetchAuth("/facturas");
    const lista = res.ok ? await res.json() : [];
    const full = lista.find(f => f._id === facturaVinculada._id) || facturaVinculada;
    setCargandoFactura(false);
    onNavegar?.({ tipo: "factura", data: full });
  };

  const cargarOTeInformes = () => {
    const cotId = orden.cotizacion?._id || orden.cotizacion;
    fetchAuth("/ordenes-trabajo").then(r => r.ok && r.json()).then(ots => {
      if (!cotId || !ots) return;
      const found = ots.find(o => (o.cotizacion?._id || o.cotizacion) === cotId);
      setOt(found || null);
      if (found) {
        fetchAuth(`/informes?ordenTrabajo=${found._id}`)
          .then(r => r.ok && r.json())
          .then(infs => setInformes(infs || []));
      }
    });
  };

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(emps => setEmpresas(emps || []));
    cargarOTeInformes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      numeroGuiaEmision:  form.numeroGuiaEmision,
      numeroGuiaRemision: form.numeroGuiaRemision,
      codigoSap:          form.codigoSap,
      fechaSalida:        form.fechaSalida || null,
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

  const anular = async (motivo) => {
    const res = await fetchAuth(`/ordenes-compra/${orden._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) { onGuardada(await res.json()); }
    else { setError("Error al anular el documento."); }
  };

  const cot     = orden.cotizacion;
  const factura = facturaVinculada;
  const ultimo  = informes[informes.length - 1];

  const pasos = [
    { tipo: "cotizacion", activo: !!cot,             codigo: cot?.codigo },
    { tipo: "ot",         activo: !!ot,              codigo: ot?.codigo },
    { tipo: "informe",    activo: informes.length>0, codigo: ultimo?.codigo || (informes.length ? `${informes.length} av.` : "") },
    { tipo: "oc",         activo: true,              codigo: orden.codigo },
    { tipo: "factura",    activo: !!factura,         codigo: factura?.codigo },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onClose}
                className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
                <span className="group-hover:-translate-x-0.5 transition">←</span> Órdenes de Compra
              </button>
              <span className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Orden de Compra</p>
                <h1 className="text-lg font-bold font-mono leading-tight">
                  {form.numeroOrden || orden.codigo}
                </h1>
                <p className="text-xs font-normal text-white/60 leading-tight">
                  {orden.codigo}{orden.numeroDocumento != null && ` · Doc. N° ${orden.numeroDocumento}`}
                </p>
                {orden.empresa && <p className="text-xs text-white/80 leading-tight">{orden.empresa.razonSocial}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Total a pagar</p>
                <p className="text-lg font-bold leading-tight">{money(calc.totalAPagar)}</p>
                {factura?.estadoPago && (
                  <Chip className="mt-0.5 bg-white/20 text-white">{factura.estadoPago}</Chip>
                )}
              </div>
              {!orden.anulado && puedeEditar && <BotonAnular onAnular={anular} />}
              {!orden.anulado && puedeEditar && (
                <button onClick={guardar} disabled={guardando}
                  className="bg-white text-blue-700 text-sm px-5 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
              )}
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
          <fieldset disabled={orden.anulado || !puedeEditar} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la orden</h2>
            </div>

            {orden.anulado && (
              <BannerAnulado motivo={orden.motivoAnulacion} por={orden.anuladoPor} fecha={orden.fechaAnulacion} />
            )}

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

            <div>
              <label className="text-xs text-gray-500 block mb-1">Título / Descripción</label>
              <input name="titulo" value={form.titulo} onChange={handleChange}
                placeholder="Descripción del servicio u obra" className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
                <input name="codigoSap" value={form.codigoSap} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
                <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
              </div>
            </div>

            {/* Cálculos */}
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-blue-50/40 border border-gray-100 p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Subtotal sin IGV</label>
                <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange}
                  step="0.01" min="0" placeholder="0.00" className={`${INP} text-lg font-semibold`} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-400">IGV 18%</p>
                  <p className="font-semibold text-gray-700">{calc.igv.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold text-gray-700">{calc.total.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Detracción 12%</p>
                  <p className="font-semibold text-gray-700">{calc.detraccion.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-600">Total a pagar</span>
                <span className="text-lg font-bold text-blue-700">{money(calc.totalAPagar)}</span>
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            <TarjetaRelacion tipo="cotizacion" codigo={cot?.codigo} numero={cot?.numeroCotizacion} vacio={!cot}
              onClick={cot ? () => onNavegar?.({ tipo: "cotizacion", data: cot }) : undefined}>
              <p className="text-sm text-gray-700 line-clamp-2">{cot?.titulo}</p>
              {cot?.total > 0 && <p className="text-xs text-gray-500">{money(cot.total)}</p>}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="ot" codigo={ot?.codigo} numero={ot?.numeroOT} vacio={!ot}
              onClick={ot ? () => onNavegar?.({ tipo: "ot", data: ot }) : undefined}>
              {ot?.estado && <Chip className={badgeOT(ot.estado)}>{ot.estado}</Chip>}
              {ot?.personalEncargado?.nombre && (
                <p className="text-xs text-gray-500">Técnico: {ot.personalEncargado.nombre}</p>
              )}
            </TarjetaRelacion>

            <TarjetaRelacion
              tipo="informe"
              codigo={informes.length ? `${informes.length} avance${informes.length !== 1 ? "s" : ""}` : null}
              vacio={informes.length === 0}>
              {ultimo?.fechaHoraGuardado && (
                <p className="text-xs text-gray-500">
                  Último: {new Date(ultimo.fechaHoraGuardado).toLocaleDateString("es-PE")}
                </p>
              )}
              {ultimo?.personalEncargado?.nombre && (
                <p className="text-xs text-gray-500">Técnico: {ultimo.personalEncargado.nombre}</p>
              )}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="oc" codigo={orden.codigo} numero={orden.numeroOrden} actual />

            <TarjetaRelacion tipo="factura" codigo={factura?.codigo} numero={factura?.numeroFactura} vacio={!factura}
              onClick={factura ? abrirFactura : undefined} cargando={cargandoFactura}
              onCrear={!factura && !orden.anulado ? () => setCrearFacturaOpen(true) : undefined} crearLabel="Factura">
              {(factura?.totalAPagar || factura?.total) > 0 && (
                <p className="text-xs text-gray-500">{money(factura.totalAPagar ?? factura.total)}</p>
              )}
              {factura?.estadoPago && <Chip className={badgePago(factura.estadoPago)}>{factura.estadoPago}</Chip>}
            </TarjetaRelacion>
          </section>
        </div>
      </div>

      {crearFacturaOpen && (
        <ModalCrearFactura
          ocInicial={orden}
          onClose={() => setCrearFacturaOpen(false)}
          onCreada={(nueva) => { setCrearFacturaOpen(false); onNavegar?.({ tipo: "factura", data: nueva }); }}
        />
      )}
    </div>
  );
}
