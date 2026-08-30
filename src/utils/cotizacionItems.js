export const UNIDADES = ["und", "kg", "g", "L", "mL", "m", "cm", "m²", "caja", "rollo", "par", "juego", "bolsa"];

export const calcSubtotal = (item) =>
  parseFloat((item.cantidad * item.precio).toFixed(2));

export const INP =
  "border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400";
export const INP_RO = "bg-transparent border-transparent text-sm px-2 py-1";

export const itemVacioVenta = () => ({
  _key: Date.now() + Math.random(),
  descripcion: "",
  unidad: "und",
  cantidad: 1,
  fechaEntrega: "",
  precio: 0,
  moneda: "PEN",
});

export const itemVacioServicio = () => ({
  _key: Date.now() + Math.random(),
  descripcion: "",
  subItems: [],
  unidad: "und",
  cantidad: 1,
  fechaEntrega: "",
  precio: 0,
  moneda: "PEN",
});

export const itemDesdeDb = (item) => ({
  _key: Date.now() + Math.random(),
  descripcion: item.descripcion,
  subItems: (item.subItems || []).map((texto) => ({
    _subKey: Date.now() + Math.random(),
    texto,
  })),
  unidad: item.unidad || "und",
  cantidad: item.cantidad,
  fechaEntrega: item.fechaEntrega
    ? new Date(item.fechaEntrega).toISOString().split("T")[0]
    : "",
  precio: item.precio,
  moneda: item.moneda || "PEN",
  otGenerada: item.otGenerada || null,
  // Formato Gloria (ver GRUPOS_GLORIA abajo) — un ítem del flujo genérico no
  // trae `grupo`, así que estos quedan undefined y no afectan nada.
  grupo: item.grupo,
  personas: item.personas,
  horas: item.horas,
  tarifaHora: item.tarifaHora,
});

// Validación de ítems requeridos por el modelo (Backend/src/models/Cotizacion.js:
// descripcion, cantidad y precio son obligatorios) — se resalta en el form
// antes de enviar, en vez de dejar que el guardado falle en el servidor.
export const descripcionInvalida = (item) => !item.descripcion?.trim();
export const cantidadInvalida = (item) => !(Number(item.cantidad) > 0);
export const precioInvalido = (item) =>
  item.precio === "" || item.precio == null || isNaN(Number(item.precio)) || Number(item.precio) < 0;
export const itemInvalido = (item) =>
  descripcionInvalida(item) || cantidadInvalida(item) || precioInvalido(item);

// ── Formato exclusivo de Gloria (RUC 20100190797) ───────────────────────────
// Constante centralizada acá (no repetida en cada componente que la usa —
// DetalleCotizacion.jsx y ModalNuevaCotizacion.jsx) para que un RUC
// incorrecto se corrija en un solo lugar. Ítems agrupados en 5 categorías
// fijas — ver `esGloria` en ambos componentes y TablaItemsCotizacionGloria.jsx.
// Mano de obra no usa cantidad/precio: se cobra personas × horas × tarifa
// por hora, no cantidad × precio unitario.
export const RUC_GLORIA = "20100190797";
export const GRUPOS_GLORIA = [
  { clave: "detalle_servicio",   numero: 1, label: "Detalle del Servicio",   columnas: "cantidad_precio" },
  { clave: "materiales",          numero: 2, label: "Materiales",             columnas: "cantidad_precio" },
  { clave: "mano_obra",           numero: 3, label: "Mano de Obra",           columnas: "mano_obra" },
  { clave: "maquinaria_equipos",  numero: 4, label: "Maquinaria y Equipos",   columnas: "cantidad_precio" },
  { clave: "seguridad_salud",     numero: 5, label: "Seguridad y Salud",      columnas: "cantidad_precio" },
];

export const itemVacioGloria = (grupo) => {
  const base = { _key: Date.now() + Math.random(), grupo, descripcion: "" };
  const def = GRUPOS_GLORIA.find((g) => g.clave === grupo);
  if (def?.columnas === "mano_obra") {
    return { ...base, personas: 1, horas: 1, tarifaHora: 0 };
  }
  return { ...base, unidad: "und", cantidad: 1, precio: 0 };
};

export const calcSubtotalGloria = (item) =>
  item.grupo === "mano_obra"
    ? parseFloat((Number(item.personas || 0) * Number(item.horas || 0) * Number(item.tarifaHora || 0)).toFixed(2))
    : calcSubtotal(item);

// Fórmula de totales de Gloria (confirmada por el usuario) — reemplaza el
// descuento global genérico (`descuentoPorcentaje`) cuando la cotización es
// de Gloria: SUB-TOTAL + GASTOS GENERALES + UTILIDAD, y recién sobre esa base
// se calcula el IGV. `total` acá es "VALOR TOTAL DE LA OFERTA" — se guarda en
// el mismo campo `cotizacion.total` que usa el resto de la app.
export function calcularGloria(subtotalItems, gastosPct = 2, utilidadPct = 10) {
  const subtotal = Math.round(Number(subtotalItems) * 100) / 100 || 0;
  const gastosGenerales = Math.round(subtotal * (Number(gastosPct) || 0) / 100 * 100) / 100;
  const utilidad = Math.round(subtotal * (Number(utilidadPct) || 0) / 100 * 100) / 100;
  const totalPreIgv = Math.round((subtotal + gastosGenerales + utilidad) * 100) / 100;
  const igv = Math.round(totalPreIgv * 0.18 * 100) / 100;
  return {
    subtotal,
    gastosGeneralesPorcentaje: Number(gastosPct) || 0,
    utilidadPorcentaje: Number(utilidadPct) || 0,
    gastosGenerales,
    utilidad,
    totalPreIgv,
    igv,
    total: Math.round((totalPreIgv + igv) * 100) / 100,
  };
}
