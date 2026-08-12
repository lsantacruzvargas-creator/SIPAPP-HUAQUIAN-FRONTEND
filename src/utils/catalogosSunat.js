// Espejo en frontend de Backend/src/utils/catalogos.js — solo lo necesario para selects.
// Afectación: SOLO los 4 códigos base. Los subcódigos extendidos (11-17, 21, 31-36) están
// documentados en la Guía SUNAT pero confirmados RECHAZADOS por SUNAT en demo (error 2040) —
// ver Backend/src/utils/catalogos.js y el skill sunat-cpe-ubl21.
export const AFECTACION_IGV = [
  { valor: "10", label: "10 — Gravado — Operación Onerosa (18% IGV)" },
  { valor: "20", label: "20 — Exonerado" },
  { valor: "30", label: "30 — Inafecto" },
  { valor: "40", label: "40 — Exportación" },
];

// Catálogo 03 — Unidades de medida más usadas en el giro de negocio. GLL/YRD/YDK/QQM agregadas 2026-07-13
// (visibles en el modal "Editar Bien" del Facturador SUNAT oficial, usadas en Guía de Remisión).
export const UNIDADES_MEDIDA = [
  { valor: "NIU", label: "NIU — Unidad" },
  { valor: "ZZ",  label: "ZZ — Servicio" },
  { valor: "KGM", label: "KGM — Kilogramo" },
  { valor: "MTR", label: "MTR — Metro" },
  { valor: "SET", label: "SET — Juego/Set" },
  { valor: "HUR", label: "HUR — Hora" },
  { valor: "GLL", label: "GLL — Galón (US)" },
  { valor: "YRD", label: "YRD — Yarda" },
  { valor: "YDK", label: "YDK — Yarda cuadrada" },
  { valor: "QQM", label: "QQM — Quintal" },
];

// NO es un catálogo SUNAT — es solo un selector de conveniencia en el formulario para que el
// usuario no se equivoque de unidad: un ítem "Servicio" solo puede usar ZZ (Catálogo 03); un
// ítem "Bien" usa cualquier unidad física. Lo único que SUNAT valida en el XML es el unitCode.
export const TIPO_ITEM = [
  { valor: "bien",     label: "Bien" },
  { valor: "servicio", label: "Servicio" },
];

export function unidadesPorTipoItem(tipo) {
  return tipo === "servicio"
    ? UNIDADES_MEDIDA.filter((u) => u.valor === "ZZ")
    : UNIDADES_MEDIDA.filter((u) => u.valor !== "ZZ");
}

export const TIPO_DOC_RECEPTOR = [
  { valor: "6", label: "6 — RUC" },
  { valor: "1", label: "1 — DNI" },
  { valor: "4", label: "4 — Carné de Extranjería" },
  { valor: "7", label: "7 — Pasaporte" },
  { valor: "0", label: "0 — Sin documento (varios)" },
];

export const ESTADO_COMPROBANTE = [
  { valor: "PENDIENTE", label: "Pendiente", cls: "bg-gray-100 text-gray-500" },
  { valor: "ACEPTADO",  label: "Aceptado",  cls: "bg-green-100 text-green-700" },
  { valor: "RECHAZADO", label: "Rechazado", cls: "bg-red-100 text-red-700" },
  { valor: "ANULADO",   label: "Anulado",   cls: "bg-amber-100 text-amber-700" },
  { valor: "ERROR",     label: "Error",     cls: "bg-rose-100 text-rose-700" },
];

export function estadoComprobanteClase(v) {
  return ESTADO_COMPROBANTE.find((e) => e.valor === v)?.cls ?? "bg-gray-100 text-gray-500";
}

export const TIPO_DOC_CPE = [
  { valor: "01", label: "01 — Factura" },
  { valor: "03", label: "03 — Boleta" },
  { valor: "07", label: "07 — Nota de Crédito" },
  { valor: "08", label: "08 — Nota de Débito" },
];

