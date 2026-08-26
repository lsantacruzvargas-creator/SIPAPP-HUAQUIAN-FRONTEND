import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import {
  AFECTACION_IGV,
  TIPO_ITEM,
  unidadesPorTipoItem,
  TIPO_DOC_RECEPTOR,
  MOTIVO_NC,
  MOTIVO_ND,
  TIPO_MONEDA,
  DETRACCION_BIENES_SERVICIOS,
  itemVacioComprobante,
  precioUnitarioDesdeValor,
  calcularLineaComprobante,
  documentoValido,
  serieValida,
} from "../utils/catalogosSunat";

const RECEPTOR_VACIO = { schemeID: "6", numDoc: "", nombre: "" };
const REFERENCIA_VACIA = { id: "", serie: "", tipoDoc: "" };

// Empresa emisora fija — este ERP factura únicamente a nombre de Huaquian.
// Las credenciales SUNAT las resuelve el hub central por RUC (no hay registro
// de credenciales en el ERP). Deben coincidir con RUC_EMISOR/RAZON_SOCIAL_EMISOR
// de Backend/.env.
const RUC_EMISOR = "20601565235";
const NOMBRE_EMISOR = "HUAQUIAN";

// Serie fija por tipo de comprobante — todas terminan en "2" para evitar
// futuros conflictos de correlativo con series de prueba/históricas.
const SERIE_POR_TIPO = { "01": "F002", "03": "B002", "07": "FC02", "08": "FD02" };

// Marca visual de campo obligatorio, junto al texto del label.
function Oblig() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

