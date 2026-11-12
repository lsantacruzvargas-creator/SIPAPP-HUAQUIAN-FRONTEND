import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { formatearFecha, formatearFechaHora } from "./fecha";
import { cargarImagen } from "./cotizacionPdf";
import { MODALIDAD_TRASLADO, MOTIVO_TRASLADO, UNIDAD_PESO } from "./catalogosSunat";

// Formato tomado de la hoja GUIA de "ERP NUEVO FORMATO DE GUIA.xlsx" (raíz del
// proyecto). Membrete, marca de agua y tira de marcas son las mismas imágenes
// de la factura (facturaPdf.js).
const AZUL = [217, 226, 243];
const M = 14;

// Sin el código del catálogo: "01 — Venta" → "Venta".
const sinCodigo = (lista, valor) => (lista.find((x) => x.valor === valor)?.label ?? valor ?? "").replace(/^\w+ — /, "");
const siNo = (v) => (v ? "SI" : "NO");
const TIPO_DOC = { 6: "RUC", 1: "DNI", 4: "CE", 7: "PASAPORTE" };
// Mismo criterio que facturaPdf.js: bienes y servicios se imprimen "UND".
const UNIDAD = { NIU: "UND", ZZ: "UND" };
const fechaHora = (f) => formatearFechaHora(f, {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
}).replace(",", "");

export const numeroGuia = (g) => `${g.serie}-${String(g.correlativo).padStart(8, "0")}`;

// El QR de la representación impresa lleva el link que SUNAT devuelve en el
// CDR al aceptar la guía (`sunat.linkSunat`, .../gre/comprobantes/descargaqr?hashqr=…):
// es único por guía y no se puede armar antes de la aceptación. Por eso el PDF
// solo existe para guías ACEPTADAS con ese link.
export const puedeGenerarPdfGuia = (g) => g?.estado === "ACEPTADO" && !!g?.sunat?.linkSunat;

