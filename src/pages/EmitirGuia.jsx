import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { fetchAuth } from "../utils/fetchAuth";
import {
  TIPO_GUIA,
  MODALIDAD_TRASLADO,
  MOTIVO_TRASLADO,
  UNIDAD_PESO,
  UNIDADES_MEDIDA,
  TIPO_DOC_RECEPTOR,
  DOCUMENTO_RELACIONADO_GRE,
  itemVacioGuia,
  documentoValido,
  serieValida,
  ubigeoValido,
  normalizarPlaca,
  placaValida,
} from "../utils/catalogosSunat";

const PARTE_VACIA         = { schemeID: "6", numDoc: "", nombre: "" };
const DIRECCION_VACIA     = { ubigeo: "", direccion: "" };
const VEHICULO_VACIO      = { placa: "" };
const CONDUCTOR_VACIO     = { tipoDoc: "1", numDoc: "", nombres: "", apellidos: "", licencia: "" };
const TRANSPORTISTA_VACIO = { ruc: "", razonSocial: "", registroMTC: "" };

// Empresa emisora fija — este ERP emite GRE únicamente a nombre de Huaquian.
// Las credenciales SUNAT (incluidas las de GRE) las resuelve el hub central por
// RUC — no hay registro de credenciales en el ERP. Deben coincidir con
// RUC_EMISOR/RAZON_SOCIAL_EMISOR de Backend/.env. Serie fija por tipo de guía,
// terminada en "2" igual que las series de CPE (ver EmitirComprobante.jsx)
// para evitar futuros conflictos de correlativo. Motivo de traslado por
// defecto: "01" (Venta) — catálogo 20 SUNAT.
const RUC_EMISOR = "20601565235";
const NOMBRE_EMISOR = "HUAQUIAN";
const SERIE_POR_TIPO_GUIA = { REMITENTE: "T002", TRANSPORTISTA: "V002" };

// Motivo de traslado (catálogo 20) para el que aplican Proveedor/Comprador — confirmado contra la
// hoja oficial de reglas de validación SUNAT (info GRE sunat/Reglas de Validación...xlsx).
const MOTIVOS_PROVEEDOR = ["02", "07", "13"];
const MOTIVOS_COMPRADOR = ["03", "13"];
const MOTIVOS_COMERCIO_EXTERIOR = ["08", "09", "19"];

function docRelacionadoVacio() {
  return { _key: Date.now() + Math.random(), tipoDoc: "01", numero: "" };
}

function vehiculoSecundarioVacio() {
  return { _key: Date.now() + Math.random(), placa: "" };
}

function conductorSecundarioVacio() {
  return { _key: Date.now() + Math.random(), tipoDoc: "1", numDoc: "", nombres: "", apellidos: "", licencia: "" };
}

// Marca visual de campo obligatorio, junto al texto del label.
function Oblig() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

// Ícono de ayuda con tooltip nativo — usado en campos que insertan un código
// SUNAT sin catálogo desplegable visible (toggles binarios, ubigeo libre).
function Ayuda({ texto }) {
  return (
    <span
      title={texto}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-gray-400 text-[10px] font-bold ml-1.5 cursor-help select-none align-middle"
    >
      ?
    </span>
  );
}

