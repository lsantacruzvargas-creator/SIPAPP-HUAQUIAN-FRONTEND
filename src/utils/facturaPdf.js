import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFecha } from "./fecha";
import { numeroALetras } from "./numeroALetras";
import { HUAQUIAN, cargarImagen } from "./cotizacionPdf";
import { DETRACCION_BIENES_SERVICIOS, normalizarCuentaDetraccion } from "./catalogosSunat";

// Formato tomado del libro FACTURA de "ERP NUEVO FORMATO DE FACTURA Y
// COTIZACION.xlsx" (raíz del proyecto). Membrete, marca de agua, cuentas
// bancarias y tira de marcas son fijos de Huaquian, igual que en cotizacionPdf.js.
const AZUL = [217, 226, 243]; // encabezados de tabla
const GRIS = [242, 242, 242]; // celdas de etiqueta
const M = 14;

const CUENTAS = [
  ["CTA CTE BCP SOLES", "191-2364174-0-44", "00219100236417404456"],
  ["CTA CTE BCP DOLARES", "191-2559651-1-69", "002-191002255965116958"],
  ["CTA BBVA SOLES", "001101890100067659"],
];

const MONEDA = { PEN: "SOLES", USD: "DÓLARES" };
// La plantilla muestra "UND" también para servicios (unidad SUNAT "ZZ").
const UNIDAD = { NIU: "UND", ZZ: "UND" };

