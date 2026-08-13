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

// Logos de marcas representadas — van siempre al pie de cada cotización.
// El orden del array define el orden izquierda→derecha en el pie (ver más
// abajo): ACHEM va primero (extrema izquierda) y HUAHAI al final (extrema
// derecha), como en la imagen de referencia.
const LOGOS_MARCAS = [
  { src: "/assets/logos/logo_achem.png",     format: "PNG" },
  { src: "/assets/logos/logo_Gruetzner.png", format: "PNG" },
  { src: "/assets/logos/logo_KOGANEI.jpg",   format: "JPEG" },
  { src: "/assets/logos/logo_beko.png",      format: "PNG" },
  { src: "/assets/logos/logo_kcpc.jpg",      format: "JPEG" }, // XCPC
  { src: "/assets/logos/logo_huahai.png",    format: "PNG" },
];

export const exportarCotizacionPdf = async (cotizacion) => {
  const doc = new jsPDF();
  const empresa = cotizacion.empresa;
  const PAGE_R = 196;

  const [icono, textoLogo, ...marcasImgs] = await Promise.all([
    // Cuadrado (1:1): ícono globo+paloma con "ALCOINSAC" apilado debajo.
    // TODO: logo pendiente de actualizar a Huaquian — el usuario aún no tiene el arte nuevo.
    cargarImagen("/assets/logos/Logo_grande-DESKTOP-3FJUSSF.png"),
    // Wordmark ancho (~4.46:1): "ALCOINSAC / ALPHA CONTROL E INGENIERIA S.A.C.".
    // TODO: logo pendiente de actualizar a Huaquian — el usuario aún no tiene el arte nuevo.
    cargarImagen("/assets/logos/Logo_pequeño.png"),
    ...LOGOS_MARCAS.map((m) => cargarImagen(m.src)),
  ]);

  // ─── Marca de agua: ícono centrado detrás de todo el contenido ───
  // Se dibuja primero (antes que cualquier otro texto/imagen) para que quede
  // detrás — en PDF cada trazo nuevo se pinta encima de lo anterior.
  if (icono) {
    const wSize = 100;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.addImage(icono, "PNG", (pageW - wSize) / 2, (pageH - wSize) / 2, wSize, wSize);
    doc.restoreGraphicsState();
  }

  // ─── Encabezado: logos a la izquierda, datos de contacto a la derecha ───
  if (icono) doc.addImage(icono, "PNG", 14, 3, 30, 30);
  if (textoLogo) doc.addImage(textoLogo, "PNG", 43, 10, 90, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let ry = 14;
  doc.text("Mza. F1 Lote 16 Urbanizacion El Dorado", PAGE_R-25, ry, { align: "center" }); ry += 4;
  doc.text("Puente Piedra - Lima - Lima", PAGE_R-25, ry, { align: "center" }); ry += 4;
  // TODO: dominio/correo placeholder — reemplazar cuando exista el dominio real de Huaquian.
  doc.text("www.huaquian.com   ventas@huaquian.com", PAGE_R-25, ry, { align: "center" }); ry += 4;
  doc.text("CEL: 969585300", PAGE_R-25, ry, { align: "center" });

  let y = 32;
  doc.setDrawColor(200);
  doc.line(14, y, PAGE_R, y);
  y += 7;

  // ─── Señores/Atención (izquierda) + Cotización/Fecha (derecha) ───
  const fechaStr = cotizacion.fecha ? new Date(cotizacion.fecha).toLocaleDateString("es-PE") : "-";

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Señores:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(empresa?.razonSocial || "-", 32, y);
  doc.setFont("helvetica", "bold");
  doc.text(`COTIZACION: ${cotizacion.numeroCotizacion || "-"}`, 150, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Atención:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(cotizacion.atencion || "-", 32, y);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", 113, y);
  doc.setFont("helvetica", "normal");
  doc.text(fechaStr, 150, y, { align: "right" });
  y += 10;

  // ─── Párrafo de presentación (fijo) ───
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("De nuestra mayor consideración:", 14, y);
  y += 6;
  const parrafo =
    "Nos es grato presentarnos ante ud. Para saludarlo cordialmente y a su vez presentarle nuestra PROPUESTA COMERCIAL.";
  const lineas = doc.splitTextToSize(parrafo, PAGE_R - 14);
  doc.text(lineas, 14, y);
  y += lineas.length * 5 + 6;

  // ─── Título + condición de pago ───
  // doc.setFontSize(10);
  // doc.setFont("helvetica", "bold");
  // const tituloLineas = doc.splitTextToSize(cotizacion.titulo || "", PAGE_R - 14);
  // doc.text(tituloLineas, 14, y);
  // y += tituloLineas.length * 5 + 3;

  // Tipo "servicio": descripción con sub-ítems en viñetas + columna Moneda.
  // Tipo "venta": tabla simple Item/Descripción/Cantidad/Precio unitario/Precio total.
  const esVenta = cotizacion.tipo === "venta";
  // Moneda de TODA la cotización (no la de cada ítem) — determina el símbolo
  // de Subtotal/IGV/TOTAL al pie de la tabla.
  const simboloDoc = cotizacion.moneda === "USD" ? "US$" : "S/";

  // Para tipo "servicio": una fila de tabla por cada sub-ítem (en vez de
  // apilar todos los sub-ítems dentro de la celda del ítem padre). `esSubfila`
  // queda en paralelo a `body` para que didParseCell sepa a cuál de las dos
  // filas (padre en negrita / sub-ítem normal) le toca cada estilo.
  const esSubfila = [];
  autoTable(doc, {
    startY: y,
    head: esVenta
      ? [["#", "Descripción", "Cant.", "Precio Unitario", "Precio Total"]]
      : [["#", "Descripción", "Cant.", "Precio", "Mon.", "Subtotal"]],
    body: esVenta
      ? cotizacion.items.map((item, i) => {
          // Ítems informativos (sin costo propio, p.ej. sub-agrupaciones del
          // catálogo) suelen quedar en 0.00 — se ocultan #, Cantidad, Moneda,
          // Precio y Subtotal (en blanco) en vez de mostrar ceros que no aplican.
          const precioNum = Number(item.precio) || 0;
          const subtotalNum = Number(item.subtotal) || 0;
          const esInformativo = precioNum === 0;
          const simbolo = item.moneda === "PEN" ? "S/" : "$";
          return [
            esInformativo ? "" : i + 1,
            item.descripcion,
            esInformativo ? "" : item.cantidad,
            esInformativo ? "" : `${simbolo} ${precioNum.toFixed(2)}`,
            subtotalNum === 0 ? "" : `${simbolo} ${subtotalNum.toFixed(2)}`,
          ];
        })
      : cotizacion.items.flatMap((item, i) => {
          const precioNum = Number(item.precio) || 0;
          const subtotalNum = Number(item.subtotal) || 0;
          const esInformativo = precioNum === 0;
          esSubfila.push(false);
          const filaPadre = [
            esInformativo ? "" : i + 1,
            item.descripcion,
            esInformativo ? "" : item.cantidad,
            esInformativo ? "" : precioNum.toFixed(2),
            esInformativo ? "" : (item.moneda === "PEN" ? "S/" : "$"),
            subtotalNum === 0 ? "" : subtotalNum.toFixed(2),
          ];
          const filasSub = (item.subItems || []).map((s) => {
            esSubfila.push(true);
            return ["", `   • ${s}`, "", "", "", ""];
          });
          return [filaPadre, ...filasSub];
        }),
    foot: esVenta
      ? [
          [{ content: "Subtotal:", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } }, `${simboloDoc} ${Number(cotizacion.subtotal).toFixed(2)}`],
          [{ content: "IGV 18%:", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } }, `${simboloDoc} ${Number(cotizacion.igv).toFixed(2)}`],
          [{ content: "TOTAL:", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } }, `${simboloDoc} ${Number(cotizacion.total).toFixed(2)}`],
        ]
      : [
          [{ content: "Subtotal:", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } }, `${simboloDoc} ${Number(cotizacion.subtotal).toFixed(2)}`],
          [{ content: "IGV 18%:", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } }, `${simboloDoc} ${Number(cotizacion.igv).toFixed(2)}`],
          [{ content: "TOTAL:", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } }, `${simboloDoc} ${Number(cotizacion.total).toFixed(2)}`],
        ],
    theme: "grid",
    margin: { left: 10, right: 10 },
    // Subtotal/IGV/Total (foot) solo en la última página — por defecto
    // autoTable repite el foot en cada página cuando la tabla se parte.
    showFoot: "lastPage",
    // Como las filas del cuerpo ya no tienen borde inferior propio (ver
    // "styles" más abajo), sin esto la tabla queda "abierta" al final de
    // cada página cuando se corta en varias — tableLineWidth dibuja un
    // rectángulo de cierre alrededor de todo el contenido de esa página en
    // cada salto (y otra vez al final de la última página).
    tableLineWidth: 0.1,
    tableLineColor: [0, 0, 0],
    // El marco exterior de la tabla se arma con el borde completo de
    // encabezado y pie (top+bottom+left+right) — solo las FILAS DEL CUERPO
    // pierden las líneas horizontales entre sí (top/bottom en 0, se
    // mantienen las verticales left/right para separar columnas).
    styles: { fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: { top: 0, bottom: 0, left: 0.1, right: 0.1 }, fillColor: false },
    headStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: false, lineColor: [0, 0, 0], lineWidth: 0.1 },
    footStyles: { halign: "right", fontStyle: "bold", textColor: [0, 0, 0], fillColor: false, lineColor: [0, 0, 0], lineWidth: 0.1 },
    alternateRowStyles: { fillColor: false },
    columnStyles: esVenta
      ? {
          0: { cellWidth: 8,  halign: "center" },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 32, halign: "right" },
        }
      : {
          0: { cellWidth: 8,  halign: "center" },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 22, halign: "right" },
          4: { cellWidth: 12, halign: "center" },
          5: { cellWidth: 26, halign: "right" },
        },
    // Cada sub-ítem ahora es su propia fila (ver `esSubfila` más arriba), así
    // que ya no hay que mezclar negrita+normal dentro de una misma celda:
    // alcanza con negrita en la columna Descripción de las filas padre, y
    // peso normal (con sangría) en las filas de sub-ítem.
    didParseCell: (data) => {
      if (esVenta || data.section !== "body" || data.column.index !== 1) return;
      if (esSubfila[data.row.index]) {
        data.cell.styles.cellPadding = { ...data.cell.styles.cellPadding, left: (data.cell.styles.cellPadding.left || 0) + 4 };
      } else {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ─── Condiciones comerciales ───
  let y2 = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Condiciones comerciales:", 14, y2);
  y2 += 6;

  doc.setFont("helvetica", "normal");
  const condiciones = [
    ["Forma de pago", cotizacion.condicionPago],
    ["Plazo de entrega", cotizacion.plazoEntrega],
    ["Lugar de entrega", cotizacion.lugarEntrega],
    ["Validez de la oferta", cotizacion.validezOferta],
  ];
  condiciones.forEach(([label, valor]) => {
    doc.text(label, 14, y2);
    doc.text(":", 50, y2);
    doc.text(valor || "-", 54, y2);
    y2 += 5;
  });
  y2 += 5;

  const cierre = "Sin otro en particular quedamos a la espera de su grata orden de compra.";
  const cierreLineas = doc.splitTextToSize(cierre, PAGE_R - 14);
  doc.text(cierreLineas, 14, y2);
  y2 += cierreLineas.length * 5 + 10;

  doc.text("Atentamente,", 14, y2);
  y2 += 12;
  doc.setFont("helvetica", "bold");
  doc.text("JESUS HERRERA", 14, y2);
  y2 += 5;
  doc.text("HUAQUIAN", 14, y2);
    y2 += 5;
  doc.text("CEL: 969585300", 14, y2);

  // ─── Pie de página: logos de marcas representadas ───
  const marcasCargadas = LOGOS_MARCAS
    .map((m, i) => ({ ...m, img: marcasImgs[i] }))
    .filter((m) => m.img);
  if (marcasCargadas.length > 0) {
    const altoLogo = 20;
    const espacio = 8;
    const anchos = marcasCargadas.map((m) => (m.img.naturalWidth / m.img.naturalHeight) * altoLogo);
    const anchoTotal = anchos.reduce((a, b) => a + b, 0) + espacio * (marcasCargadas.length - 1);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let fx = (pageW - anchoTotal) / 2;
    const fy = pageH - altoLogo - 8;
    marcasCargadas.forEach((m, i) => {
      doc.addImage(m.img, m.format, fx, fy, anchos[i], altoLogo);
      fx += anchos[i] + espacio;
    });
  }

  doc.save(`${cotizacion.codigo}.pdf`);
};