export default function EmitirGuia() {
  // Llega desde el card "Generar GRE" del detalle de una OT padre — ver
  // DetalleOrdenTrabajo.jsx:abrirGenerarGRE / ModalGenerarGRE.jsx. Los ítems
  // vienen ya armados (títulos de la OT o sus sub-OTs elegidas); el resto del
  // form (motivo, transporte, etc.) se sigue llenando a mano.
  const location = useLocation();
  const prellenado = location.state?.prellenarGRE || null;

  const [rucEmisor] = useState(RUC_EMISOR);
  const [tipoGuia, setTipoGuia]         = useState("REMITENTE");
  const [serie, setSerie]               = useState(SERIE_POR_TIPO_GUIA.REMITENTE);
  const [modalidadTraslado, setModalidadTraslado] = useState("02");
  const [motivoTraslado, setMotivoTraslado]       = useState("01");
  const [descripcionMotivo, setDescripcionMotivo] = useState("");
  const [fechaTraslado, setFechaTraslado]         = useState("");
  const [fechaEntregaBienesTransportista, setFechaEntregaBienesTransportista] = useState("");
  const [pesoBrutoTotal, setPesoBrutoTotal]       = useState("");
  const [unidadPeso, setUnidadPeso]               = useState("KGM");
  const [numeroBultos, setNumeroBultos]           = useState("");

  const [comprobantes, setComprobantes] = useState([]);
  const [comprobanteId, setComprobanteId] = useState("");

  const [destinatario, setDestinatario] = useState(() =>
    prellenado?.destinatario ? { ...PARTE_VACIA, ...prellenado.destinatario } : PARTE_VACIA);
  const [remitente, setRemitente]       = useState(PARTE_VACIA);
  const [proveedor, setProveedor]       = useState(PARTE_VACIA);
  const [comprador, setComprador]       = useState(PARTE_VACIA);
  const [puntoPartida, setPuntoPartida] = useState(DIRECCION_VACIA);
  const [puntoLlegada, setPuntoLlegada] = useState(DIRECCION_VACIA);
  const [transportista, setTransportista] = useState(TRANSPORTISTA_VACIO);
  const [vehiculo, setVehiculo]           = useState(VEHICULO_VACIO);
  const [conductor, setConductor]         = useState(CONDUCTOR_VACIO);
  const [vehiculosSecundarios, setVehiculosSecundarios]   = useState([]);
  const [conductoresSecundarios, setConductoresSecundarios] = useState([]);
  const [items, setItems]                 = useState(() =>
    prellenado?.items?.length ? prellenado.items.map((i) => ({ ...itemVacioGuia(), ...i })) : [itemVacioGuia()]);
  const [ordenesTrabajo]                  = useState(prellenado?.ordenesTrabajo || []);

  // Solo GRE Transportista.
  const [pagadorFlete, setPagadorFlete]                 = useState(PARTE_VACIA);
  const [indicadorPagadorFlete, setIndicadorPagadorFlete] = useState("");
  const [transporteSubcontratado, setTransporteSubcontratado] = useState(false);
  const [empresaSubcontrata, setEmpresaSubcontrata]     = useState(TRANSPORTISTA_VACIO);

  const [observaciones, setObservaciones]           = useState("");
  const [documentosRelacionados, setDocumentosRelacionados] = useState([]);
  const [realizaTransbordo, setRealizaTransbordo]   = useState(false);
  const [retornoEnvasesVacios, setRetornoEnvasesVacios] = useState(false);
  const [retornoVehiculoVacio, setRetornoVehiculoVacio] = useState(false);
  const [esM1L, setEsM1L]                           = useState(false);
  const [placaM1L, setPlacaM1L]                     = useState("");

  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState("");
  const [resultado, setResultado]     = useState(null);

  useEffect(() => {
    if (!rucEmisor) { setComprobantes([]); return; }
    fetchAuth(`/cpe?rucEmisor=${rucEmisor}&estado=ACEPTADO&limit=50`).then(async (r) => {
      const data = await r.json();
      if (data.ok) setComprobantes(data.data);
    });
  }, [rucEmisor]);

  const buscarRuc = async (ruc, setter = null, campoNombre = "nombre", direccionSetter = null) => {
    if (ruc.length !== 11) return;
    setBuscandoDoc(true);
    try {
      const res = await fetchAuth(`/sunat/ruc/${ruc}`);
      if (!res.ok) { setError("RUC no encontrado en SUNAT"); return; }
      const data = await res.json();
      if (setter) setter((prev) => ({ ...prev, [campoNombre]: data.razonSocial || prev[campoNombre] }));
      if (direccionSetter) {
        direccionSetter((prev) => ({
          ubigeo:    data.ubigeo || prev.ubigeo,
          direccion: data.direccion?.trim() || prev.direccion,
        }));
      }
      setError("");
    } catch {
      setError("Error al consultar SUNAT");
    } finally {
      setBuscandoDoc(false);
    }
  };

  // Cuando el emisor traslada su propia mercadería (tipoGuia=REMITENTE), el punto de partida es
  // su propio domicilio — se autocompleta con el mismo mecanismo que destinatario/remitente, sin
  // que el usuario tenga que reescribir un RUC que ya seleccionó en el dropdown de empresa emisora.
  useEffect(() => {
    if (!rucEmisor || tipoGuia !== "REMITENTE") return;
    buscarRuc(rucEmisor, null, "nombre", setPuntoPartida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rucEmisor, tipoGuia]);

  const ligarComprobante = async (id) => {
    setComprobanteId(id);
    if (!id) return;
    const res  = await fetchAuth(`/cpe/${id}`);
    const data = await res.json();
    if (!data.ok) return;
    const c = data.data;
    setDestinatario({ schemeID: c.receptor.schemeID, numDoc: c.receptor.numDoc, nombre: c.receptor.nombre });
    setItems(c.items.map((i) => ({
      _key: Date.now() + Math.random(),
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      codigoProducto: i.codigoProducto || "",
    })));
  };

  const campoDestinatario     = (e) => setDestinatario({ ...destinatario, [e.target.name]: e.target.value });
  const campoRemitente        = (e) => setRemitente({ ...remitente, [e.target.name]: e.target.value });
  const campoProveedor        = (e) => setProveedor({ ...proveedor, [e.target.name]: e.target.value });
  const campoComprador        = (e) => setComprador({ ...comprador, [e.target.name]: e.target.value });
  const campoPagadorFlete     = (e) => setPagadorFlete({ ...pagadorFlete, [e.target.name]: e.target.value });
  const campoEmpresaSubcontrata = (e) => setEmpresaSubcontrata({ ...empresaSubcontrata, [e.target.name]: e.target.value });
  const campoPuntoPartida  = (e) => setPuntoPartida({ ...puntoPartida, [e.target.name]: e.target.value });
  const campoPuntoLlegada  = (e) => setPuntoLlegada({ ...puntoLlegada, [e.target.name]: e.target.value });
  const campoTransportista = (e) => setTransportista({ ...transportista, [e.target.name]: e.target.value });
  const campoVehiculo      = (e) => setVehiculo({ ...vehiculo, [e.target.name]: e.target.value });
  const campoConductor     = (e) => setConductor({ ...conductor, [e.target.name]: e.target.value });

  const handleItem = (key, campo, valor) =>
    setItems(items.map((i) => (i._key === key ? { ...i, [campo]: valor } : i)));
  const agregarItem = () => setItems([...items, itemVacioGuia()]);
  const eliminarItem = (key) => setItems(items.filter((i) => i._key !== key));

  // Vehículos/conductores secundarios (hasta 2 adicionales) — solo transporte privado.
  const handleVehiculoSecundario = (key, valor) =>
    setVehiculosSecundarios(vehiculosSecundarios.map((v) => (v._key === key ? { ...v, placa: valor } : v)));
  const agregarVehiculoSecundario = () =>
    vehiculosSecundarios.length < 2 && setVehiculosSecundarios([...vehiculosSecundarios, vehiculoSecundarioVacio()]);
  const eliminarVehiculoSecundario = (key) =>
    setVehiculosSecundarios(vehiculosSecundarios.filter((v) => v._key !== key));

  const handleConductorSecundario = (key, campo, valor) =>
    setConductoresSecundarios(conductoresSecundarios.map((c) => (c._key === key ? { ...c, [campo]: valor } : c)));
  const agregarConductorSecundario = () =>
    conductoresSecundarios.length < 2 && setConductoresSecundarios([...conductoresSecundarios, conductorSecundarioVacio()]);
  const eliminarConductorSecundario = (key) =>
    setConductoresSecundarios(conductoresSecundarios.filter((c) => c._key !== key));

  const handleDocRelacionado = (key, campo, valor) =>
    setDocumentosRelacionados(documentosRelacionados.map((d) => (d._key === key ? { ...d, [campo]: valor } : d)));
  const agregarDocRelacionado = () => setDocumentosRelacionados([...documentosRelacionados, docRelacionadoVacio()]);
  const eliminarDocRelacionado = (key) => setDocumentosRelacionados(documentosRelacionados.filter((d) => d._key !== key));

  const ro = !!resultado?.ok;

  const validar = () => {
    if (!rucEmisor) return "Selecciona la empresa emisora.";
    if (!serie.trim()) return "La serie es requerida.";
    if (!serieValida(serie)) return "La serie debe tener exactamente 4 caracteres (ej. T001).";
    if (!fechaTraslado) return "La fecha de traslado es requerida.";
    if (!pesoBrutoTotal || Number(pesoBrutoTotal) <= 0) return "El peso bruto total debe ser mayor a 0.";
    if (motivoTraslado === "13" && !descripcionMotivo.trim()) return "Describe el motivo cuando seleccionas 'Otros'.";
    if (!destinatario.numDoc.trim() || !destinatario.nombre.trim()) return "Los datos del destinatario son requeridos.";
    if (!documentoValido(destinatario.schemeID, destinatario.numDoc)) {
      return destinatario.schemeID === "6"
        ? "El RUC del destinatario debe tener 11 dígitos."
        : destinatario.schemeID === "1"
        ? "El DNI del destinatario debe tener 8 dígitos."
        : "El documento del destinatario no es válido.";
    }
    for (const item of items) {
      if (!item.descripcion.trim()) return "Todos los ítems deben tener descripción.";
      if (!item.cantidad || Number(item.cantidad) <= 0) return "La cantidad de cada ítem debe ser mayor a 0.";
    }
    if (!puntoPartida.ubigeo.trim() || !puntoPartida.direccion.trim()) return "El punto de partida es requerido.";
    if (!ubigeoValido(puntoPartida.ubigeo)) return "El ubigeo del punto de partida debe tener 6 dígitos.";
    if (!puntoLlegada.ubigeo.trim() || !puntoLlegada.direccion.trim()) return "El punto de llegada es requerido.";
    if (!ubigeoValido(puntoLlegada.ubigeo)) return "El ubigeo del punto de llegada debe tener 6 dígitos.";
    if (tipoGuia === "TRANSPORTISTA") {
      if (!remitente.numDoc.trim() || !remitente.nombre.trim()) {
        return "La guía de transportista requiere los datos del remitente de la carga.";
      }
      if (!documentoValido(remitente.schemeID, remitente.numDoc)) {
        return remitente.schemeID === "6"
          ? "El RUC del remitente debe tener 11 dígitos."
          : remitente.schemeID === "1"
          ? "El DNI del remitente debe tener 8 dígitos."
          : "El documento del remitente no es válido.";
      }
      if (transporteSubcontratado && (!empresaSubcontrata.ruc.trim() || !empresaSubcontrata.razonSocial.trim())) {
        return "El transporte subcontratado requiere el RUC y la razón social de la empresa subcontratada.";
      }
    }
    // Proveedor y Comprador son opcionales en SUNAT incluso con el motivo de traslado que los
    // habilita — omitirlos genera a lo sumo una OBSERVACIÓN (4054/4377/4378), nunca un ERROR
    // bloqueante (confirmado contra la hoja oficial de reglas de validación SUNAT). Solo se exige
    // consistencia si el usuario empezó a llenar uno de los dos campos.
    if ((proveedor.numDoc.trim() || proveedor.nombre.trim())
      && (!proveedor.numDoc.trim() || !proveedor.nombre.trim())) {
      return "Completa el documento y nombre del proveedor, o deja ambos campos vacíos.";
    }
    if ((comprador.numDoc.trim() || comprador.nombre.trim())
      && (!comprador.numDoc.trim() || !comprador.nombre.trim())) {
      return "Completa el documento y nombre del comprador, o deja ambos campos vacíos.";
    }
    if (modalidadTraslado === "02") {
      if (!placaValida(vehiculo.placa)) return "La placa del vehículo no tiene un formato válido (solo letras y números, sin guiones).";
      if (!conductor.numDoc.trim() || !conductor.nombres.trim() || !conductor.apellidos.trim() || !conductor.licencia.trim()) {
        return "El transporte privado requiere los datos completos del conductor.";
      }
      if (!documentoValido(conductor.tipoDoc, conductor.numDoc)) {
        return conductor.tipoDoc === "1"
          ? "El DNI del conductor debe tener 8 dígitos."
          : "El documento del conductor no es válido.";
      }
    }
    if (modalidadTraslado === "01") {
      if (esM1L) {
        if (!placaValida(placaM1L)) return "La placa del vehículo M1/L no tiene un formato válido (solo letras y números, sin guiones).";
      } else {
        if (!transportista.ruc.trim() || !transportista.razonSocial.trim()) {
          return "El transporte público requiere el RUC y la razón social del transportista.";
        }
        if (!documentoValido("6", transportista.ruc)) return "El RUC del transportista debe tener 11 dígitos.";
      }
      if (!fechaEntregaBienesTransportista) {
        return "El transporte público requiere la fecha de entrega de bienes al transportista.";
      }
    }
    for (const doc of documentosRelacionados) {
      if (!doc.numero.trim()) return "Todos los documentos relacionados deben tener número.";
    }
    for (const v of vehiculosSecundarios) {
      if (!placaValida(v.placa)) return "Todos los vehículos secundarios deben tener una placa con formato válido (sin guiones).";
    }
    for (const c of conductoresSecundarios) {
      if (!c.numDoc.trim() || !c.nombres.trim() || !c.apellidos.trim() || !c.licencia.trim()) {
        return "Todos los conductores secundarios requieren documento, nombres, apellidos y licencia.";
      }
    }
    return null;
  };

  const emitir = async () => {
    setCargando(true);
    setError("");
    try {
      const body = {
        rucEmisor,
        tipoGuia,
        serie: serie.trim().toUpperCase(),
        modalidadTraslado,
        fechaTraslado,
        ...(modalidadTraslado === "01" ? { fechaEntregaBienesTransportista } : {}),
        motivoTraslado,
        ...(motivoTraslado === "13" ? { descripcionMotivo: descripcionMotivo.trim() } : {}),
        pesoBrutoTotal: Number(pesoBrutoTotal),
        unidadPeso,
        ...(numeroBultos ? { numeroBultos: Number(numeroBultos) } : {}),
        puntoPartida,
        puntoLlegada,
        ...(comprobanteId ? { comprobanteRef: { comprobanteId } } : {}),
        destinatario: {
          numDoc:   destinatario.numDoc.trim(),
          nombre:   destinatario.nombre.trim(),
          schemeID: destinatario.schemeID,
        },
        items: items.map((i) => ({
          descripcion: i.descripcion,
          cantidad:    Number(i.cantidad),
          unidad:      i.unidad,
          ...(i.codigoProducto ? { codigoProducto: i.codigoProducto } : {}),
          ...(i.codigoSubpartida ? { codigoSubpartida: i.codigoSubpartida } : {}),
          ...(i.esBienNormalizado ? { esBienNormalizado: true } : {}),
          ...(i.codigoProductoGS1 ? { codigoProductoGS1: i.codigoProductoGS1, tipoCodigoProductoGS1: i.tipoCodigoProductoGS1 } : {}),
          ...(i.codigoProductoSunat ? { codigoProductoSunat: i.codigoProductoSunat } : {}),
        })),
        ...(tipoGuia === "TRANSPORTISTA" ? {
          remitente: { numDoc: remitente.numDoc.trim(), nombre: remitente.nombre.trim(), schemeID: remitente.schemeID },
          ...(pagadorFlete.numDoc.trim() ? {
            pagadorFlete: { numDoc: pagadorFlete.numDoc.trim(), nombre: pagadorFlete.nombre.trim(), schemeID: pagadorFlete.schemeID },
          } : {}),
          ...(indicadorPagadorFlete ? { indicadorPagadorFlete } : {}),
          ...(transporteSubcontratado ? {
            transporteSubcontratado: { aplica: true, empresaSubcontrata },
          } : {}),
        } : {}),
        ...(proveedor.numDoc.trim() ? {
          proveedor: { numDoc: proveedor.numDoc.trim(), nombre: proveedor.nombre.trim(), schemeID: proveedor.schemeID },
        } : {}),
        ...(comprador.numDoc.trim() ? {
          comprador: { numDoc: comprador.numDoc.trim(), nombre: comprador.nombre.trim(), schemeID: comprador.schemeID },
        } : {}),
        ...(modalidadTraslado === "01"
          ? (esM1L ? { vehiculoM1L: { aplica: true, placa: normalizarPlaca(placaM1L) } } : { transportista })
          : {
              vehiculo: { ...vehiculo, placa: normalizarPlaca(vehiculo.placa) }, conductor,
              ...(vehiculosSecundarios.length ? { vehiculosSecundarios: vehiculosSecundarios.map((v) => ({ placa: normalizarPlaca(v.placa) })) } : {}),
              ...(conductoresSecundarios.length ? {
                conductoresSecundarios: conductoresSecundarios.map((c) => ({
                  tipoDoc: c.tipoDoc, numDoc: c.numDoc.trim(), nombres: c.nombres.trim(), apellidos: c.apellidos.trim(), licencia: c.licencia.trim(),
                })),
              } : {}),
            }),
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        ...(documentosRelacionados.length ? {
          documentosRelacionados: documentosRelacionados.map((d) => ({ tipoDoc: d.tipoDoc, numero: d.numero.trim() })),
        } : {}),
        realizaTransbordo, retornoEnvasesVacios, retornoVehiculoVacio,
        ...(ordenesTrabajo.length ? { ordenesTrabajo } : {}),
      };
      const res  = await fetchAuth("/guias", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      setResultado(data);
      if (!data.ok) setError(data.mensaje || data.error || "La guía fue rechazada por SUNAT.");
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  const nuevo = () => {
    setSerie("");
    setModalidadTraslado("02");
    setMotivoTraslado("01");
    setDescripcionMotivo("");
    setFechaTraslado("");
    setFechaEntregaBienesTransportista("");
    setPesoBrutoTotal("");
    setNumeroBultos("");
    setComprobanteId("");
    setDestinatario(PARTE_VACIA);
    setRemitente(PARTE_VACIA);
    setProveedor(PARTE_VACIA);
    setComprador(PARTE_VACIA);
    setPuntoPartida(DIRECCION_VACIA);
    setPuntoLlegada(DIRECCION_VACIA);
    setTransportista(TRANSPORTISTA_VACIO);
    setVehiculo(VEHICULO_VACIO);
    setConductor(CONDUCTOR_VACIO);
    setVehiculosSecundarios([]);
    setConductoresSecundarios([]);
    setPagadorFlete(PARTE_VACIA);
    setIndicadorPagadorFlete("");
    setTransporteSubcontratado(false);
    setEmpresaSubcontrata(TRANSPORTISTA_VACIO);
    setItems([itemVacioGuia()]);
    setObservaciones("");
    setDocumentosRelacionados([]);
    setRealizaTransbordo(false);
    setRetornoEnvasesVacios(false);
    setRetornoVehiculoVacio(false);
    setEsM1L(false);
    setPlacaM1L("");
    setResultado(null);
    setError("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Emitir Guía de Remisión</h2>
        {resultado?.ok && <span className="font-mono text-sm text-gray-400">{resultado.nombre}</span>}
      </div>

      {prellenado && !resultado && (
        <div className="bg-sky-50 border border-sky-200 text-sky-700 text-sm rounded-lg px-4 py-3 mb-5">
          Ítems y destinatario prellenados desde la Orden de Trabajo — revisa antes de emitir.
        </div>
      )}
      {resultado?.ok && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-5">
          Guía <strong>{resultado.nombre}</strong> ACEPTADA por SUNAT.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        {/* Tipo de guía */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-5 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-500 flex items-center">
            Tipo de guía:
            <Ayuda texto="Remitente: el emisor es el dueño de la carga que traslada. Transportista: el emisor solo presta el servicio de transporte para la carga de otra empresa (remitente)." />
          </span>
          {TIPO_GUIA.map((t) => (
            <button
              key={t.valor} type="button" disabled={ro}
              onClick={() => { setTipoGuia(t.valor); setSerie(SERIE_POR_TIPO_GUIA[t.valor]); }}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition ${
                tipoGuia === t.valor
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-500 hover:border-gray-300 hover:text-gray-800"
              } disabled:cursor-not-allowed`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Cabecera */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="grid grid-cols-3 gap-4">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de traslado<Oblig /></label>
              <input type="date" value={fechaTraslado} onChange={(e) => setFechaTraslado(e.target.value)}
                disabled={ro} required
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                Modalidad de traslado
                <Ayuda texto="Público: el traslado lo realiza una empresa de transporte con RUC propio (se registra el transportista). Privado: el emisor traslada la carga con su propio vehículo y conductor." />
              </label>
              <div className="flex gap-3">
                {MODALIDAD_TRASLADO.map((m) => (
                  <button
                    key={m.valor} type="button" disabled={ro}
                    onClick={() => setModalidadTraslado(m.valor)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                      modalidadTraslado === m.valor
                        ? "bg-gray-900 text-white"
                        : "border border-gray-300 text-gray-500 hover:border-gray-300 hover:text-gray-800"
                    } disabled:cursor-not-allowed`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo de traslado</label>
              <select value={motivoTraslado} onChange={(e) => setMotivoTraslado(e.target.value)} disabled={ro}
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                {MOTIVO_TRASLADO.map((m) => (
                  <option key={m.valor} value={m.valor}>{m.label}</option>
                ))}
              </select>
            </div>
            {motivoTraslado === "13" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Describe el motivo<Oblig /></label>
                <input value={descripcionMotivo} onChange={(e) => setDescripcionMotivo(e.target.value)}
                  disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Peso bruto total<Oblig /></label>
              <input type="number" min="0" step="0.01" value={pesoBrutoTotal}
                onChange={(e) => setPesoBrutoTotal(e.target.value)} disabled={ro} required
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Unidad de peso</label>
              <select value={unidadPeso} onChange={(e) => setUnidadPeso(e.target.value)} disabled={ro}
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                {UNIDAD_PESO.map((u) => (
                  <option key={u.valor} value={u.valor}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">N.º de bultos (opcional)</label>
              <input type="number" min="0" step="1" value={numeroBultos}
                onChange={(e) => setNumeroBultos(e.target.value)} disabled={ro}
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
          </div>
        </div>

        {/* Ligar a comprobante */}
        {!ro && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Ligar a factura/boleta ya emitida (opcional)
            </p>
            <select value={comprobanteId} onChange={(e) => ligarComprobante(e.target.value)} disabled={!rucEmisor}
              className="w-full input-field disabled:bg-gray-50 disabled:text-gray-500">
              <option value="">— Sin ligar (llenar destinatario e ítems manualmente) —</option>
              {comprobantes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.serie}-{String(c.correlativo).padStart(8, "0")} — {c.receptor?.nombre}
                </option>
              ))}
            </select>
            {comprobanteId && (
              <p className="text-xs text-gray-400 mt-2">
                Destinatario e ítems se cargaron desde el comprobante seleccionado — puedes editarlos si es necesario.
              </p>
            )}
          </div>
        )}

        {/* Destinatario */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Destinatario</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
              <select name="schemeID" value={destinatario.schemeID} onChange={campoDestinatario} disabled={ro}
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
              <input name="numDoc" value={destinatario.numDoc} onChange={campoDestinatario}
                onBlur={(e) => destinatario.schemeID === "6" && buscarRuc(e.target.value, setDestinatario, "nombre", setPuntoLlegada)}
                disabled={ro} required
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Razón social<Oblig /></label>
              <input name="nombre" value={destinatario.nombre} onChange={campoDestinatario} disabled={ro} required
                className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
          </div>
        </div>

        {/* Remitente (solo guía de transportista) */}
        {tipoGuia === "TRANSPORTISTA" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center">
              Remitente (dueño de la carga)
              <Ayuda texto="Obligatorio cuando el emisor es el transportista: identifica a la empresa dueña de la mercadería que se traslada." />
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
                <select name="schemeID" value={remitente.schemeID} onChange={campoRemitente} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  {TIPO_DOC_RECEPTOR.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Número de documento<Oblig /></label>
                <input name="numDoc" value={remitente.numDoc} onChange={campoRemitente}
                  onBlur={(e) => remitente.schemeID === "6" && buscarRuc(e.target.value, setRemitente, "nombre", setPuntoPartida)}
                  disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Razón social<Oblig /></label>
                <input name="nombre" value={remitente.nombre} onChange={campoRemitente} disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Proveedor (solo motivo de traslado 02-Compra, 07-Recojo de bienes transformados u 13-Otros) */}
        {MOTIVOS_PROVEEDOR.includes(motivoTraslado) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center">
              Proveedor (opcional)
              <Ayuda texto="Solo aplica cuando el motivo de traslado es Compra, Recojo de bienes transformados u Otros." />
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
                <select name="schemeID" value={proveedor.schemeID} onChange={campoProveedor} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  {TIPO_DOC_RECEPTOR.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Número de documento</label>
                <input name="numDoc" value={proveedor.numDoc} onChange={campoProveedor}
                  onBlur={(e) => proveedor.schemeID === "6" && buscarRuc(e.target.value, setProveedor, "nombre")}
                  disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Razón social</label>
                <input name="nombre" value={proveedor.nombre} onChange={campoProveedor} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Comprador (solo motivo de traslado 03-Venta con entrega a terceros u 13-Otros) */}
        {MOTIVOS_COMPRADOR.includes(motivoTraslado) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center">
              Comprador (opcional)
              <Ayuda texto="Solo aplica cuando el motivo de traslado es Venta con entrega a terceros u Otros. Omitirlo no bloquea la emisión — SUNAT lo trata como observación, no como error." />
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
                <select name="schemeID" value={comprador.schemeID} onChange={campoComprador} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  {TIPO_DOC_RECEPTOR.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Número de documento</label>
                <input name="numDoc" value={comprador.numDoc} onChange={campoComprador}
                  onBlur={(e) => comprador.schemeID === "6" && buscarRuc(e.target.value, setComprador, "nombre")}
                  disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Razón social</label>
                <input name="nombre" value={comprador.nombre} onChange={campoComprador} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Pagador de flete y subcontratación (solo guía de transportista) */}
        {tipoGuia === "TRANSPORTISTA" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Pagador de flete y subcontratación (opcional)
            </p>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
                <select name="schemeID" value={pagadorFlete.schemeID} onChange={campoPagadorFlete} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  {TIPO_DOC_RECEPTOR.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Documento del pagador de flete</label>
                <input name="numDoc" value={pagadorFlete.numDoc} onChange={campoPagadorFlete}
                  onBlur={(e) => pagadorFlete.schemeID === "6" && buscarRuc(e.target.value, setPagadorFlete, "nombre")}
                  disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre / Razón social</label>
                <input name="nombre" value={pagadorFlete.nombre} onChange={campoPagadorFlete} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quién paga el flete</label>
                <select value={indicadorPagadorFlete} onChange={(e) => setIndicadorPagadorFlete(e.target.value)}
                  disabled={ro} className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  <option value="">— No indicar —</option>
                  <option value="REMITENTE">Remitente</option>
                  <option value="SUBCONTRATADOR">Subcontratador</option>
                  <option value="TERCERO">Tercero</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <input type="checkbox" checked={transporteSubcontratado} disabled={ro}
                onChange={(e) => setTransporteSubcontratado(e.target.checked)} />
              Transporte subcontratado
            </label>
            {transporteSubcontratado && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">RUC de la empresa subcontratada<Oblig /></label>
                  <input name="ruc" value={empresaSubcontrata.ruc} onChange={campoEmpresaSubcontrata}
                    onBlur={(e) => buscarRuc(e.target.value, setEmpresaSubcontrata, "razonSocial")}
                    disabled={ro} required maxLength={11}
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Razón social<Oblig /></label>
                  <input name="razonSocial" value={empresaSubcontrata.razonSocial} onChange={campoEmpresaSubcontrata}
                    disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Documentos relacionados (opcional) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Documentos relacionados (opcional)
          </p>
          {documentosRelacionados.map((doc) => (
            <div key={doc._key} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento</label>
                <select value={doc.tipoDoc} disabled={ro}
                  onChange={(e) => handleDocRelacionado(doc._key, "tipoDoc", e.target.value)}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  {DOCUMENTO_RELACIONADO_GRE.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Número</label>
                <input value={doc.numero} disabled={ro}
                  onChange={(e) => handleDocRelacionado(doc._key, "numero", e.target.value)}
                  placeholder="F001-00000003"
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              {!ro && (
                <button type="button" onClick={() => eliminarDocRelacionado(doc._key)}
                  className="text-red-400 hover:text-red-600 pb-2">✕</button>
              )}
            </div>
          ))}
          {!ro && (
            <button type="button" onClick={agregarDocRelacionado}
              className="text-sm text-gray-500 hover:text-gray-800 transition">
              + Agregar documento relacionado
            </button>
          )}
          {comprobanteId && (
            <p className="text-xs text-gray-400 mt-2">
              La factura/boleta ligada arriba se agrega automáticamente como documento relacionado —
              solo agrega aquí documentos adicionales (ej. Manifiesto de Carga, Liquidación de Compra).
            </p>
          )}
        </div>

        {/* Puntos de partida y llegada */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Punto de partida</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                    Ubigeo<Oblig />
                    <Ayuda texto="Código INEI de 6 dígitos (2 departamento + 2 provincia + 2 distrito), ej. 150101 = Lima / Lima / Lima." />
                  </label>
                  <input name="ubigeo" value={puntoPartida.ubigeo} onChange={campoPuntoPartida}
                    disabled={ro} required maxLength={6}
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dirección<Oblig /></label>
                  <input name="direccion" value={puntoPartida.direccion} onChange={campoPuntoPartida}
                    disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Punto de llegada</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                    Ubigeo<Oblig />
                    <Ayuda texto="Código INEI de 6 dígitos (2 departamento + 2 provincia + 2 distrito), ej. 150101 = Lima / Lima / Lima." />
                  </label>
                  <input name="ubigeo" value={puntoLlegada.ubigeo} onChange={campoPuntoLlegada}
                    disabled={ro} required maxLength={6}
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dirección<Oblig /></label>
                  <input name="direccion" value={puntoLlegada.direccion} onChange={campoPuntoLlegada}
                    disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transporte: transportista (público) o vehículo+conductor (privado) */}
        {modalidadTraslado === "01" ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Transportista</p>
            <label className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <input type="checkbox" checked={esM1L} disabled={ro}
                onChange={(e) => setEsM1L(e.target.checked)} />
              Vehículo de categoría M1 o L (transporte ligero)
              <Ayuda texto="Exime de declarar los datos completos del transportista (art. 21.2, R.S. N° 000123-2022/SUNAT) — solo se pide la placa." />
            </label>
            {esM1L ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Placa<Oblig /></label>
                  <input value={placaM1L} onChange={(e) => setPlacaM1L(e.target.value)}
                    disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de entrega de bienes al transportista<Oblig /></label>
                  <input type="date" value={fechaEntregaBienesTransportista}
                    onChange={(e) => setFechaEntregaBienesTransportista(e.target.value)}
                    disabled={ro} required
                    className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">RUC<Oblig /></label>
                    <input name="ruc" value={transportista.ruc} onChange={campoTransportista}
                      onBlur={(e) => buscarRuc(e.target.value, setTransportista, "razonSocial")}
                      disabled={ro} required maxLength={11}
                      className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Razón social<Oblig /></label>
                    <input name="razonSocial" value={transportista.razonSocial} onChange={campoTransportista}
                      disabled={ro} required
                      className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de entrega de bienes al transportista<Oblig /></label>
                    <input type="date" value={fechaEntregaBienesTransportista}
                      onChange={(e) => setFechaEntregaBienesTransportista(e.target.value)}
                      disabled={ro} required
                      className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Registro MTC (opcional)</label>
                    <input name="registroMTC" value={transportista.registroMTC} onChange={campoTransportista}
                      disabled={ro}
                      className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vehículo y conductor</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Placa<Oblig /></label>
                <input name="placa" value={vehiculo.placa} onChange={campoVehiculo} disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de documento del conductor</label>
                <select name="tipoDoc" value={conductor.tipoDoc} onChange={campoConductor} disabled={ro}
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                  {TIPO_DOC_RECEPTOR.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Documento del conductor<Oblig /></label>
                <input name="numDoc" value={conductor.numDoc} onChange={campoConductor} disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombres<Oblig /></label>
                <input name="nombres" value={conductor.nombres} onChange={campoConductor} disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Apellidos<Oblig /></label>
                <input name="apellidos" value={conductor.apellidos} onChange={campoConductor} disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Licencia de conducir<Oblig /></label>
                <input name="licencia" value={conductor.licencia} onChange={campoConductor} disabled={ro} required
                  className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>

            {/* Vehículos secundarios (hasta 2 adicionales al principal) */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Vehículos secundarios (opcional, máx. 2)
              </p>
              {vehiculosSecundarios.map((v, idx) => (
                <div key={v._key} className="grid grid-cols-[1fr_auto] gap-4 items-end mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Placa {idx + 1}</label>
                    <input value={v.placa} disabled={ro}
                      onChange={(e) => handleVehiculoSecundario(v._key, e.target.value)}
                      className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                  {!ro && (
                    <button type="button" onClick={() => eliminarVehiculoSecundario(v._key)}
                      className="text-red-400 hover:text-red-600 pb-2">✕</button>
                  )}
                </div>
              ))}
              {!ro && vehiculosSecundarios.length < 2 && (
                <button type="button" onClick={agregarVehiculoSecundario}
                  className="text-sm text-gray-500 hover:text-gray-800 transition">
                  + Agregar vehículo secundario
                </button>
              )}
            </div>

            {/* Conductores secundarios (hasta 2 adicionales al principal) */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Conductores secundarios (opcional, máx. 2)
              </p>
              {conductoresSecundarios.map((c, idx) => (
                <div key={c._key} className="mb-4">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tipo doc.</label>
                      <select value={c.tipoDoc} disabled={ro}
                        onChange={(e) => handleConductorSecundario(c._key, "tipoDoc", e.target.value)}
                        className="input-field w-auto disabled:bg-gray-50 disabled:text-gray-500">
                        {TIPO_DOC_RECEPTOR.map((t) => (
                          <option key={t.valor} value={t.valor}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Documento {idx + 1}</label>
                      <input value={c.numDoc} disabled={ro}
                        onChange={(e) => handleConductorSecundario(c._key, "numDoc", e.target.value)}
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Nombres</label>
                      <input value={c.nombres} disabled={ro}
                        onChange={(e) => handleConductorSecundario(c._key, "nombres", e.target.value)}
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Apellidos</label>
                      <input value={c.apellidos} disabled={ro}
                        onChange={(e) => handleConductorSecundario(c._key, "apellidos", e.target.value)}
                        className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                    </div>
                    {!ro && (
                      <button type="button" onClick={() => eliminarConductorSecundario(c._key)}
                        className="text-red-400 hover:text-red-600 pb-2">✕</button>
                    )}
                  </div>
                  <div className="mt-2 w-1/3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Licencia de conducir</label>
                    <input value={c.licencia} disabled={ro}
                      onChange={(e) => handleConductorSecundario(c._key, "licencia", e.target.value)}
                      className="w-full input-field w-auto disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                </div>
              ))}
              {!ro && conductoresSecundarios.length < 2 && (
                <button type="button" onClick={agregarConductorSecundario}
                  className="text-sm text-gray-500 hover:text-gray-800 transition">
                  + Agregar conductor secundario
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabla de items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-100">
                <tr>
                  <th className="px-3 py-3 text-center w-8">#</th>
                  <th className="px-3 py-3 text-left">Descripción<Oblig /></th>
                  <th className="px-3 py-3 text-left w-24">Cant.<Oblig /></th>
                  <th className="px-3 py-3 text-left w-40">Unidad</th>
                  <th className="px-3 py-3 text-left w-32">Cód. producto</th>
                  <th className="px-3 py-3 text-left w-32">Cód. subpartida</th>
                  {MOTIVOS_COMERCIO_EXTERIOR.includes(motivoTraslado) && (
                    <>
                      <th className="px-3 py-3 text-left w-24">GTIN (GS1)</th>
                      <th className="px-3 py-3 text-left w-32">Cód. UNSPSC</th>
                      <th className="px-3 py-3 text-center w-24">Bien regulado</th>
                    </>
                  )}
                  {!ro && <th className="px-3 py-3 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
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
                        disabled={ro} className="w-full input-field w-auto">
                        {UNIDADES_MEDIDA.map((u) => (
                          <option key={u.valor} value={u.valor}>{u.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input value={item.codigoProducto}
                        onChange={(e) => handleItem(item._key, "codigoProducto", e.target.value)}
                        disabled={ro}
                        className="w-full input-field w-auto" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={item.codigoSubpartida}
                        onChange={(e) => handleItem(item._key, "codigoSubpartida", e.target.value)}
                        disabled={ro}
                        className="w-full input-field w-auto" />
                    </td>
                    {MOTIVOS_COMERCIO_EXTERIOR.includes(motivoTraslado) && (
                      <>
                        <td className="px-3 py-2">
                          <input value={item.codigoProductoGS1} placeholder="GTIN-13"
                            onChange={(e) => handleItem(item._key, "codigoProductoGS1", e.target.value)}
                            disabled={ro}
                            className="w-full input-field w-auto" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={item.codigoProductoSunat}
                            onChange={(e) => handleItem(item._key, "codigoProductoSunat", e.target.value)}
                            disabled={ro}
                            className="w-full input-field w-auto" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={item.esBienNormalizado} disabled={ro}
                            onChange={(e) => handleItem(item._key, "esBienNormalizado", e.target.checked)} />
                        </td>
                      </>
                    )}
                    {!ro && (
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => eliminarItem(item._key)} className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
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

        {/* Datos adicionales del traslado */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Datos adicionales del traslado
          </p>
          <div className="flex flex-wrap gap-6 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <input type="checkbox" checked={realizaTransbordo} disabled={ro}
                onChange={(e) => setRealizaTransbordo(e.target.checked)} />
              Transbordo programado
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <input type="checkbox" checked={retornoEnvasesVacios} disabled={ro}
                onChange={(e) => setRetornoEnvasesVacios(e.target.checked)} />
              Retorno de vehículo con envases o embalajes vacíos
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <input type="checkbox" checked={retornoVehiculoVacio} disabled={ro}
                onChange={(e) => setRetornoVehiculoVacio(e.target.checked)} />
              Retorno de vehículo vacío
            </label>
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones (opcional)</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
            disabled={ro} rows={2} placeholder="Observaciones por el traslado..."
            className="w-full input-field disabled:bg-gray-50 disabled:text-gray-500" />
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
              {cargando ? "Emitiendo..." : "Emitir guía"}
            </button>
          ) : (
            <button type="button" onClick={nuevo}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition">
              Nueva guía
            </button>
          )}
        </div>
      </form>

      {confirmando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-2">¿Emitir guía de remisión?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Se enviará a SUNAT a través del hub. Esta acción genera un correlativo nuevo aunque la guía sea rechazada.
            </p>
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
    </div>
  );
}