// Catálogo 09 — Tipo de nota de crédito.
export const MOTIVO_NC = [
  { valor: "01", label: "01 — Anulación de la operación" },
  { valor: "02", label: "02 — Anulación por error en el RUC" },
  { valor: "03", label: "03 — Corrección por error en la descripción" },
  { valor: "04", label: "04 — Descuento global" },
  { valor: "05", label: "05 — Descuento por ítem" },
  { valor: "06", label: "06 — Devolución total" },
  { valor: "07", label: "07 — Devolución por ítem" },
  { valor: "08", label: "08 — Bonificación" },
  { valor: "09", label: "09 — Disminución en el valor" },
  { valor: "10", label: "10 — Otros conceptos" },
  { valor: "11", label: "11 — Ajustes de operaciones de exportación" },
  { valor: "12", label: "12 — Ajustes afectos al IVAP" },
];

// Catálogo 10 — Tipo de nota de débito.
export const MOTIVO_ND = [
  { valor: "01", label: "01 — Intereses por mora" },
  { valor: "02", label: "02 — Aumento en el valor" },
  { valor: "03", label: "03 — Penalidades/otros conceptos" },
  { valor: "11", label: "11 — Ajustes de operaciones de exportación" },
  { valor: "12", label: "12 — Ajustes afectos al IVAP" },
];

export function itemVacioComprobante() {
  return {
    _key: Date.now() + Math.random(),
    descripcion: "",
    cantidad: 1,
    unidad: "NIU",
    valorUnitario: "",
    precioUnitario: "",
    afectacion: "10",
    descuentoPorcentaje: 0,
  };
}

// valorUnitario (sin IGV, el precio que siempre se cotiza/ofrece) → precioUnitario
// (con IGV), solo para afectación gravada (18%). Exonerado/Inafecto/Exportación:
// precioUnitario = valorUnitario (no hay IGV que sumar).
export function precioUnitarioDesdeValor(valorUnitario, afectacion) {
  const valor = Number(valorUnitario) || 0;
  if (afectacion !== "10") return valor;
  return Math.round(valor * 1.18 * 100) / 100;
}

export const TIPO_GUIA = [
  { valor: "REMITENTE",     label: "Remitente" },
  { valor: "TRANSPORTISTA", label: "Transportista" },
];

export const MODALIDAD_TRASLADO = [
  { valor: "01", label: "01 — Transporte público" },
  { valor: "02", label: "02 — Transporte privado" },
];

// Catálogo 20 — Motivo de traslado. Completo y confirmado contra el Anexo N°8 vigente de SUNAT
// (Resolución N° 000240-2024/SUNAT, verificado 2026-07-13) — 14 códigos. El código 19 se etiquetaba
// "Traslado a zona primaria" (versión 2017); el Anexo N°8 vigente lo redefine como "Traslado de
// mercancía extranjera".
export const MOTIVO_TRASLADO = [
  { valor: "01", label: "01 — Venta" },
  { valor: "02", label: "02 — Compra" },
  { valor: "03", label: "03 — Venta con entrega a terceros" },
  { valor: "04", label: "04 — Traslado entre establecimientos" },
  { valor: "05", label: "05 — Consignación" },
  { valor: "06", label: "06 — Devolución" },
  { valor: "07", label: "07 — Recojo de bienes transformados" },
  { valor: "08", label: "08 — Importación" },
  { valor: "09", label: "09 — Exportación" },
  { valor: "13", label: "13 — Otros" },
  { valor: "14", label: "14 — Venta sujeta a confirmación del comprador" },
  { valor: "17", label: "17 — Traslado de bienes para transformación" },
  { valor: "18", label: "18 — Traslado emisor itinerante" },
  { valor: "19", label: "19 — Traslado de mercancía extranjera" },
];