export async function generarGuiaPdf(guia) {
  if (!puedeGenerarPdfGuia(guia)) throw new Error("La guía no está aceptada por SUNAT o no tiene el link del QR.");
  const g = guia;
  const doc = new jsPDF();
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const R = PAGE_W - M;
  const CONTENT_W = PAGE_W - M * 2;

  const [membrete, marcaAgua, marcas, qr] = await Promise.all([
    // El .png (con Danfoss/Siemens) es el membrete del formato de guía; el .jpeg de la factura solo trae el logo.
    cargarImagen("/assets/logos/factura_header.png"),
    cargarImagen("/assets/logos/factura_marca_agua.png"),
    cargarImagen("/assets/logos/factura_marcas.png"),
    QRCode.toDataURL(g.sunat.linkSunat, { margin: 0, errorCorrectionLevel: "M", width: 400 }),
  ]);

  const dibujarMarcaDeAgua = () => {
    if (!marcaAgua) return;
    const w = 125;
    const h = w * (marcaAgua.naturalHeight / marcaAgua.naturalWidth);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.1 }));
    doc.addImage(marcaAgua, "PNG", (PAGE_W - w) / 2, 92, w, h, "marcaAgua", "FAST");
    doc.restoreGraphicsState();
  };
  dibujarMarcaDeAgua();
  doc.setTextColor(0);
  doc.setDrawColor(0);

  // ─── Membrete + placa RUC / GUÍA DE REMISIÓN ELECTRÓNICA / REMITENTE / número ───
  let y = 12;
  const membreteW = 100;
  const membreteH = membrete ? membreteW * (membrete.naturalHeight / membrete.naturalWidth) : 24;
  if (membrete) doc.addImage(membrete, "PNG", M + 2, y, membreteW, membreteH, "membrete", "FAST");

  const placaW = 76, placaH = 28, placaX = R - placaW, placaY = y;
  doc.setLineWidth(0.25);
  doc.roundedRect(placaX, placaY, placaW, placaH, 4, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  [`RUC: ${g.emisor?.numDoc || g.rucEmisor}`, "GUÍA DE REMISIÓN ELECTRÓNICA", g.tipoGuia === "TRANSPORTISTA" ? "TRANSPORTISTA" : "REMITENTE", numeroGuia(g)]
    .forEach((t, i) => doc.text(t, placaX + placaW / 2, placaY + 7 + i * 6, { align: "center" }));
  y = Math.max(y + membreteH, placaY + placaH) + 4;

  // ─── Datos del traslado — dos columnas dentro de un recuadro redondeado ───
  const privado = g.modalidadTraslado === "02";
  const nombreConductor = (c) => (c ? `${c.nombres || ""} ${c.apellidos || ""}`.trim() + (c.numDoc ? ` — ${TIPO_DOC[c.tipoDoc] || "DOC"} ${c.numDoc}` : "") : "");
  const motivo = sinCodigo(MOTIVO_TRASLADO, g.motivoTraslado) + (g.motivoTraslado === "13" && g.descripcionMotivo ? `: ${g.descripcionMotivo}` : "");
  const direccion = (d) => (d?.direccion ? `${d.direccion}${d.ubigeo ? ` (Ubigeo ${d.ubigeo})` : ""}` : "");

  const izquierda = [
    ["Fecha de inicio del traslado:", g.fechaTraslado ? formatearFecha(g.fechaTraslado) : ""],
    ["Destinatario:", g.destinatario?.nombre],
    [`${TIPO_DOC[g.destinatario?.schemeID] || "RUC"}:`, g.destinatario?.numDoc],
    ["Observaciones:", g.observaciones],
  ];
  const derecha = [
    ["Fecha y hora de emisión:", g.createdAt ? fechaHora(g.createdAt) : (g.fechaEmision ? formatearFecha(g.fechaEmision) : "")],
    ["Punto de partida:", direccion(g.puntoPartida)],
    ["Punto de llegada:", direccion(g.puntoLlegada)],
    ["Motivo de traslado:", motivo],
  ];
  // Transporte privado: vehículos y conductores propios. Público: el transportista contratado.
  const transporteIzq = privado
    ? [["Datos de los vehículos:", null], ["Principal:", g.vehiculo?.placa], ...(g.vehiculosSecundarios || []).map((v, i) => [`Secundario ${i + 1}:`, v.placa])]
    : [["Datos del transportista:", null], ["Razón social:", g.transportista?.razonSocial], ["RUC:", g.transportista?.ruc]];
  const transporteDer = privado
    ? [["Datos de los conductores:", null], ["Principal:", nombreConductor(g.conductor)], ["Licencia de conducir:", g.conductor?.licencia]]
    : [[g.transportista?.registroMTC ? "Registro MTC:" : "", g.transportista?.registroMTC]];

  const xEtq = M + 3, xVal = M + 45, xEtqDer = M + 95, xValDer = M + 133;
  const anchoIzq = xEtqDer - 3 - xVal, anchoDer = R - 3 - xValDer;
  doc.setFontSize(8);
  const yCaja = y;
  let yFila = yCaja + 5.5;
  const pintarFilas = (izq, der) => {
    const n = Math.max(izq.length, der.length);
    for (let i = 0; i < n; i++) {
      const fila = [[izq[i], xEtq, xVal, anchoIzq], [der[i], xEtqDer, xValDer, anchoDer]];
      let lineas = 1;
      fila.forEach(([par, xe, xv, w]) => {
        if (!par) return;
        const [etq, val] = par;
        doc.setFont("helvetica", "bold");
        doc.text(etq, xe, yFila);
        if (val == null) return; // título de sección
        doc.setFont("helvetica", "normal");
        const ls = doc.splitTextToSize(String(val || ""), w);
        doc.text(ls, xv, yFila);
        lineas = Math.max(lineas, ls.length);
      });
      yFila += 4.3 + (lineas - 1) * 3.3;
    }
  };
  pintarFilas(izquierda, derecha);
  yFila += 1.5;
  pintarFilas(transporteIzq, transporteDer);
  const altoCaja = yFila - 4.3 + 2.5 - yCaja;
  doc.setLineWidth(0.25);
  doc.roundedRect(M, yCaja, CONTENT_W, altoCaja, 4, 4);
  y = yCaja + altoCaja + 7;

  // ─── Bienes a transportar ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Bienes a transportar:", M, y);
  autoTable(doc, {
    startY: y + 3,
    head: [[
      { content: "Item", styles: { halign: "center" } },
      { content: "Descripción", styles: { halign: "center" } },
      { content: "Unidad de medida", styles: { halign: "center" } },
      { content: "Cantidad", styles: { halign: "center" } },
    ]],
    body: (g.items || []).map((it, i) => [i + 1, it.descripcion, UNIDAD[it.unidad] || it.unidad, Number(it.cantidad ?? 0).toFixed(2)]),
    theme: "grid",
    margin: { left: M, right: M, top: 14, bottom: 14 },
    // Sin relleno en el cuerpo para que la marca de agua se vea detrás, como en la plantilla.
    styles: { fontSize: 8, textColor: 0, lineColor: 0, lineWidth: 0.1, fillColor: false, valign: "middle", cellPadding: { top: 0.6, bottom: 0.6, left: 1.2, right: 1.2 } },
    headStyles: { fillColor: AZUL, fontStyle: "bold", cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: "bold", halign: "center" },
      1: { halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
    },
    willDrawPage: (data) => { if (data.pageNumber > 1) dibujarMarcaDeAgua(); },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ─── Peso + datos del traslado (izquierda) y QR (derecha) ───
  const QR = 34;
  const lineasPeso = [
    `Unidad de medida del peso bruto: ${sinCodigo(UNIDAD_PESO, g.unidadPeso)}`,
    `Peso bruto total de la carga: ${Number(g.pesoBrutoTotal ?? 0).toFixed(2)}`,
    ...(g.numeroBultos ? [`Número de bultos: ${g.numeroBultos}`] : []),
  ];
  const lineasTraslado = [
    `Modalidad de traslado: ${sinCodigo(MODALIDAD_TRASLADO, g.modalidadTraslado)}`,
    `Indicador de transbordo programado: ${siNo(g.realizaTransbordo)}`,
    `Indicador de traslado en vehículos de categoría M1 o L: ${siNo(g.vehiculoM1L?.aplica)}${g.vehiculoM1L?.aplica && g.vehiculoM1L.placa ? ` (placa ${g.vehiculoM1L.placa})` : ""}`,
    `Indicador de retorno de vehículo con envases o embalajes vacíos: ${siNo(g.retornoEnvasesVacios)}`,
    `Indicador de retorno de vehículo vacío: ${siNo(g.retornoVehiculoVacio)}`,
  ];
  const altoBloque = Math.max((lineasPeso.length + lineasTraslado.length + 2) * 4.3, QR + 12);
  if (y + altoBloque > PAGE_H - 45) { doc.addPage(); dibujarMarcaDeAgua(); y = 18; }

  const yBloque = y;
  doc.setFont("helvetica", "normal");
  lineasPeso.forEach((t) => { doc.text(t, M, y); y += 4.3; });
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Datos del traslado:", M, y);
  y += 4.3;
  doc.setFont("helvetica", "normal");
  lineasTraslado.forEach((t) => { doc.text(doc.splitTextToSize(t, R - QR - 12 - M), M, y); y += 4.3; });

  const qrX = R - QR - 6, qrY = yBloque + 10;
  doc.setLineWidth(0.2);
  doc.rect(qrX - 2, qrY - 2, QR + 4, QR + 4);
  doc.addImage(qr, "PNG", qrX, qrY, QR, QR);
  doc.setFontSize(7);
  doc.text(
    doc.splitTextToSize("Representación impresa de la Guía de Remisión Electrónica. Consulte su validez escaneando el código QR.", 62),
    qrX + QR / 2 + 2, qrY + QR + 6, { align: "center" }
  );

  // ─── Pie: línea + marcas, anclado abajo como en la plantilla ───
  const marcasW = CONTENT_W + 6;
  const marcasH = marcas ? marcasW * (marcas.naturalHeight / marcas.naturalWidth) : 0;
  const yPie = PAGE_H - marcasH - 14;
  doc.setLineWidth(0.4);
  doc.line(M - 4, yPie, R + 4, yPie);
  if (marcas) doc.addImage(marcas, "PNG", (PAGE_W - marcasW) / 2, yPie + 4, marcasW, marcasH, "marcas", "FAST");

  doc.save(`Guia ${numeroGuia(g)}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
