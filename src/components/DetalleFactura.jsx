import { useState, useEffect } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import {
  FlujoNegocio, TarjetaRelacion, Chip,
  badgeOT, badgePago, money, BotonAnular, BannerAnulado,
} from "./detalleShared";

const INP    = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 w-full transition";
const INP_RO = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";

function calcular(sub) {
  const s = Math.round(Number(sub) * 100) / 100 || 0;
  const igv = Math.round(s * 0.18 * 100) / 100;
  const total = Math.round((s + igv) * 100) / 100;
  // R.S. 178-2005/SUNAT: aplica solo si el total (con IGV) es >= S/ 701, y el
  // depósito se hace en números enteros (sin decimales).
  const detraccion = total >= 701 ? Math.round(total * 0.12) : 0;
  return { igv, total, detraccion, totalAPagar: Math.round((total - detraccion) * 100) / 100 };
}

function BuscadorOC({ onSelect, onClose }) {
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

export default function DetalleFactura({ factura: inicial, onClose, onGuardada, onNavegar }) {
  const subtotalInicial = inicial.subtotal ?? 0;

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
    codigoSap:          inicial.codigoSap          || "",
    fechaSalida: inicial.fechaSalida
      ? new Date(inicial.fechaSalida).toISOString().split("T")[0] : "",
  });
  const [calc, setCalc]           = useState(calcular(subtotalInicial));
  const [ocVinculada, setOC]      = useState(inicial.ordenCompra || null);
  const [empresas, setEmpresas]   = useState([]);
  const [buscadorOC, setBOC]      = useState(false);
  const [cot, setCot]             = useState(inicial.cotizacion || null);
  const [ot, setOt]               = useState(null);
  const [informes, setInformes]   = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [cargandoOC, setCargandoOC] = useState(false);
  const puedeEditar = ["admin", "asistente"].includes(getUsuario()?.rol);

  const abrirOC = async () => {
    if (!ocVinculada || cargandoOC) return;
    setCargandoOC(true);
    const [resOC, resFact] = await Promise.all([
      fetchAuth("/ordenes-compra"),
      fetchAuth("/facturas"),
    ]);
    const listaOC   = resOC.ok   ? await resOC.json()   : [];
    const listaFact = resFact.ok ? await resFact.json() : [];
    const full  = listaOC.find(o => o._id === ocVinculada._id) || ocVinculada;
    const cotId = full.cotizacion?._id || full.cotizacion;
    // Enlace directo (ordenCompra) primero, prefiriendo la que comparte
    // numeroDocumento con la OC; cotizacion queda solo como último respaldo.
    const porOC = listaFact.filter(f => (f.ordenCompra?._id || f.ordenCompra) === full._id);
    const factRelacionada =
      porOC.find(f => f.numeroDocumento === full.numeroDocumento) ||
      porOC[0] ||
      listaFact.find(f => (f.cotizacion?._id || f.cotizacion) === cotId) ||
      inicial;
    setCargandoOC(false);
    onNavegar?.({ tipo: "oc", data: full, extra: factRelacionada });
  };

  const cargarRelaciones = () => {
    const cotId = inicial.cotizacion?._id || inicial.cotizacion;
    const numDoc = inicial.numeroDocumento;
    Promise.all([
      fetchAuth("/cotizaciones").then(r => r.ok && r.json()),
      fetchAuth("/ordenes-trabajo").then(r => r.ok && r.json()),
    ]).then(([cots, ots]) => {
      // La Factura no siempre trae su propia `cotizacion` (p.ej. creada por
      // la cadena vía OC) — se resuelve por numeroDocumento compartido,
      // usando el enlace directo solo como respaldo.
      const cotResuelta =
        (cots && numDoc != null && cots.find(c => c.numeroDocumento === numDoc)) ||
        (cots && cotId && cots.find(c => c._id === cotId)) ||
        null;
      setCot(cotResuelta);

      const otResuelta =
        (ots && numDoc != null && ots.find(o => o.numeroDocumento === numDoc)) ||
        (ots && cotResuelta && ots.find(o => (o.cotizacion?._id || o.cotizacion) === cotResuelta._id)) ||
        null;
      setOt(otResuelta || null);

      if (otResuelta) {
        fetchAuth(`/informes?ordenTrabajo=${otResuelta._id}`)
          .then(r => r.ok && r.json())
          .then(infs => setInformes(infs || []));
      }
    });
  };

  useEffect(() => {
    fetchAuth("/empresas").then(r => r.ok && r.json()).then(emps => setEmpresas(emps || []));
    cargarRelaciones();
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
      codigoSap:          form.codigoSap,
      fechaSalida:        form.fechaSalida || null,
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
    if (res.ok) { onGuardada(await res.json()); }
    else { setError("No se pudo guardar los cambios."); }
    setGuardando(false);
  };

  const anular = async (motivo) => {
    const res = await fetchAuth(`/facturas/${inicial._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) { onGuardada(await res.json()); }
    else { setError("Error al anular el documento."); }
  };

  const oc     = ocVinculada;
  const ultimo = informes[informes.length - 1];

  const pasos = [
    { tipo: "cotizacion", activo: !!cot,             codigo: cot?.codigo },
    { tipo: "ot",         activo: !!ot,              codigo: ot?.codigo },
    { tipo: "informe",    activo: informes.length>0, codigo: ultimo?.codigo || (informes.length ? `${informes.length} av.` : "") },
    { tipo: "oc",         activo: !!oc,              codigo: oc?.codigo },
    { tipo: "factura",    activo: true,              codigo: inicial.codigo },
  ];

  return (
    <>
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onClose}
                className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
                <span className="group-hover:-translate-x-0.5 transition">←</span> Facturas
              </button>
              <span className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Factura</p>
                <h1 className="text-lg font-bold font-mono leading-tight">
                  {form.numeroFactura || inicial.codigo}
                </h1>
                <p className="text-xs font-normal text-white/60 leading-tight">
                  {inicial.codigo}{inicial.numeroDocumento != null && ` · Doc. N° ${inicial.numeroDocumento}`}
                </p>
                {inicial.empresa && <p className="text-xs text-white/80 leading-tight">{inicial.empresa.razonSocial}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">Total a pagar</p>
                <p className="text-lg font-bold leading-tight">{money(calc.totalAPagar)}</p>
                {inicial.estadoPago && (
                  <Chip className="mt-0.5 bg-white/20 text-white">{inicial.estadoPago}</Chip>
                )}
              </div>
              {!inicial.anulado && puedeEditar && <BotonAnular onAnular={anular} />}
              {!inicial.anulado && puedeEditar && (
                <button onClick={guardar} disabled={guardando}
                  className="bg-white text-emerald-700 text-sm px-5 py-2 rounded-lg hover:bg-emerald-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
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
          <fieldset disabled={inicial.anulado || !puedeEditar} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la factura</h2>
            </div>

            {inicial.anulado && (
              <BannerAnulado motivo={inicial.motivoAnulacion} por={inicial.anuladoPor} fecha={inicial.fechaAnulacion} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de factura</label>
                <input name="numeroFactura" value={form.numeroFactura} onChange={handleChange}
                  placeholder="Ej. F001-00123" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° Orden de Compra</label>
                {oc ? (
                  <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                    <span className="font-mono text-xs text-blue-600 flex-1">
                      {oc.codigo}{oc.numeroOrden ? ` · ${oc.numeroOrden}` : ""}
                    </span>
                    <button onClick={() => setBOC(true)}
                      className="text-xs text-gray-400 hover:text-blue-600 underline shrink-0">Cambiar</button>
                    <button onClick={() => setOC(null)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none">✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setBOC(true)}
                    className="w-full text-xs border border-dashed border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 text-blue-600 transition text-left">
                    + Buscar OC existente
                  </button>
                )}
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
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción</label>
              <input name="descripcion" value={form.descripcion} onChange={handleChange}
                placeholder="—" className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-emerald-50/40 border border-gray-100 p-4 space-y-4">
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
                <span className="text-lg font-bold text-emerald-700">{money(calc.totalAPagar)}</span>
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-teal-500" />
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

            <TarjetaRelacion tipo="oc" codigo={oc?.codigo} numero={oc?.numeroOrden} vacio={!oc}
              onClick={oc ? abrirOC : undefined} cargando={cargandoOC}>
              {oc?.titulo && <p className="text-xs text-gray-500 line-clamp-2">{oc.titulo}</p>}
              {(oc?.monto || oc?.total) > 0 && <p className="text-xs text-gray-500">{money(oc.monto ?? oc.total)}</p>}
            </TarjetaRelacion>

            <TarjetaRelacion tipo="factura" codigo={inicial.codigo} numero={inicial.numeroFactura} actual>
              {inicial.estadoPago && <Chip className={badgePago(inicial.estadoPago)}>{inicial.estadoPago}</Chip>}
            </TarjetaRelacion>
          </section>
        </div>
      </div>
    </div>

    {buscadorOC && <BuscadorOC onSelect={seleccionarOC} onClose={() => setBOC(false)} />}
    </>
  );
}