export default function EmitirComprobante() {
  const location = useLocation();
  const [rucEmisor] = useState(RUC_EMISOR);
  const [tipoDoc, setTipoDoc] = useState("01");
  const [serie, setSerie] = useState(SERIE_POR_TIPO["01"]);
  const [formaPago, setFormaPago] = useState("Contado");
  const [cuotas, setCuotas] = useState([]);
  const [receptor, setReceptor] = useState(RECEPTOR_VACIO);
  const [tipoBienServicio, setTipoBienServicio] = useState("bien");
  const [items, setItems] = useState([itemVacioComprobante()]);
  const [comprobantesRef, setComprobantesRef] = useState([]);
  const [referencia, setReferencia] = useState(REFERENCIA_VACIA);
  const [motivoCodigo, setMotivoCodigo] = useState("");
  const [motivoDescripcion, setMotivoDescripcion] = useState("");
  const [moneda, setMoneda] = useState("PEN");
  const [otrosCargos, setOtrosCargos] = useState("");
  const [montoRedondeo, setMontoRedondeo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [informacionRelacionada, setInformacionRelacionada] = useState("");
  const [detraccionAplica, setDetraccionAplica] = useState(false);
  const [detraccionCodigoBien, setDetraccionCodigoBien] = useState("");
  const [detraccionPorcentaje, setDetraccionPorcentaje] = useState("");
  const [detraccionMontoNeto, setDetraccionMontoNeto] = useState("");
  const [detraccionCuentaBancaria, setDetraccionCuentaBancaria] = useState("");
  const [numeroOrdenCompra, setNumeroOrdenCompra] = useState("");
  const [ordenCompraId, setOrdenCompraId] = useState("");
  const [mostrarBuscadorOC, setMostrarBuscadorOC] = useState(false);
  const [ordenesCompra, setOrdenesCompra] = useState([]);
  const [buscandoOC, setBuscandoOC] = useState(false);
  const [filtroOC, setFiltroOC] = useState("");
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const esNota = tipoDoc === "07" || tipoDoc === "08";

  const aplicarComprobanteReferencia = (c) => {
    setReferencia({ id: c._id, serie: `${c.serie}-${c.correlativo}`, tipoDoc: c.tipoDoc });
    setReceptor({ schemeID: c.receptor.schemeID, numDoc: c.receptor.numDoc, nombre: c.receptor.nombre });
    if (c.totales?.moneda) setMoneda(c.totales.moneda);
    setTipoBienServicio(c.items?.[0]?.unidad === "ZZ" ? "servicio" : "bien");
    setItems(c.items.map((i) => ({
      _key: Date.now() + Math.random(),
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      valorUnitario: i.valorUnitario,
      precioUnitario: i.precioUnitario ?? i.valorUnitario,
      afectacion: i.afectacion,
      descuentoPorcentaje: Math.round((i.descuentoPorcentaje || 0) * 100),
    })));
  };

  useEffect(() => {
    const c = location.state?.comprobante;
    if (c) {
      setTipoDoc(location.state.tipoDocDestino || "07");
      aplicarComprobanteReferencia(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!esNota || !rucEmisor) { setComprobantesRef([]); return; }
    fetchAuth(`/cpe?rucEmisor=${rucEmisor}&estado=ACEPTADO&limit=50`).then(async (r) => {
      const data = await r.json();
      if (data.ok) setComprobantesRef(data.data.filter((c) => c.tipoDoc === "01" || c.tipoDoc === "03"));
    });
  }, [esNota, rucEmisor]);

  const ligarComprobanteRef = async (id) => {
    if (!id) { setReferencia(REFERENCIA_VACIA); return; }
    const res  = await fetchAuth(`/cpe/${id}`);
    const data = await res.json();
    if (!data.ok) return;
    aplicarComprobanteReferencia(data.data);
  };

  const cambiarTipoDoc = (t) => {
    setTipoDoc(t);
    setSerie(SERIE_POR_TIPO[t]);
    if (t === "01") setReceptor((r) => ({ ...r, schemeID: "6" }));
    if (t !== "07" && t !== "08") {
      setReferencia(REFERENCIA_VACIA);
      setMotivoCodigo("");
      setMotivoDescripcion("");
    }
  };

  const handleReceptor = (e) => setReceptor({ ...receptor, [e.target.name]: e.target.value });

  const buscarReceptorRuc = async (numDoc) => {
    if (receptor.schemeID !== "6" || numDoc.length !== 11) return;
    setBuscandoDoc(true);
    try {
      const res = await fetchAuth(`/sunat/ruc/${numDoc}`);
      if (!res.ok) { setError("RUC no encontrado en SUNAT"); return; }
      const data = await res.json();
      setReceptor((r) => ({ ...r, nombre: data.razonSocial || r.nombre }));
      setError("");
    } catch {
      setError("Error al consultar SUNAT");
    } finally {
      setBuscandoDoc(false);
    }
  };

  const handleItem = (key, campo, valor) =>
    setItems(items.map((i) => {
      if (i._key !== key) return i;
      const actualizado = { ...i, [campo]: valor };
      if (campo === "valorUnitario" || campo === "afectacion") {
        actualizado.precioUnitario = precioUnitarioDesdeValor(actualizado.valorUnitario, actualizado.afectacion);
      }
      return actualizado;
    }));

  const cambiarTipoBienServicio = (valor) => {
    setTipoBienServicio(valor);
    setItems(items.map((i) => ({
      ...i,
      unidad: valor === "servicio" ? "ZZ" : (i.unidad === "ZZ" ? "NIU" : i.unidad),
    })));
  };

  const agregarItem = () => setItems([
    ...items,
    { ...itemVacioComprobante(), unidad: tipoBienServicio === "servicio" ? "ZZ" : "NIU" },
  ]);
  const eliminarItem = (key) => setItems(items.filter((i) => i._key !== key));

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

  const itemsCalc = items.map((i) => ({ ...i, ...calcularLineaComprobante(i) }));
  const totales = itemsCalc.reduce(
    (acc, i) => ({
      base:       acc.base + i.base,
      igv:        acc.igv + i.igv,
      descuento:  acc.descuento + i.montoDescuento,
      total:      acc.total + i.total,
    }),
    { base: 0, igv: 0, descuento: 0, total: 0 }
  );
  const otrosCargosNum   = Number(otrosCargos) || 0;
  const montoRedondeoNum = Number(montoRedondeo) || 0;
  const totalGeneral = totales.total + otrosCargosNum + montoRedondeoNum;
  const sumaCuotas = cuotas.reduce((s, c) => s + (Number(c.monto) || 0), 0);

  const ro = !!resultado?.ok;

  const ordenesCompraFiltradas = ordenesCompra.filter((o) => {
    if (!filtroOC.trim()) return true;
    const q = filtroOC.trim().toLowerCase();
    return (
      (o.numeroOrden || "").toLowerCase().includes(q) ||
      (o.codigo || "").toLowerCase().includes(q) ||
      (o.titulo || "").toLowerCase().includes(q) ||
      (o.empresa?.razonSocial || "").toLowerCase().includes(q)
    );
  });

  const abrirBuscadorOC = async () => {
    setMostrarBuscadorOC(true);
    if (ordenesCompra.length) return;
    setBuscandoOC(true);
    try {
      const res  = await fetchAuth("/ordenes-compra");
      const data = await res.json();
      setOrdenesCompra(Array.isArray(data) ? data : []);
    } finally {
      setBuscandoOC(false);
    }
  };

  const elegirOC = (o) => {
    setNumeroOrdenCompra(o.numeroOrden || o.codigo);
    setOrdenCompraId(o._id);
    setMostrarBuscadorOC(false);
  };

  const validar = () => {
    if (!rucEmisor) return "Selecciona la empresa emisora.";
    if (!serie.trim()) return "La serie es requerida.";
    if (!serieValida(serie)) return "La serie debe tener exactamente 4 caracteres (ej. F001, B001, FC01).";
    if (!receptor.numDoc.trim() || !receptor.nombre.trim()) return "Los datos del receptor son requeridos.";
    if (tipoDoc === "01" && receptor.schemeID !== "6") return "La factura requiere un receptor con RUC.";
    if (!documentoValido(receptor.schemeID, receptor.numDoc)) {
      return receptor.schemeID === "6"
        ? "El RUC del receptor debe tener 11 dígitos."
        : receptor.schemeID === "1"
        ? "El DNI del receptor debe tener 8 dígitos."
        : "El documento del receptor no es válido.";
    }
    if (!esNota && formaPago === "Credito") {
      if (cuotas.length === 0) return "Agrega al menos una cuota de pago para el crédito.";
      for (const c of cuotas) {
        if (!c.monto || Number(c.monto) <= 0) return "Cada cuota debe tener un monto mayor a 0.";
        if (!c.fechaVencimiento) return "Cada cuota debe tener una fecha de vencimiento.";
      }
      if (Math.abs(sumaCuotas - totalGeneral) > 0.01) {
        return `La suma de las cuotas (${moneda} ${sumaCuotas.toFixed(2)}) debe ser igual al monto neto pendiente (${moneda} ${totalGeneral.toFixed(2)}).`;
      }
    }
    if (tipoDoc === "03" && totalGeneral >= 700 && receptor.schemeID === "0") {
      return "Una Boleta desde S/ 700 requiere un receptor identificado (RUC, DNI, Carné o Pasaporte), no 'Sin documento'.";
    }
    if (!esNota && detraccionAplica) {
      if (!detraccionCodigoBien) return "Selecciona el bien o servicio sujeto a detracción.";
      if (!detraccionPorcentaje || Number(detraccionPorcentaje) <= 0) return "El porcentaje de detracción debe ser mayor a 0.";
      if (!detraccionMontoNeto || Number(detraccionMontoNeto) <= 0) return "El monto neto a depositar debe ser mayor a 0.";
      if (!detraccionCuentaBancaria.trim()) return "La cuenta del Banco de la Nación es requerida.";
    }
    if (esNota) {
      if (!referencia.id) return "Selecciona el comprobante a modificar.";
      if (!motivoCodigo) return "Selecciona el motivo.";
      if (!motivoDescripcion.trim()) return "La descripción del motivo es requerida.";
      if (serie.trim().charAt(0).toUpperCase() !== referencia.serie.charAt(0).toUpperCase()) {
        return `La serie debe comenzar con la misma letra que el comprobante referenciado (${referencia.serie}).`;
      }
      if (tipoDoc === "07" && referencia.tipoDoc === "03" && ["04", "05", "08"].includes(motivoCodigo)) {
        return "Este motivo (descuento/bonificación por ítem o global) no aplica sobre una Boleta referenciada.";
      }
      if (tipoDoc === "07" && motivoCodigo === "03" && totales.total !== 0) {
        return "El motivo 'Corrección por error en la descripción' es una corrección de texto: ajusta los importes de los ítems a 0 antes de emitir.";
      }
    }
    for (const item of items) {
      if (!item.descripcion.trim()) return "Todos los ítems deben tener descripción.";
      if (!item.cantidad || Number(item.cantidad) <= 0) return "La cantidad de cada ítem debe ser mayor a 0.";
      if (item.valorUnitario === "" || Number(item.valorUnitario) < 0) return "El valor unitario de cada ítem debe ser válido.";
    }
    return null;
  };

  const emitir = async () => {
    setCargando(true);
    setError("");
    try {
      const receptorBody = {
        numDoc:   receptor.numDoc.trim(),
        nombre:   receptor.nombre.trim(),
        schemeID: receptor.schemeID,
      };
      const itemsBody = items.map((i) => ({
        descripcion:   i.descripcion,
        cantidad:      Number(i.cantidad),
        unidad:        i.unidad,
        valorUnitario: Number(i.valorUnitario),
        precioUnitario: precioUnitarioDesdeValor(i.valorUnitario, i.afectacion),
        afectacion:    i.afectacion,
        descuentoPorcentaje: (Number(i.descuentoPorcentaje) || 0) / 100,
      }));

      let endpoint, body;
      if (esNota) {
        endpoint = tipoDoc === "07" ? "/cpe/nota-credito" : "/cpe/nota-debito";
        body = {
          rucEmisor,
          serie: serie.trim().toUpperCase(),
          receptor: receptorBody,
          items: itemsBody,
          docReferencia: referencia.serie,
          tipoDocRef: referencia.tipoDoc,
          motivoCodigo,
          motivoDescripcion: motivoDescripcion.trim(),
          moneda,
          otrosCargos: otrosCargosNum,
          montoRedondeo: montoRedondeoNum,
          observaciones: observaciones.trim(),
          informacionRelacionada: informacionRelacionada.trim(),
        };
      } else {
        endpoint = tipoDoc === "01" ? "/cpe/factura" : "/cpe/boleta";
        body = {
          tipoDoc,
          serie: serie.trim().toUpperCase(),
          rucEmisor,
          receptor: receptorBody,
          items: itemsBody,
          formaPago,
          ...(formaPago === "Credito" && cuotas.length ? {
            cuotas: cuotas.map((c, idx) => ({
              numero: idx + 1,
              monto: Number(c.monto),
              fechaVencimiento: c.fechaVencimiento,
            })),
          } : {}),
          moneda,
          otrosCargos: otrosCargosNum,
          montoRedondeo: montoRedondeoNum,
          observaciones: observaciones.trim(),
          informacionRelacionada: informacionRelacionada.trim(),
          numeroOrdenCompra: numeroOrdenCompra.trim(),
          ...(ordenCompraId ? { ordenCompra: ordenCompraId } : {}),
          ...(detraccionAplica ? {
            detraccion: {
              aplica: true,
              codigoBien: detraccionCodigoBien,
              porcentaje: Number(detraccionPorcentaje),
              montoNeto: Number(detraccionMontoNeto),
              cuentaBancaria: detraccionCuentaBancaria.trim(),
            },
          } : {}),
        };
      }
      const res  = await fetchAuth(endpoint, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      setResultado(data);
      if (!data.ok) setError(data.mensaje || data.error || "El comprobante fue rechazado por SUNAT.");
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  const nuevo = () => {
    setSerie("");
    setFormaPago("Contado");
    setCuotas([]);
    setReceptor(RECEPTOR_VACIO);
    setTipoBienServicio("bien");
    setItems([itemVacioComprobante()]);
    setReferencia(REFERENCIA_VACIA);
    setMotivoCodigo("");
    setMotivoDescripcion("");
    setMoneda("PEN");
    setOtrosCargos("");
    setMontoRedondeo("");
    setObservaciones("");
    setInformacionRelacionada("");
    setDetraccionAplica(false);
    setDetraccionCodigoBien("");
    setDetraccionPorcentaje("");
    setDetraccionMontoNeto("");
    setDetraccionCuentaBancaria("");
    setNumeroOrdenCompra("");
    setOrdenCompraId("");
    setResultado(null);
    setError("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Emitir Comprobante</h2>
        {resultado?.ok && <span className="font-mono text-sm text-gray-400">{resultado.serie}</span>}
      </div>

      {resultado?.estado === "ACEPTADO" && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-5">
          Comprobante <strong>{resultado.serie}</strong> ACEPTADO por SUNAT.
        </div>
      )}
      {resultado?.estado === "EN_PROCESO" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 mb-5">
          Comprobante <strong>{resultado.serie}</strong> EN PROCESO — SUNAT aún no confirma el resultado.
          Verifica el estado más tarde en la lista de comprobantes.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        {/* Selector tipo doc */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-5 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-500">Tipo de comprobante:</span>
          {[["01", "Factura"], ["03", "Boleta"], ["07", "Nota de Crédito"], ["08", "Nota de Débito"]].map(([v, label]) => (
            <button
              key={v} type="button" disabled={ro}
              onClick={() => cambiarTipoDoc(v)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition ${
                tipoDoc === v
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-500 hover:border-gray-300 hover:text-gray-800"
              } disabled:cursor-not-allowed`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cabecera */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empresa emisora</label>
              <input value={`${NOMBRE_EMISOR} — RUC ${RUC_EMISOR}`} disabled
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Serie</label>
              <input value={serie} disabled
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Moneda</label>
              <div className="flex gap-3">
                {TIPO_MONEDA.map((m) => (
                  <button
                    key={m.valor} type="button" disabled={ro}
                    onClick={() => setMoneda(m.valor)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                      moneda === m.valor
                        ? "bg-gray-900 text-white"
                        : "border border-gray-300 text-gray-500 hover:border-gray-300 hover:text-gray-800"
                    } disabled:cursor-not-allowed`}
                  >
                    {m.valor}
                  </button>
                ))}
              </div>
            </div>

            {!esNota ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Forma de pago</label>
                  <div className="flex gap-3">
                    {["Contado", "Credito"].map((v) => (
                      <button
                        key={v} type="button" disabled={ro}
                        onClick={() => cambiarFormaPago(v)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                          formaPago === v
                            ? "bg-gray-900 text-white"
                            : "border border-gray-300 text-gray-500 hover:border-gray-300 hover:text-gray-800"
                        } disabled:cursor-not-allowed`}
                      >
                        {v === "Contado" ? "Contado" : "Crédito"}
                      </button>
                    ))}
                  </div>
                </div>
                {formaPago === "Credito" && (
                  <div className="col-span-2 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-500">Cuotas de pago<Oblig /></label>
                      <span className="text-xs text-gray-400">
                        Monto neto pendiente: {moneda} {totalGeneral.toFixed(2)}
                      </span>
                    </div>
                    <div className="border border-gray-100 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b border-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left w-20">Cuota</th>
                            <th className="px-3 py-2 text-left">Monto<Oblig /></th>
                            <th className="px-3 py-2 text-left">Fecha de vencimiento<Oblig /></th>
                            {!ro && <th className="px-3 py-2 w-8"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cuotas.map((c, idx) => (
                            <tr key={c._key}>
                              <td className="px-3 py-2 text-gray-400">Cuota{String(idx + 1).padStart(3, "0")}</td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="0.01" value={c.monto}
                                  onChange={(e) => handleCuota(c._key, "monto", e.target.value)}
                                  disabled={ro} required
                                  className="w-full input-field w-auto" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="date" value={c.fechaVencimiento}
                                  onChange={(e) => handleCuota(c._key, "fechaVencimiento", e.target.value)}
                                  disabled={ro} required
                                  className="w-full input-field w-auto" />
                              </td>
                              {!ro && (
                                <td className="px-3 py-2 text-center">
                                  <button type="button" onClick={() => eliminarCuota(c._key)} className="text-red-400 hover:text-red-600">✕</button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!ro && (
                        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                          <button type="button" onClick={agregarCuota}
                            className="text-sm text-gray-500 hover:text-gray-800 transition">
                            + Agregar cuota
                          </button>
                          <span className={`text-xs font-medium ${Math.abs(sumaCuotas - totalGeneral) < 0.01 ? "text-green-600" : "text-red-500"}`}>
                            Suma de cuotas: {moneda} {sumaCuotas.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Comprobante a modificar<Oblig /></label>
                  <select value={referencia.id} onChange={(e) => ligarComprobanteRef(e.target.value)}
                    disabled={ro || !rucEmisor} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                    <option value="">— Seleccionar —</option>
                    {comprobantesRef.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.serie}-{c.correlativo} — {c.receptor?.nombre} ({c.tipoDoc === "01" ? "Factura" : "Boleta"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Motivo<Oblig /></label>
                  <select value={motivoCodigo} onChange={(e) => setMotivoCodigo(e.target.value)} disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                    <option value="">— Seleccionar —</option>
                    {(tipoDoc === "07" ? MOTIVO_NC : MOTIVO_ND).map((m) => (
                      <option key={m.valor} value={m.valor}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Descripción del motivo<Oblig /></label>
                  <input value={motivoDescripcion} onChange={(e) => setMotivoDescripcion(e.target.value)} disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Receptor */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Receptor</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
              <select name="schemeID" value={receptor.schemeID} onChange={handleReceptor}
                disabled={ro || tipoDoc === "01"}
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                {TIPO_DOC_RECEPTOR.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Número de documento<Oblig />
                {buscandoDoc && <span className="ml-2 text-gray-400 font-normal">Consultando SUNAT…</span>}
              </label>
              <input name="numDoc" value={receptor.numDoc} onChange={handleReceptor}
                onBlur={(e) => buscarReceptorRuc(e.target.value)} disabled={ro} required
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Razón social<Oblig /></label>
              <input name="nombre" value={receptor.nombre} onChange={handleReceptor} disabled={ro} required
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
          </div>
        </div>

        {/* Tipo de operación (bien o servicio) — decide la unidad válida para TODOS los ítems */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-5 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-500">Este comprobante es por:</span>
          {TIPO_ITEM.map((t) => (
            <button
              key={t.valor} type="button" disabled={ro}
              onClick={() => cambiarTipoBienServicio(t.valor)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition ${
                tipoBienServicio === t.valor
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-500 hover:border-gray-300 hover:text-gray-800"
              } disabled:cursor-not-allowed`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tabla de items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-100">
                <tr>
                  <th className="px-3 py-3 text-center w-8">#</th>
                  <th className="px-3 py-3 text-left">Descripción<Oblig /></th>
                  <th className="px-3 py-3 text-left w-20">Cant.<Oblig /></th>
                  <th className="px-3 py-3 text-left w-28">Unidad</th>
                  <th className="px-3 py-3 text-left w-28">Valor Unit.<Oblig /></th>
                  <th className="px-3 py-3 text-left w-40">Afectación IGV</th>
                  <th className="px-3 py-3 text-left w-20">Desc. %</th>
                  <th className="px-3 py-3 text-right w-24">Total</th>
                  {!ro && <th className="px-3 py-3 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsCalc.map((item, idx) => (
                  <tr key={item._key} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-center text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input value={item.descripcion}
                        onChange={(e) => handleItem(item._key, "descripcion", e.target.value)}
                        required disabled={ro}
                        className="w-full input-field w-auto" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={item.cantidad}
                        onChange={(e) => handleItem(item._key, "cantidad", e.target.value)}
                        required disabled={ro}
                        className="w-full input-field w-auto" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.unidad} onChange={(e) => handleItem(item._key, "unidad", e.target.value)}
                        disabled={ro || tipoBienServicio === "servicio"} className="w-full input-field w-auto">
                        {unidadesPorTipoItem(tipoBienServicio).map((u) => (
                          <option key={u.valor} value={u.valor}>{u.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={item.valorUnitario}
                        onChange={(e) => handleItem(item._key, "valorUnitario", e.target.value)}
                        required disabled={ro}
                        className="w-full input-field w-auto" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.afectacion} onChange={(e) => handleItem(item._key, "afectacion", e.target.value)}
                        disabled={ro} className="w-full input-field w-auto">
                        {AFECTACION_IGV.map((a) => (
                          <option key={a.valor} value={a.valor}>{a.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" max="100" step="1" value={item.descuentoPorcentaje}
                        onChange={(e) => handleItem(item._key, "descuentoPorcentaje", e.target.value)}
                        disabled={ro}
                        className="w-full input-field w-auto" />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">
                      {item.total.toFixed(2)}
                    </td>
                    {!ro && (
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => eliminarItem(item._key)} className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-100 bg-gray-50">
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right text-xs text-gray-500">Descuentos</td>
                  <td className="px-3 py-2 text-right font-medium">{totales.descuento.toFixed(2)}</td>
                  {!ro && <td />}
                </tr>
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right text-xs text-gray-500">Base imponible</td>
                  <td className="px-3 py-2 text-right font-medium">{totales.base.toFixed(2)}</td>
                  {!ro && <td />}
                </tr>
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right text-xs text-gray-500">IGV</td>
                  <td className="px-3 py-2 text-right font-medium">{totales.igv.toFixed(2)}</td>
                  {!ro && <td />}
                </tr>
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right text-xs text-gray-500">Otros cargos (no afectos a IGV)</td>
                  <td className="px-3 py-2 text-right">
                    {ro ? otrosCargosNum.toFixed(2) : (
                      <input type="number" min="0" step="0.01" value={otrosCargos}
                        onChange={(e) => setOtrosCargos(e.target.value)}
                        placeholder="0.00"
                        className="w-full input-field w-auto text-right" />
                    )}
                  </td>
                  {!ro && <td />}
                </tr>
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right text-xs text-gray-500">Monto de redondeo</td>
                  <td className="px-3 py-2 text-right">
                    {ro ? montoRedondeoNum.toFixed(2) : (
                      <input type="number" step="0.01" value={montoRedondeo}
                        onChange={(e) => setMontoRedondeo(e.target.value)}
                        placeholder="0.00"
                        className="w-full input-field w-auto text-right" />
                    )}
                  </td>
                  {!ro && <td />}
                </tr>
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-right text-sm font-semibold text-gray-800">Total a pagar</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-800 text-base">{moneda} {totalGeneral.toFixed(2)}</td>
                  {!ro && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
          {!ro && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button type="button" onClick={agregarItem}
                className="text-sm text-gray-500 hover:text-gray-800 transition">
                + Agregar ítem
              </button>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información adicional</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                disabled={ro} rows={2}
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Información relacionada</label>
              <textarea value={informacionRelacionada} onChange={(e) => setInformacionRelacionada(e.target.value)}
                disabled={ro} rows={2}
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
          </div>

          {!esNota && (
            <>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                  <input type="checkbox" checked={detraccionAplica} disabled={ro}
                    onChange={(e) => setDetraccionAplica(e.target.checked)} />
                  Operación sujeta a detracción
                </label>
                {detraccionAplica && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Bien / servicio<Oblig /></label>
                      <select value={detraccionCodigoBien} disabled={ro} required
                        onChange={(e) => {
                          const cod = e.target.value;
                          setDetraccionCodigoBien(cod);
                          const b = DETRACCION_BIENES_SERVICIOS.find((x) => x.codigo === cod);
                          if (b?.porcentaje != null) setDetraccionPorcentaje(String(b.porcentaje));
                        }}
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                        <option value="">— Seleccionar —</option>
                        {DETRACCION_BIENES_SERVICIOS.map((b) => (
                          <option key={b.codigo} value={b.codigo}>{b.codigo} — {b.descripcion}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Porcentaje (%)<Oblig /></label>
                      <input type="number" min="0" max="100" step="0.1" value={detraccionPorcentaje}
                        onChange={(e) => setDetraccionPorcentaje(e.target.value)} disabled={ro} required
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Monto neto a depositar<Oblig /></label>
                      <input type="number" min="0" step="0.01" value={detraccionMontoNeto}
                        onChange={(e) => setDetraccionMontoNeto(e.target.value)} disabled={ro} required
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                    </div>
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Cuenta Banco de la Nación<Oblig /></label>
                      <input value={detraccionCuentaBancaria}
                        onChange={(e) => setDetraccionCuentaBancaria(e.target.value)} disabled={ro} required
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-500 mb-1">N° Orden de Compra (opcional)</label>
                <div className="flex gap-2">
                  <input value={numeroOrdenCompra}
                    onChange={(e) => { setNumeroOrdenCompra(e.target.value); setOrdenCompraId(""); }}
                    disabled={ro}
                    className="flex-1 input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  {!ro && (
                    <button type="button" onClick={abrirBuscadorOC}
                      className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-500 hover:text-gray-800 transition">
                      Buscar
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3">
          {!ro ? (
            <button type="button" onClick={() => {
                const err = validar();
                if (err) { setError(err); return; }
                setError("");
                setConfirmando(true);
              }}
              disabled={cargando}
              className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-50">
              {cargando ? "Emitiendo..." : "Emitir comprobante"}
            </button>
          ) : (
            <button type="button" onClick={nuevo}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition">
              Nuevo comprobante
            </button>
          )}
        </div>
      </form>

      {confirmando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-2">¿Emitir comprobante?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se enviará a SUNAT a través del hub. Esta acción genera un correlativo nuevo aunque el comprobante sea rechazado.
            </p>
            {tipoDoc === "07" && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Esta Nota de Crédito anulará el comprobante <strong>{referencia.serie}</strong> de forma incondicional
                (pasará a estado ANULADO), sin importar el motivo seleccionado.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmando(false)}
                className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={async () => { setConfirmando(false); await emitir(); }}
                disabled={cargando}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-50">
                {cargando ? "Emitiendo..." : "Confirmar y emitir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarBuscadorOC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Buscar Orden de Compra</h3>
              <button type="button" onClick={() => setMostrarBuscadorOC(false)} className="text-gray-400 hover:text-gray-800">✕</button>
            </div>
            <input value={filtroOC} onChange={(e) => setFiltroOC(e.target.value)}
              placeholder="Buscar por N° de orden, título o empresa..."
              className="w-full input-field w-auto mb-3" />
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {buscandoOC && <p className="text-sm text-gray-400 py-4 text-center">Cargando…</p>}
              {!buscandoOC && ordenesCompraFiltradas.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Sin resultados.</p>
              )}
              {ordenesCompraFiltradas.map((o) => (
                <button key={o._id} type="button" onClick={() => elegirOC(o)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition text-sm">
                  <div className="font-medium text-gray-800">{o.numeroOrden || o.codigo} — {o.titulo}</div>
                  <div className="text-xs text-gray-400">{o.empresa?.razonSocial || "—"} · S/ {Number(o.monto).toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
