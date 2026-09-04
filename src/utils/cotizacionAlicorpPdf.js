import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HUAQUIAN } from "./cotizacionPdf";
import { GRUPOS_ALICORP, calcSubtotal, calcularAlicorp, descripcionConSubItems } from "./cotizacionItems";

// Cargar así (no `import logo from "./logo.png"`) para que un archivo
// todavía no subido solo falle esa imagen puntual en vez de romper todo el
// export — ver skill pdf-cotizacion-recetas, receta #4.
function cargarImagen(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const GRIS_CLARO = [232, 232, 232];

const COLUMNAS_TABLA = {
  head: (grupo) => [grupo.label.toUpperCase(), "Unidad", "Precio Unitario", "Cantidad", "Parcial"],
  fila: (item) => [
    descripcionConSubItems(item),
    item.unidad || "und",
    (Number(item.precio) || 0).toFixed(2),
    item.cantidad ?? 0,
    calcSubtotal(item).toFixed(2),
  ],
};

// Formato "Alicorp" — reproduce el layout de cotizacion-alicorp.xlsx con
// jsPDF + jspdf-autotable en vez del .xlsx real, mismo criterio que
// cotizacionGloriaPdf.js (ítems fluyen y paginan solos, sin el riesgo de
// insertar filas dinámicas en una plantilla con celdas combinadas). Aplica
// desde el día uno los fixes de jspdf-autotable ya depurados para Gloria
// (ancho fijo, sin líneas entre sub-ítems, pie sin marco en celdas vacías,
// redibujado del borde inferior del header).
// Compartido por Alicorp (RUC 20100055237), Intradevco (20417378911) y
// Masterbread (20557345931) — ver RUCS_FORMATO_ALICORP en cotizacionItems.js.
// Los datos de "Información de cliente" se leen de `cotizacion.empresa`
// (razón social + dirección de la planta elegida, o la dirección fiscal si
// no hay planta) en vez de estar hardcodeados a Alicorp.
export const exportarCotizacionAlicorpPdf = async (cotizacion) => {
  const doc = new jsPDF();
  const M = 12;
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CONTENT_W = PAGE_W - M * 2;

  const [icono, marcasFooter, logoHuaquian] = await Promise.all([
    cargarImagen("/assets/logos/huaquian_icon.png"),
    cargarImagen("/assets/logos/marcas_footer.png"),
    cargarImagen("/assets/logos/logo_huaquian.jpg"),
  ]);

  const dibujarMarcaDeAgua = () => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    if (icono) {
      const wSize = 100;
      doc.addImage(icono, "PNG", 96 - (PAGE_W - wSize) / 2, (PAGE_H - wSize) / 2 - 35, wSize + 40, wSize + 40);
    }
    if (marcasFooter) {
      const w = CONTENT_W * 0.85;
      const h = w * (marcasFooter.naturalHeight / marcasFooter.naturalWidth);
      doc.addImage(marcasFooter, "PNG", (PAGE_W - w) / 2, (PAGE_H - h) / 2 + 110, w, h);
    }
    doc.restoreGraphicsState();
  };
  dibujarMarcaDeAgua();

  const saltoDePaginaSiHaceFalta = (alturaNecesaria, yActual) => {
    if (yActual + alturaNecesaria > PAGE_H - 15) {
      doc.addPage();
      dibujarMarcaDeAgua();
      return 15;
    }
    return yActual;
  };

  const barraSeccion = (titulo, yy, h = 6) => {
    doc.setFillColor(...GRIS_CLARO);
    doc.rect(M, yy, CONTENT_W, h, "F");
    doc.setDrawColor(0);
    doc.rect(M, yy, CONTENT_W, h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(titulo, M + 2, yy + h / 2 + 1.2);
    return yy + h + 4;
  };

  const labelValor = (x, yy, label, valor) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(label, x, yy);
    doc.setFont("helvetica", "normal");
    doc.text(valor || "—", x + doc.getTextWidth(label), yy);
  };

  // ─── Cabecera: logo Huaquian (izq.) + datos de Huaquian, fijos (der.) ───
  let y = 10;
  const logoW = 40, logoH = 24;
  if (logoHuaquian) {
    const pad = 1;
    const ratio = logoHuaquian.naturalWidth / logoHuaquian.naturalHeight;
    let dw = logoW - pad * 2, dh = dw / ratio;
    if (dh > logoH - pad * 2) { dh = logoH - pad * 2; dw = dh * ratio; }
    doc.addImage(logoHuaquian, "JPEG",M + (logoW - dw) / 2, y + (logoH - dh) / 2, dw, dh);
  }
  const xDatos = M + logoW + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("HUAQUIAN SAC", xDatos + 20, y + 5);
  doc.setFontSize(9);
  let yDatos = y + 11;
  labelValor(xDatos, yDatos, "RUC: ", HUAQUIAN.ruc); yDatos += 4.2;
  labelValor(xDatos, yDatos, "Dirección:  ", HUAQUIAN.direccion); yDatos += 4.2;
  labelValor(xDatos, yDatos, "Telefono:  ", HUAQUIAN.telefono); yDatos += 4.2;
  labelValor(xDatos, yDatos, "Email: ", HUAQUIAN.correo); yDatos += 4.2;
  y = Math.max(y + logoH, yDatos) + 3;
  doc.setDrawColor(0);
  doc.line(M, y, PAGE_W - M, y);
  y += 5;

  // ─── Información de cliente — datos reales de la empresa/planta de la
  // cotización (antes hardcodeado a Alicorp; ahora también sirve a
  // Intradevco/Masterbread, ver RUCS_FORMATO_ALICORP en cotizacionItems.js).
  // La dirección es la de la planta elegida si coincide con `cotizacion.planta`
  // (mismo criterio que EmitirGuia.jsx), si no cae a la dirección fiscal de
  // la empresa.
  const plantaCliente = cotizacion.empresa?.plantas?.find((p) => p.nombre === cotizacion.planta);
  const direccionCliente = plantaCliente?.direccion || cotizacion.empresa?.direccion || "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Información de cliente:", M, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Razón social : ", M, y);
  doc.setFont("helvetica", "bold");
  doc.text(cotizacion.empresa?.razonSocial || "—", M + doc.getTextWidth("Razón social : "), y);
  y += 4.2;
  labelValor(M, y, "Dirección      :  ", direccionCliente); y += 4.2;
  labelValor(M, y, "Contacto       :  ", cotizacion.personaContacto); y += 4.2;
  labelValor(M, y, "Aviso             :  ", cotizacion.omAviso);
  labelValor(M + 110, y, "Guía : ", cotizacion.numeroGuia);
  y += 6;

  // ─── Código de cotización + Texto breve del servicio ───
  // El código de cotización es el correlativo de la cotización + "-" + los 2
  // últimos dígitos del año actual (ej. "10398-26") — se calcula acá, no se
  // guarda en el documento.
  const anioYY = String(new Date().getFullYear()).slice(-2);
  const codigoCotizacion = `${cotizacion.numeroCotizacion || cotizacion.codigo || "—"}-${anioYY}`;
  labelValor(M, y, "Código de cotización:    ", codigoCotizacion); y += 4.2;
  if (cotizacion.textoBreveServicio) {
    labelValor(M, y, "Texto breve del servicio:    ", cotizacion.textoBreveServicio);
    y += 4.2;
  }
  y += 2;

  // ─── Detalle del Servicio — texto libre (mismo campo `titulo` que usa
  // Gloria para "Alcance del Servicio") ───
  y = barraSeccion("Detalle del Servicio", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const lineasDetalle = doc.splitTextToSize(cotizacion.titulo || "—", CONTENT_W - 4);
  doc.text(lineasDetalle, M + 2, y + 3);
  y += lineasDetalle.length * 4 + 4;

  // ─── Detalle de oferta — 5 tablas de ítems, todas con las mismas columnas
  // (a diferencia de Gloria, acá no hay variante de Mano de Obra ni columna
  // de N° de ítem) ───
  y = barraSeccion("Detalle de oferta", y);

  const items = cotizacion.items || [];
  const COL_UNIDAD = 16, COL_PRECIO = 26, COL_CANTIDAD = 18, COL_PARCIAL = 26;
  const COL_DESCRIPCION = CONTENT_W - COL_UNIDAD - COL_PRECIO - COL_CANTIDAD - COL_PARCIAL;
  const ANCHO_COLUMNAS = {
    0: { cellWidth: COL_DESCRIPCION, halign: "left" },
    1: { cellWidth: COL_UNIDAD, halign: "center" },
    2: { cellWidth: COL_PRECIO, halign: "right" },
    3: { cellWidth: COL_CANTIDAD, halign: "center" },
    4: { cellWidth: COL_PARCIAL, halign: "right" },
  };

  GRUPOS_ALICORP.forEach((grupo) => {
    y = saltoDePaginaSiHaceFalta(20, y);

    const itemsGrupo = items.filter((i) => i.grupo === grupo.clave);
    const subtotalGrupo = itemsGrupo.reduce((acc, i) => acc + calcSubtotal(i), 0);
    // Sin filas de cuerpo, jspdf-autotable ignora columnStyles.cellWidth y
    // recalcula los anchos según el texto de cabecera/pie (mismo bug que ya
    // depuramos en Gloria) — una fila en blanco basta para que lo respete.
    const filas = itemsGrupo.length
      ? itemsGrupo.map((item) => COLUMNAS_TABLA.fila(item))
      : [["", "", "", "", ""]];

    let bordeInferiorHeader = null;

    autoTable(doc, {
      startY: y,
      head: [COLUMNAS_TABLA.head(grupo)],
      body: filas,
      // "TOTAL" en la columna Cantidad, valor en Parcial — mismo criterio
      // que la plantilla real (fila "Sub-Total" de cada tabla).
      foot: [["", "", "", "TOTAL", subtotalGrupo.toFixed(2)]],
      showFoot: "lastPage",
      theme: "grid",
      margin: { left: M, right: M },
      tableWidth: CONTENT_W,
      styles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: GRIS_CLARO, lineColor: [0, 0, 0], lineWidth: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } },
      bodyStyles: { lineWidth: { top: 0, bottom: 0.1, left: 0.1, right: 0.1 }, cellPadding: { top: 0.8, bottom: 0.8, left: 1.5, right: 1.5 } },
      footStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: [255, 255, 255], lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: ANCHO_COLUMNAS,
      // El pie solo tiene contenido en Cantidad/Parcial — que las 3 primeras
      // columnas no pidan marco ni relleno (mismo fix que Gloria).
      didParseCell: (data) => {
        if (data.section === "foot" && data.column.index < 3) {
          data.cell.styles.lineWidth = 0;
          data.cell.styles.fillColor = false;
        }
        // columnStyles no llega al pie (confirmado contra el código fuente
        // de jspdf-autotable) — el halign de la celda de valor se pide acá.
        if (data.section === "foot" && data.column.index === 4) {
          data.cell.styles.halign = "right";
        }
      },
      didDrawCell: (data) => {
        if (data.section === "head") {
          const borde = data.cell.y + data.cell.height;
          if (bordeInferiorHeader === null || borde > bordeInferiorHeader) bordeInferiorHeader = borde;
        }
      },
      didDrawPage: dibujarMarcaDeAgua,
    });

    if (bordeInferiorHeader !== null) {
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.line(M, bordeInferiorHeader, M + CONTENT_W, bordeInferiorHeader);
    }

    y = doc.lastAutoTable.finalY + 5;
  });

  // ─── Totales — se corta en "Total (sin IGV)": el PDF nunca imprime IGV ni
  // el valor con IGV (confirmado explícitamente por el usuario) — pero
  // `cotizacion.total` (usado en el resto de la cadena OC/Factura) sigue
  // guardando el monto con IGV, calculado en DetalleCotizacion.jsx/
  // ModalNuevaCotizacion.jsx vía calcularAlicorp — acá solo se recalcula
  // para imprimir, no se usa `cotizacion.total`.
  const simboloDoc = cotizacion.moneda === "USD" ? "US$" : "S/";
  const subtotalTotalItems = items.reduce((acc, i) => acc + calcSubtotal(i), 0);
  const totales = calcularAlicorp(subtotalTotalItems, cotizacion.gastosGeneralesPorcentaje, cotizacion.utilidadPorcentaje);

  y = saltoDePaginaSiHaceFalta(40, y);
  const totW = 90, totX = PAGE_W - M - totW, filaTotH = 7;
  const filasTotales = [
    ["Moneda: " + (cotizacion.moneda === "USD" ? "Dólares" : "Soles"), "", false],
    ["SUB-TOTAL", `${simboloDoc} ${totales.subtotal.toFixed(2)}`, false],
    [`GASTOS ADMINISTRATIVOS (${totales.gastosAdminPorcentaje}%)`, `${simboloDoc} ${totales.gastosAdmin.toFixed(2)}`, false],
    [`UTILIDAD (${totales.utilidadPorcentaje}%)`, `${simboloDoc} ${totales.utilidad.toFixed(2)}`, false],
    ["TOTAL (SIN IGV)", `${simboloDoc} ${totales.totalSinIgv.toFixed(2)}`, true],
  ];
  filasTotales.forEach(([label, valor, negrita]) => {
    doc.setFillColor(...(negrita ? [173, 193, 229] : [255, 255, 255]));
    doc.rect(totX, y, totW, filaTotH, "F");
    doc.setDrawColor(0);
    doc.rect(totX, y, totW, filaTotH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(negrita ? 9 : 8);
    doc.text(label, totX + 3, y + filaTotH / 2 + 1.2);
    if (valor) doc.text(valor, totX + totW - 3, y + filaTotH / 2 + 1.2, { align: "right" });
    y += filaTotH;
  });
  y += 6;

  // ─── Cláusulas a considerar ───
  y = saltoDePaginaSiHaceFalta(30, y);
  y = barraSeccion("Clausulas a considerar", y);
  doc.setFontSize(8.5);
  const clausula = (label, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(valor || "—", M + 2 + doc.getTextWidth(label), y);
    y += 4.5;
  };
  clausula("Tiempo de entrega  :   ", cotizacion.plazoEntrega);
  clausula("Tiempo de pago      :   ", cotizacion.condicionPago);
  clausula("Garantia                    :  ", cotizacion.tiempoGarantia);

  doc.save(`Cotización ${cotizacion.empresa?.razonSocial || ""} N° ${codigoCotizacion}.pdf`.replace(/\s+/g, " "));
};