// Catálogo 61 — Documentos relacionados aplicables a las GRE (versión 2.0). Confirmado contra el
// mismo Anexo N°8 vigente y contra una GRE real firmada por SUNAT (2026-07-13).
export const DOCUMENTO_RELACIONADO_GRE = [
  { valor: "01", label: "01 — Factura" },
  { valor: "03", label: "03 — Boleta de Venta" },
  { valor: "04", label: "04 — Liquidación de Compra" },
  { valor: "09", label: "09 — Guía de Remisión Remitente" },
  { valor: "12", label: "12 — Ticket o cinta de máquina registradora" },
  { valor: "31", label: "31 — Guía de Remisión Transportista" },
  { valor: "48", label: "48 — Comprobante de Operaciones - Ley N° 29972" },
  { valor: "49", label: "49 — Constancia de Depósito - IVAP" },
  { valor: "50", label: "50 — Declaración Aduanera de Mercancías (DAM)" },
  { valor: "52", label: "52 — Declaración Simplificada (DS)" },
  { valor: "80", label: "80 — Constancia de Depósito - Detracción" },
  { valor: "81", label: "81 — Código de autorización emitida por el SCOP" },
  { valor: "82", label: "82 — Declaración jurada de mudanza" },
  { valor: "91", label: "91 — Manifiesto de Carga (MC)" },
];

export const UNIDAD_PESO = [
  { valor: "KGM", label: "KGM — Kilogramo" },
  { valor: "TNE", label: "TNE — Tonelada" },
];

export function itemVacioGuia() {
  return {
    _key: Date.now() + Math.random(),
    descripcion: "",
    cantidad: 1,
    unidad: "NIU",
    codigoProducto: "",
    codigoSubpartida: "",
    esBienNormalizado: false,
    tipoCodigoProductoGS1: "",
    codigoProductoGS1: "",
    codigoProductoSunat: "",
  };
}

// Validación de formato de documento de identidad según schemeID (catálogo 06):
// 6=RUC exige 11 dígitos, 1=DNI exige 8 dígitos (rechazo SUNAT si no cumplen);
// 4=Carné Ext./7=Pasaporte/0=Sin documento no tienen formato fijo, solo no vacío.
export function documentoValido(schemeID, numDoc) {
  const v = (numDoc || "").trim();
  if (schemeID === "6") return /^\d{11}$/.test(v);
  if (schemeID === "1") return /^\d{8}$/.test(v);
  return v.length > 0;
}

// Serie SUNAT: exactamente 4 caracteres alfanuméricos (ej. F001, B001, FC01, T001).
export function serieValida(serie) {
  return /^[A-Z0-9]{4}$/.test((serie || "").trim());
}

// Ubigeo INEI: exactamente 6 dígitos (2 departamento + 2 provincia + 2 distrito).
export function ubigeoValido(ubigeo) {
  return /^\d{6}$/.test((ubigeo || "").trim());
}

export const TIPO_MONEDA = [
  { valor: "PEN", label: "PEN — Soles" },
  { valor: "USD", label: "USD — Dólares" },
];

