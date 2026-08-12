import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TIPO_DOC_LABEL = {
  "01": "FACTURA ELECTRÓNICA",
  "03": "BOLETA DE VENTA ELECTRÓNICA",
  "07": "NOTA DE CRÉDITO ELECTRÓNICA",
  "08": "NOTA DE DÉBITO ELECTRÓNICA",
};

const simboloMoneda = (moneda) => (moneda === "USD" ? "US$" : "S/");

// PDF preliminar generado por el ERP (no es la representación impresa oficial del PSE).
// logoUrl es opcional: si no se pasa o falla al cargar, el PDF se genera igual sin logo.
export function generarComprobantePdf(comprobante, { logoUrl } = {}) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 18;

  if (logoUrl) {
    try {
      doc.addImage(logoUrl, "PNG", margin, 10, 40, 16);
      y = 32;
    } catch {
      // Logo no disponible o formato no soportado: se continúa sin logo.
    }
  }

  const moneda  = comprobante.totales?.moneda || "PEN";
  const simbolo = simboloMoneda(moneda);
  const tipoLabel = TIPO_DOC_LABEL[comprobante.tipoDoc] || "COMPROBANTE ELECTRÓNICO";
  const serieCorrelativo = `${comprobante.serie}-${String(comprobante.correlativo).padStart(4, "0")}`;

  // doc.setFontSize(9);
  // doc.setFont("helvetica", "normal");
  // doc.text("PRELIMINAR — no es representación impresa oficial", margin, y);

  y += 8;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(comprobante.emisor?.nombre || "", margin, y);

  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`RUC ${comprobante.emisor?.numDoc || ""}`, margin, y);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(tipoLabel, margin + 100, y - 6);
  doc.text(serieCorrelativo, margin + 100, y);

  y += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de emisión:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    comprobante.fechaEmision ? new Date(comprobante.fechaEmision).toLocaleDateString("es-PE") : "-",
    margin + doc.getTextWidth("Fecha de emisión:__"), y
  );
  doc.setFont("helvetica", "bold");
  doc.text("Moneda:", margin + 100, y);
  doc.setFont("helvetica", "normal");
  doc.text(moneda, margin + 100 + doc.getTextWidth("Moneda:__"), y);

  if (!["07", "08"].includes(comprobante.tipoDoc)) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Forma de pago:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      comprobante.formaPago === "Credito" ? "Crédito" : "Contado",
      margin + doc.getTextWidth("Forma de pago:__"), y
    );
    if (comprobante.formaPago === "Credito" && comprobante.fechaVencimiento) {
      doc.setFont("helvetica", "bold");
      doc.text("Vence:", margin + 100, y);
      doc.setFont("helvetica", "normal");
      doc.text(new Date(comprobante.fechaVencimiento).toLocaleDateString("es-PE"), margin + 100 + doc.getTextWidth("Vence:__"), y);
    }
  }

  if (comprobante.numeroOrdenCompra) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("N° Orden de Compra:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(comprobante.numeroOrdenCompra, margin + doc.getTextWidth("N° Orden de Compra:__"), y);
  }

  if (["07", "08"].includes(comprobante.tipoDoc) && comprobante.referencia) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Documento afectado:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(comprobante.referencia.docId || "-", margin + doc.getTextWidth("Documento afectado:__"), y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Motivo:", margin, y);
    doc.setFont("helvetica", "normal");
    const motivoLines = doc.splitTextToSize(
      `${comprobante.referencia.motivoCodigo || ""} — ${comprobante.referencia.motivoDesc || ""}`,
      180 - doc.getTextWidth("Motivo:__")
    );
    doc.text(motivoLines, margin + doc.getTextWidth("Motivo:__"), y);
    y += motivoLines.length * 5;
  }

  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(comprobante.receptor?.nombre || "", margin + doc.getTextWidth("Cliente:__"), y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Documento:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(comprobante.receptor?.numDoc || "", margin + doc.getTextWidth("Documento:__"), y);

  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Cant.", "Unidad", "Descripción", `P. Unit. (${simbolo})`, `Total (${simbolo})`]],
    body: (comprobante.items || []).map((it) => [
      it.cantidad,
      it.unidad,
      it.descripcion,
      Number(it.precioUnitario || 0).toFixed(2),
      Number(it.total || 0).toFixed(2),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 30, 30], fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
    },
  });

  y = doc.lastAutoTable.finalY + 8;
  const totales = comprobante.totales || {};
  const filaTotal = (label, valor, negrita = false) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.text(label, 140, y);
    doc.text(`${simbolo} ${Number(valor || 0).toFixed(2)}`, 196, y, { align: "right" });
    y += 5;
  };
  if (totales.totalDescuentos) filaTotal("Descuentos:", totales.totalDescuentos);
  filaTotal("Base imponible:", totales.baseImponible);
  filaTotal("IGV:", totales.totalIGV);
  if (totales.otrosCargos) filaTotal("Otros cargos:", totales.otrosCargos);
  if (totales.montoRedondeo) filaTotal("Redondeo:", totales.montoRedondeo);
  y += 1;
  filaTotal("Total a pagar:", totales.totalPagar, true);

  if (comprobante.detraccion?.aplica) {
    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Operación sujeta a detracción", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`Código: ${comprobante.detraccion.codigoBien || "-"}  ·  Porcentaje: ${comprobante.detraccion.porcentaje ?? "-"}%`, margin, y);
    y += 5;
    doc.text(`Monto neto a depositar: ${simbolo} ${Number(comprobante.detraccion.montoNeto || 0).toFixed(2)}`, margin, y);
    y += 5;
    doc.text(`Cuenta Banco de la Nación: ${comprobante.detraccion.cuentaBancaria || "-"}`, margin, y);
  }

  if (comprobante.observaciones || comprobante.informacionRelacionada) {
    y += 8;
    doc.setFontSize(9);
    if (comprobante.observaciones) {
      doc.setFont("helvetica", "bold");
      doc.text("Observaciones:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(comprobante.observaciones, 180);
      doc.text(lines, margin, y);
      y += lines.length * 5;
    }
    if (comprobante.informacionRelacionada) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Información relacionada:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(comprobante.informacionRelacionada, 180);
      doc.text(lines, margin, y);
      y += lines.length * 5;
    }
  }

  doc.save(`${comprobante.nombreArchivo || serieCorrelativo}.pdf`);
}
