import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Se cargan desde /public (no un import de módulo) para que, si el archivo
// todavía no fue subido, solo falle la carga de esa imagen puntual en vez
// de romper el build o la exportación completa del PDF.
function cargarImagen(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Paleta y datos fijos de Huaquian, tomados de Plantilla-cotizacion.xlsx
// (raíz del proyecto) — no varían por cotización, así que van hardcodeados
// acá igual que ya hacía el header anterior con los datos de la empresa.
const NAVY = [0, 0, 40];       // #000028 — barras de sección y banner
const AZUL = [0, 74, 173];     // #004AAD — badge "COTIZACIÓN N°"
const AZUL_CLARO = [173, 193, 229]; // #ADC1E5 — fila "VALOR DE LA OFERTA"
const GRIS_CLARO = [232, 232, 232]; // #E8E8E8 — encabezados de tabla

const HUAQUIAN = {
  razonSocial: "HUAQUIAN S.A.C.",
  ruc: "20601565235",
  direccion: "MZ.A LT1. ASOCIACIÓN VILLA TALAVERA CAMPOY, SAN JUAN DE LURIGANCHO - LIMA.",
  representante: "JOSE LIDER MATEO MUCHA",
  telefono: "966 -757 - 528.",
  correo: "ventas@huaquian.com",
};

const BANCOS = {
  bcpCuentaSoles: "191-2364174-0-44",
  bcpCciSoles: "002-19100236417404456",
  bcpCuentaDolares: "191-2559651-1-69",
  bcpCciDolares: "002-191002255965116958",
  bnCuentaDetraccion: "00-062-084456",
};

const GARANTIA_TEXTO = "En condiciones normales de uso";
const POLIZA_TEXTO = "- Responsabilidad / Seguro complementario de trabajo de riesgo";

export const exportarCotizacionPdf = async (cotizacion) => {
  const doc = new jsPDF();
  const empresa = cotizacion.empresa;
  const M = 12; // margen
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CONTENT_W = PAGE_W - M * 2;

  const [icono, headerBanner, marcasFooter, bcpLogo, bnLogo] = await Promise.all([
    cargarImagen("/assets/logos/huaquian_icon.png"),
    cargarImagen("/assets/logos/huaquian_header.png"),
    cargarImagen("/assets/logos/marcas_footer.png"),
    cargarImagen("/assets/logos/bcp_logo.png"),
    cargarImagen("/assets/logos/banco_nacion_logo.png"),
  ]);

  // ─── Marca de agua: ícono centrado detrás de todo el contenido ───
  // Se dibuja primero (antes que cualquier otro texto/imagen) para que quede
  // detrás — en PDF cada trazo nuevo se pinta encima de lo anterior.
  if (icono) {
    const wSize = 100;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.addImage(icono, "PNG", (PAGE_W - wSize) / 2, (PAGE_H - wSize) / 2, wSize, wSize);
    doc.restoreGraphicsState();
  }

  // ─── Banner de encabezado (navy, ancho completo) ───
  let y = 6;
  if (headerBanner) {
    const h = CONTENT_W * (headerBanner.naturalHeight / headerBanner.naturalWidth);
    doc.addImage(headerBanner, "PNG", M, y, CONTENT_W, h);
    y += h + 6;
  } else {
    doc.setFillColor(...NAVY);
    doc.rect(M, y, CONTENT_W, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("HUAQUIAN", M + 4, y + 9);
    y += 14 + 6;
  }

  // ─── Badge "COTIZACIÓN N°" (arriba a la derecha) ───
  const badgeH = 8, badgeW1 = 40, badgeW2 = 28;
  const badgeX = PAGE_W - M - badgeW1 - badgeW2;
  doc.setFillColor(...AZUL);
  doc.rect(badgeX, y, badgeW1, badgeH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("COTIZACIÓN N°", badgeX + badgeW1 / 2, y + badgeH / 2 + 1.2, { align: "center" });
  doc.setDrawColor(0);
  doc.rect(badgeX + badgeW1, y, badgeW2, badgeH);
  doc.setTextColor(...AZUL);
  doc.setFontSize(11);
  doc.text(String(cotizacion.numeroCotizacion || cotizacion.codigo || "—"), badgeX + badgeW1 + badgeW2 / 2, y + badgeH / 2 + 1.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  const yBadgeBottom = y + badgeH;
  y += badgeH + 6;

  // ─── Datos de Huaquian (izquierda) + caja de datos comerciales (derecha) ───
  const colIzqW = 110, colDerX = M + colIzqW + 4, colDerW = CONTENT_W - colIzqW - 4;
  let yIzq = y;
  const labelValor = (x, yy, label, valor, maxW) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const labelW = doc.getTextWidth(label);
    doc.text(label, x, yy);
    doc.setFont("helvetica", "normal");
    if (maxW) {
      const lineas = doc.splitTextToSize(valor || "—", maxW - labelW);
      doc.text(lineas, x + labelW, yy);
      return lineas.length;
    }
    doc.text(valor || "—", x + labelW, yy);
    return 1;
  };
  yIzq += labelValor(M, yIzq, "RAZÓN SOCIAL: ", HUAQUIAN.razonSocial) * 4.2;
  yIzq += labelValor(M, yIzq, "RUC: ", HUAQUIAN.ruc) * 4.2;
  yIzq += labelValor(M, yIzq, "DIRECCIÓN: ", HUAQUIAN.direccion, colIzqW) * 4.2;
  yIzq += labelValor(M, yIzq, "REPRESENTANTE DE LA EMPRESA: ", HUAQUIAN.representante, colIzqW) * 4.2;
  yIzq += labelValor(M, yIzq, "TELÉFONO: ", HUAQUIAN.telefono) * 4.2;
  yIzq += labelValor(M, yIzq, "CORREO: ", HUAQUIAN.correo) * 4.2;

  const fechaStr = cotizacion.fecha ? new Date(cotizacion.fecha).toLocaleDateString("es-PE") : "—";
  const filasDer = [
    ["FECHA:", fechaStr],
    ["TIEMPO DE ENTREGA DEL SERVICIO:", cotizacion.plazoEntrega],
    ["VALIDEZ DE LA OFERTA:", cotizacion.validezOferta],
    ["ASESOR COMERCIAL:", cotizacion.asesorComercial],
    ["N° CELULAR:", cotizacion.numeroCelular],
  ];
  const filaDerH = 5.6;
  const cajaDerH = filasDer.length * filaDerH;
  doc.setDrawColor(0);
  doc.rect(colDerX, y - 4, colDerW, cajaDerH);
  let yDer = y;
  doc.setFontSize(7.5);
  filasDer.forEach(([label, valor]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, colDerX + colDerW - 2, yDer, { align: "right" });
    yDer += 3.2;
    doc.setFont("helvetica", "normal");
    doc.text(valor || "—", colDerX + colDerW - 2, yDer, { align: "right" });
    yDer += filaDerH - 3.2;
  });

  y = Math.max(yIzq, yDer, yBadgeBottom + cajaDerH) + 4;

  // ─── Barra de sección navy, ancho completo ───
  const barraSeccion = (titulo, yy, h = 6) => {
    doc.setFillColor(...NAVY);
    doc.rect(M, yy, CONTENT_W, h, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(titulo, M + 3, yy + h / 2 + 1.2);
    doc.setTextColor(0, 0, 0);
    return yy + h + 4;
  };

  // ─── DATOS DEL CLIENTE ───
  y = barraSeccion("DATOS DEL CLIENTE", y);
  const clienteColW = (CONTENT_W - 4) / 2;
  doc.setFontSize(8.5);
  let yClIzq = y, yClDer = y;
  yClIzq += labelValor(M, yClIzq, "RAZÓN SOCIAL: ", empresa?.razonSocial, clienteColW) * 4.2;
  yClIzq += labelValor(M, yClIzq, "ÁREA: ", cotizacion.area, clienteColW) * 4.2;
  yClIzq += labelValor(M, yClIzq, "OM / AVISO: ", cotizacion.omAviso, clienteColW) * 4.2;
  yClIzq += labelValor(M, yClIzq, "N° DE GUIA: ", cotizacion.numeroGuia, clienteColW) * 4.2;
  const xClDer = M + clienteColW + 4;
  yClDer += labelValor(xClDer, yClDer, "JEFE / SUPERVISOR SOLICITANTE: ", cotizacion.jefeSupervisorSolicitante, clienteColW) * 4.2;
  yClDer += labelValor(xClDer, yClDer, "COMPRADOR RESPONSABLE: ", cotizacion.compradorResponsable, clienteColW) * 4.2;
  yClDer += labelValor(xClDer, yClDer, "N° DE SOLICITUD DE PEDIDO: ", cotizacion.numeroSolicitudPedido, clienteColW) * 4.2;
  yClDer += labelValor(xClDer, yClDer, "N° DE PETICIÓN DE OFERTA: ", cotizacion.numeroPeticionOferta, clienteColW) * 4.2;
  y = Math.max(yClIzq, yClDer) + 4;

  // ─── DETALLES DEL SERVICIO ───
  y = barraSeccion("DETALLES DEL SERVICIO", y);
  doc.setFillColor(...GRIS_CLARO);
  doc.rect(M, y, CONTENT_W, 6, "F");
  doc.setDrawColor(0);
  doc.rect(M, y, CONTENT_W, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(cotizacion.titulo || "—", PAGE_W / 2, y + 4, { align: "center" });
  y += 6;

  // Moneda de TODA la cotización (no la de cada ítem) — determina el
  // símbolo de Valor de la Oferta / IGV / Valor Total al pie de la tabla.
  const simboloDoc = cotizacion.moneda === "USD" ? "US$" : "S/";

  // Un ítem = una fila; sus sub-ítems (si tiene) van como filas adicionales
  // en bullet, en la misma columna Descripción (ver recetas del skill
  // pdf-cotizacion-recetas para el porqué de una fila por sub-ítem).
  const esSubfila = [];
  autoTable(doc, {
    startY: y,
    head: [["ITEM", "DESCRIPCIÓN", "UNID.", "CANT.", "PRECIO UNITARIO", "PRECIO TOTAL"]],
    body: cotizacion.items.flatMap((item, i) => {
      const precioNum = Number(item.precio) || 0;
      const subtotalNum = Number(item.subtotal) || 0;
      const esInformativo = precioNum === 0;
      esSubfila.push(false);
      const filaPadre = [
        esInformativo ? "" : i + 1,
        item.descripcion,
        esInformativo ? "" : (item.unidad || "und"),
        esInformativo ? "" : item.cantidad,
        esInformativo ? "" : precioNum.toFixed(2),
        subtotalNum === 0 ? "" : subtotalNum.toFixed(2),
      ];
      const filasSub = (item.subItems || []).map((s) => {
        esSubfila.push(true);
        return ["", `   • ${s}`, "", "", "", ""];
      });
      return [filaPadre, ...filasSub];
    }),
    theme: "grid",
    margin: { left: M, right: M },
    styles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: GRIS_CLARO, lineColor: [0, 0, 0], lineWidth: 0.1, halign: "center" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      if (esSubfila[data.row.index]) {
        data.cell.styles.cellPadding = { ...data.cell.styles.cellPadding, left: (data.cell.styles.cellPadding.left || 0) + 4 };
      } else {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ─── Totales (VALOR DE LA OFERTA / I.G.V. / VALOR TOTAL) ───
  if (y + 24 > PAGE_H - 15) { doc.addPage(); y = 15; }
  const totW = 80, totX = PAGE_W - M - totW, filaTotH = 7;
  const totales = [
    ["VALOR DE LA OFERTA", `${simboloDoc} ${Number(cotizacion.subtotal).toFixed(2)}`, AZUL_CLARO, false],
    ["I.G.V. (18%)", `${simboloDoc} ${Number(cotizacion.igv).toFixed(2)}`, [255, 255, 255], false],
    ["VALOR TOTAL DE LA OFERTA", `${simboloDoc} ${Number(cotizacion.total).toFixed(2)}`, [255, 255, 255], true],
  ];
  totales.forEach(([label, valor, bg, negrita]) => {
    doc.setFillColor(...bg);
    doc.rect(totX, y, totW, filaTotH, "F");
    doc.setDrawColor(0);
    doc.rect(totX, y, totW, filaTotH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(negrita ? 9 : 8);
    doc.text(label, totX + 3, y + filaTotH / 2 + 1.2);
    doc.text(valor, totX + totW - 3, y + filaTotH / 2 + 1.2, { align: "right" });
    y += filaTotH;
  });
  y += 6;

  // ─── TERMINOS Y CONDICIONES ───
  if (y + 40 > PAGE_H - 15) { doc.addPage(); y = 15; }
  const yTerminosBarra = y;
  y = barraSeccion("TERMINOS Y CONDICIONES", y);
  const yTerminosInicio = y;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("FORMAS DE PAGO: ", M + 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(cotizacion.condicionPago || "—", M + 2 + doc.getTextWidth("FORMAS DE PAGO: "), y);
  y += 4.5;
  doc.text("* PRECIOS INCLUYEN IGV", M + 2, y); y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.text("GARANTÍA: ", M + 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(GARANTIA_TEXTO, M + 2 + doc.getTextWidth("GARANTÍA: "), y); y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.text("TIEMPO DE GARANTIA: ", M + 2, y);
  doc.setFont("helvetica", "normal");
  doc.text(cotizacion.tiempoGarantia || "—", M + 2 + doc.getTextWidth("TIEMPO DE GARANTIA: "), y); y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.text("POLIZAS DE GARANTÍA: ", M + 2, y); y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(POLIZA_TEXTO, M + 2, y); y += 4;
  doc.setDrawColor(0);
  doc.rect(M, yTerminosBarra, CONTENT_W, (y - yTerminosInicio) + 6 + (yTerminosInicio - yTerminosBarra));
  y += 6;

  // ─── METODO DE PAGO ───
  if (y + 34 > PAGE_H - 15) { doc.addPage(); y = 15; }
  const yPagoBarra = y;
  y = barraSeccion("METODO DE PAGO", y);
  const yPagoInicio = y;
  const logoAltoBanco = 6;
  if (bcpLogo) {
    const w = logoAltoBanco * (bcpLogo.naturalWidth / bcpLogo.naturalHeight);
    doc.addImage(bcpLogo, "PNG", M + 2, y, w, logoAltoBanco);
  }
  y += logoAltoBanco + 2;
  doc.setFontSize(8);
  const lineaPago = (label, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(valor, M + 2 + doc.getTextWidth(label), y);
    y += 4;
  };
  lineaPago("* N° DE CUENTA EN SOLES: ", BANCOS.bcpCuentaSoles);
  lineaPago(" N° DE CCI EN SOLES: ", BANCOS.bcpCciSoles);
  lineaPago("* N° DE CUENTA EN DOLARES: ", BANCOS.bcpCuentaDolares);
  lineaPago(" N° DE CCI EN DOLARES: ", BANCOS.bcpCciDolares);
  y += 1;
  if (bnLogo) {
    const w = logoAltoBanco * (bnLogo.naturalWidth / bnLogo.naturalHeight);
    doc.addImage(bnLogo, "PNG", M + 2, y, w, logoAltoBanco);
  }
  y += logoAltoBanco + 2;
  lineaPago("* N° DE CUENTA DETRACCIÓN: ", BANCOS.bnCuentaDetraccion);
  doc.setDrawColor(0);
  doc.rect(M, yPagoBarra, CONTENT_W, (y - yPagoInicio) + 2 + (yPagoInicio - yPagoBarra));
  y += 4;

  // ─── Pie de página: grid de marcas representadas ───
  if (marcasFooter) {
    const h = CONTENT_W * (marcasFooter.naturalHeight / marcasFooter.naturalWidth) * 0.5;
    const w = h * (marcasFooter.naturalWidth / marcasFooter.naturalHeight);
    if (y + h > PAGE_H - 6) { doc.addPage(); y = 15; }
    doc.addImage(marcasFooter, "PNG", (PAGE_W - w) / 2, y, w, h);
  }

  doc.save(`${cotizacion.codigo}.pdf`);
};