// Catálogo 54 — Bienes y servicios sujetos a detracción (espejo de Backend/src/utils/catalogos.js).
// Porcentajes confirmados contra los Anexos I-IV de la R.S. N° 183-2004/SUNAT y sus modificatorias
// (RS 246-2017, RS 082-2018, RS 152-2018, RS 071-2018, RS 130-2019), leídos completos 2026-07-12.
// 027 y 040 quedan sin verificar (se rigen por resoluciones aparte, no incluidas en esos Anexos).
export const DETRACCION_BIENES_SERVICIOS = [
  { codigo: "001", descripcion: "Azúcar y melaza de caña", porcentaje: 10 },
  { codigo: "002", descripcion: "Arroz", porcentaje: null },
  { codigo: "003", descripcion: "Alcohol etílico", porcentaje: 10 },
  { codigo: "004", descripcion: "Recursos hidrobiológicos", porcentaje: 4 },
  { codigo: "005", descripcion: "Maíz amarillo duro", porcentaje: 4 },
  { codigo: "006", descripcion: "Algodón", porcentaje: null },
  { codigo: "007", descripcion: "Caña de azúcar", porcentaje: 10 },
  { codigo: "008", descripcion: "Madera", porcentaje: 4 },
  { codigo: "009", descripcion: "Arena y piedra", porcentaje: 10 },
  { codigo: "010", descripcion: "Residuos, subproductos, desechos", porcentaje: 15 },
  { codigo: "011", descripcion: "Bienes gravados con IGV por renuncia a la exoneración", porcentaje: 10 },
  { codigo: "012", descripcion: "Intermediación laboral y tercerización", porcentaje: 12 },
  { codigo: "013", descripcion: "Animales vivos", porcentaje: null },
  { codigo: "014", descripcion: "Carnes y despojos comestibles", porcentaje: 4 },
  { codigo: "015", descripcion: "Abonos, cueros y pieles", porcentaje: null },
  { codigo: "016", descripcion: "Aceite de pescado", porcentaje: 10 },
  { codigo: "017", descripcion: "Harina, polvo y pellets de pescado", porcentaje: 4 },
  { codigo: "018", descripcion: "Embarcaciones pesqueras", porcentaje: null },
  { codigo: "019", descripcion: "Arrendamiento de bienes muebles", porcentaje: 10 },
  { codigo: "020", descripcion: "Mantenimiento y reparación de bienes muebles", porcentaje: 12 },
  { codigo: "021", descripcion: "Movimiento de carga", porcentaje: 10 },
  { codigo: "022", descripcion: "Otros servicios empresariales", porcentaje: 12 },
  { codigo: "023", descripcion: "Leche", porcentaje: 4 },
  { codigo: "024", descripcion: "Comisión mercantil", porcentaje: 10 },
  { codigo: "025", descripcion: "Fabricación de bienes por encargo", porcentaje: 10 },
  { codigo: "026", descripcion: "Servicio de transporte de personas", porcentaje: 10 },
  { codigo: "027", descripcion: "Servicio de transporte de carga", porcentaje: 4 },
  { codigo: "028", descripcion: "Transporte de pasajeros", porcentaje: null },
  { codigo: "029", descripcion: "Algodón en rama sin desmontar", porcentaje: null },
  { codigo: "030", descripcion: "Contratos de construcción", porcentaje: 4 },
  { codigo: "031", descripcion: "Oro gravado con IGV", porcentaje: 10 },
  { codigo: "032", descripcion: "Páprika y otros frutos de los géneros capsicum o pimienta", porcentaje: 10 },
  { codigo: "033", descripcion: "Espárragos", porcentaje: null },
  { codigo: "034", descripcion: "Minerales metálicos no auríferos", porcentaje: 10 },
  { codigo: "035", descripcion: "Bienes exonerados del IGV", porcentaje: 1.5 },
  { codigo: "036", descripcion: "Oro y demás minerales metálicos exonerados del IGV", porcentaje: 1.5 },
  { codigo: "037", descripcion: "Demás servicios gravados con IGV", porcentaje: 12 },
  { codigo: "039", descripcion: "Minerales no metálicos", porcentaje: 10 },
  { codigo: "040", descripcion: "Bien inmueble gravado con IGV", porcentaje: 4 },
  { codigo: "041", descripcion: "Plomo", porcentaje: 15 },
];

export function calcularLineaComprobante(item) {
  const cantidad  = Number(item.cantidad) || 0;
  const valorUnit = Number(item.valorUnitario) || 0;
  const baseAntesDescuento = cantidad * valorUnit;
  const descuentoPct   = Number(item.descuentoPorcentaje) || 0;
  const montoDescuento = descuentoPct > 0 ? baseAntesDescuento * descuentoPct : 0;
  const base = baseAntesDescuento - montoDescuento;
  const igv  = item.afectacion === "10" ? base * 0.18 : 0;
  return {
    baseAntesDescuento: Math.round(baseAntesDescuento * 100) / 100,
    montoDescuento:     Math.round(montoDescuento * 100) / 100,
    base:               Math.round(base * 100) / 100,
    igv:                Math.round(igv * 100) / 100,
    total:              Math.round((base + igv) * 100) / 100,
  };
}