const n2 = (v) => (Number(v) || 0).toFixed(2);
const miles = (v) => (Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// `comprobante` es el CPE emitido (lo que se llenó en Emitir Comprobante);
// si la factura no tiene uno enlazado (importadas de Excel), se arma con lo
// que guarda la propia Factura. `empresa` sale de la BD (heredada de la OC),
// nunca de una consulta a SUNAT.
export async function generarFacturaPdf({ factura, comprobante, empresa }) {
  const doc = new jsPDF();
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const R = PAGE_W - M;
  const CONTENT_W = PAGE_W - M * 2;

  const [membrete, marcaAgua, marcas] = await Promise.all([
    cargarImagen("/assets/logos/factura_header.png"),
    cargarImagen("/assets/logos/factura_marca_agua.png"),
    cargarImagen("/assets/logos/factura_marcas.png"),
  ]);

  const c = comprobante;
  const moneda = c?.totales?.moneda || "PEN";
  const simbolo = moneda === "USD" ? "US$" : "S/";
  const numero = c ? `${c.serie}-${c.correlativo}` : (factura.numeroFactura || "");

  const items = c?.items?.length
    ? c.items
    : [{ cantidad: 1, unidad: "ZZ", descripcion: factura.descripcion, valorUnitario: factura.subtotal, afectacion: "10" }];
  const lineas = items.map((it) => {
    const bruto = (Number(it.cantidad) || 0) * (Number(it.valorUnitario) || 0);
    return { ...it, bruto, descuento: bruto * (Number(it.descuentoPorcentaje) || 0) };
  });
  const sumaBruto = (afectacion) =>
    lineas.filter((l) => (l.afectacion || "10") === afectacion).reduce((s, l) => s + l.bruto, 0);
  const subTotal = c ? c.totales.baseImponible : factura.subtotal;
  const igv = c ? c.totales.totalIGV : factura.igv;
  const total = Number(c ? c.totales.totalPagar : factura.total) || 0;
  const descuento = c?.totales?.totalDescuentos ?? lineas.reduce((s, l) => s + l.descuento, 0);

  const det = c
    ? (c.detraccion?.aplica ? c.detraccion : null)
    : (factura.detraccion > 0 ? { montoNeto: factura.detraccion, porcentaje: 12 } : null);
  const bienDet = det?.codigoBien && DETRACCION_BIENES_SERVICIOS.find((b) => b.codigo === det.codigoBien);
  const montoDet = det ? Math.round(Number(det.montoNeto) || 0) : 0;
  const ret = c
    ? (c.retencion?.aplica ? c.retencion : null)
    : (factura.retencion > 0 ? { monto: factura.retencion, porcentaje: factura.retencionPorcentaje } : null);
  const montoRet = ret ? Number(ret.monto) || 0 : 0;
  const cuotas = c ? (c.cuotas || []) : (factura.cuotas || []);

  const formaPago = c
    ? (c.formaPago === "Credito" ? "Crédito" : "Contado")
    : (cuotas.length ? "Crédito" : "");
  const guia = c?.guiaRelacionada?.serie
    ? `${c.guiaRelacionada.serie}-${String(c.guiaRelacionada.correlativo).padStart(8, "0")}`
    : (factura.numeroGuiaRemision || "");
  const fechaEmision = c?.fechaEmision || factura.fechaEmision;
  // La dirección solo se imprime si la empresa de la BD es la misma a la que
  // se le emitió el comprobante.
  const mismaEmpresa = !c || !empresa?.ruc || empresa.ruc === c.receptor?.numDoc;

  // Va primero en cada página para quedar detrás del resto.
  const dibujarMarcaDeAgua = () => {
    if (!marcaAgua) return;
    const w = 125;
    const h = w * (marcaAgua.naturalHeight / marcaAgua.naturalWidth);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.1 }));
    doc.addImage(marcaAgua, "PNG", (PAGE_W - w) / 2, 92, w, h, "marcaAgua");
    doc.restoreGraphicsState();
  };
  dibujarMarcaDeAgua();

  // ─── Membrete + placa RUC / FACTURA ELECTRÓNICA / número ───
  let y = 12;
  const membreteW = 120;
  const membreteH = membrete ? membreteW * (membrete.naturalHeight / membrete.naturalWidth) : 24;
  if (membrete) doc.addImage(membrete, "PNG", M + 4, y, membreteW, membreteH);

  const placaW = 76, placaH = 23, placaX = R - placaW, placaY = y + 1;
  doc.setDrawColor(0);
  doc.setTextColor(0);
  doc.setLineWidth(0.25);
  doc.roundedRect(placaX, placaY, placaW, placaH, 4, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  [`RUC: ${HUAQUIAN.ruc}`, "FACTURA ELECTRÓNICA", numero].forEach((t, i) =>
    doc.text(t, placaX + placaW / 2, placaY + 7 + i * 6, { align: "center" }));
  y = Math.max(y + membreteH, placaY + placaH) + 3;

  // ─── Datos del comprobante — todos los campos se imprimen aunque estén vacíos ───
  const LH = 4.3;
  const xEtq = M + 3, xVal = M + 31, xEtqDer = M + 98, xValDer = M + 128;
  const filas = [
    [["Fecha de Emisión:", fechaEmision ? formatearFecha(fechaEmision) : ""], ["Forma de pago:", formaPago]],
    [["Señor(es):", c?.receptor?.nombre || empresa?.razonSocial], ["Orden de compra:", c?.numeroOrdenCompra || factura.numeroOrdenCompra]],
    [["RUC:", c?.receptor?.numDoc || empresa?.ruc], ["Conformidad:", factura.conformidad]],
    [["Moneda:", MONEDA[moneda] || moneda], ["Guía de remisión:", guia]],
    [["Dirección Fiscal:", mismaEmpresa ? empresa?.direccion : ""]],
    [["Observación:", c?.observaciones]],
  ];
  doc.setFontSize(8);
  const yCaja = y;
  let yFila = yCaja + 5.5;
  filas.forEach(([izq, der]) => {
    doc.setFont("helvetica", "normal");
    const lineasIzq = doc.splitTextToSize(String(izq[1] || ""), (der ? xEtqDer : R) - 3 - xVal);
    const lineasDer = der ? doc.splitTextToSize(String(der[1] || ""), R - 3 - xValDer) : [];
    doc.text(lineasIzq, xVal, yFila);
    if (der) doc.text(lineasDer, xValDer, yFila);
    doc.setFont("helvetica", "bold");
    doc.text(izq[0], xEtq, yFila);
    if (der) doc.text(der[0], xEtqDer, yFila);
    yFila += LH + (Math.max(lineasIzq.length, lineasDer.length) - 1) * 3.3;
  });
  const altoCaja = yFila - LH + 2.5 - yCaja;
  doc.roundedRect(M, yCaja, CONTENT_W, altoCaja, 4, 4);
  y = yCaja + altoCaja + 4;

  // ─── Ítems ───
  autoTable(doc, {
    startY: y,
    head: [[
      { content: "Cant", styles: { halign: "center" } },
      { content: "Unid.", styles: { halign: "center" } },
      "Descripción",
      { content: "Valor Unit", styles: { halign: "right" } },
      { content: "Total", styles: { halign: "right" } },
    ]],
    body: lineas.map((l) => [l.cantidad, UNIDAD[l.unidad] || l.unidad || "", l.descripcion, n2(l.valorUnitario), n2(l.bruto)]),
    theme: "grid",
    margin: { left: M, right: M, top: 14, bottom: 14 },
    // Sin relleno en el cuerpo para que la marca de agua se vea detrás, como en la plantilla.
    styles: { fontSize: 8, textColor: 0, lineColor: 0, lineWidth: 0.1, fillColor: false, halign: "left", valign: "middle", cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 1 } },
    headStyles: { fillColor: AZUL, fontStyle: "bold", cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 10, fontStyle: "bold", halign: "center" },
      1: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 18, fontStyle: "bold", halign: "right" },
      4: { cellWidth: 18, halign: "right" },
    },
    willDrawPage: (data) => { if (data.pageNumber > 1) dibujarMarcaDeAgua(); },
  });
  y = doc.lastAutoTable.finalY + 4;

  const asegurarEspacio = (alto) => {
    if (y + alto <= PAGE_H - 10) return;
    doc.addPage();
    dibujarMarcaDeAgua();
    y = 14;
  };
  const celda = (x, yy, w, h, texto, { fill, bold = false, align = "center" } = {}) => {
    if (fill) { doc.setFillColor(...fill); doc.rect(x, yy, w, h, "FD"); }
    else doc.rect(x, yy, w, h);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const tx = align === "left" ? x + 1.5 : align === "right" ? x + w - 1.5 : x + w / 2;
    doc.text(String(texto ?? ""), tx, yy + h / 2, { align, baseline: "middle" });
  };
  doc.setLineWidth(0.1);
  doc.setFontSize(8);
  const H = 4.4;

  // ─── SON: monto en letras + totales ───
  // O.P GRAVADAS/EXONERADA van antes de descuento (como en la plantilla);
  // SUB TOTAL es la base ya descontada de todos los ítems.
  const totW = 54, totEtqW = 32, totX = R - totW;
  const filasTotales = [
    ["O.P GRAVADAS", sumaBruto("10")],
    ["O.P GRATUITAS", 0],
    ["O.P EXONERADA", sumaBruto("20")],
    ["TOTAL DESCUENTO", descuento],
    ["SUB TOTAL", subTotal],
    ["IGV", igv],
    ["IMPORTE TOTAL", total],
  ];
  asegurarEspacio(filasTotales.length * H);
  const sonW = totX - 3 - M;
  doc.setFont("helvetica", "bold");
  const sonLineas = doc.splitTextToSize(`SON:  ${numeroALetras(total, moneda)}`, sonW - 3);
  const sonH = Math.max(H, sonLineas.length * 3.3 + 1.5);
  doc.rect(M, y, sonW, sonH);
  doc.text(sonLineas, M + 1.5, y + 3.3);
  filasTotales.forEach(([etq, valor], i) => {
    celda(totX, y + i * H, totEtqW, H, etq, { fill: GRIS });
    celda(totX + totEtqW, y + i * H, totW - totEtqW, H, n2(valor), { align: "right" });
  });
  y += Math.max(sonH, filasTotales.length * H) + 8;

  // ─── Detracción + información del crédito ───
  const tabW = 117, etqW = 45;
  asegurarEspacio((8 + (ret ? 1 : 0) + cuotas.length) * H);
  celda(M, y, tabW, H, "Operación sujeta al sistema de pago de obligaciones tributarias", { fill: AZUL, bold: true });
  const yDet = y + H;
  [
    ["Tipo de operación", det ? "01" : ""],
    ["Bien o Servicio", det?.codigoBien ? `${det.codigoBien} ${bienDet?.descripcion || ""}` : ""],
    [det?.porcentaje ? `Detracción (${det.porcentaje}%)` : "Detracción", det ? montoDet : ""],
    ["Cta. Cte. Banco de la Nación", normalizarCuentaDetraccion(det?.cuentaBancaria)],
  ].forEach(([etq, valor], i) => {
    celda(M, yDet + i * H, etqW, H, etq, { fill: GRIS, bold: true });
    celda(M + etqW, yDet + i * H, tabW - etqW, H, valor);
  });
  // Recuadro en blanco de la plantilla (AC45:AN51), a la derecha de ambas tablas.
  doc.rect(R - 44, yDet, 40, 7 * H);

  y = yDet + 5 * H;
  celda(M, y, tabW, H, "Información del crédito", { fill: AZUL, bold: true });
  const wC = [22, 32, 28, 35];
  const filaCredito = (yy, etq, monto, etq2, valor2) => {
    let x = M;
    celda(x, yy, wC[0], H, etq, { fill: GRIS, bold: true, align: "left" });
    x += wC[0];
    doc.rect(x, yy, wC[1], H);
    doc.setFont("helvetica", "normal");
    doc.text(simbolo, x + 1.5, yy + H / 2, { baseline: "middle" });
    doc.text(miles(monto), x + wC[1] - 1.5, yy + H / 2, { align: "right", baseline: "middle" });
    x += wC[1];
    celda(x, yy, wC[2], H, etq2, { fill: GRIS, bold: true });
    celda(x + wC[2], yy, wC[3], H, valor2, { bold: true });
  };
  // La fila de retención no está en la plantilla: solo aparece cuando el comprobante la lleva.
  if (ret) {
    y += H;
    filaCredito(y, "Retención IGV", montoRet, "Tasa", `${ret.porcentaje}%`);
  }
  filaCredito(y + H, "Neto a Pagar", total - montoDet - montoRet, "Total de cuotas", cuotas.length || "");
  cuotas.forEach((q, i) =>
    filaCredito(y + (i + 2) * H, `Cuota ${q.numero ?? i + 1}`, q.monto, "Fecha de vencim.", formatearFecha(q.fechaVencimiento)));
  y += (2 + cuotas.length) * H + 5;

  // ─── Pie: cuentas bancarias + marcas — anclado abajo como en la plantilla ───
  const marcasW = CONTENT_W + 6;
  const marcasH = marcas ? marcasW * (marcas.naturalHeight / marcas.naturalWidth) : 0;
  const Y_PIE = 226;
  if (y > Y_PIE && y + 20 + marcasH > PAGE_H - 8) { doc.addPage(); dibujarMarcaDeAgua(); y = Y_PIE; }
  y = Math.max(y, Y_PIE);
  doc.setLineWidth(0.3);
  doc.line(M - 4, y, R + 4, y);
  doc.line(M - 4, y + 0.9, R + 4, y + 0.9);
  y += 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  CUENTAS.forEach(([banco, cuenta, cci]) => {
    doc.text(banco, M + 6, y);
    doc.text(cuenta, M + 42, y);
    if (cci) {
      doc.text("CCI", M + 116, y);
      doc.text(cci, M + 125, y);
    }
    y += 3.6;
  });
  if (marcas) doc.addImage(marcas, "PNG", (PAGE_W - marcasW) / 2, y + 1.5, marcasW, marcasH);

  doc.save(`Factura ${numero}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
