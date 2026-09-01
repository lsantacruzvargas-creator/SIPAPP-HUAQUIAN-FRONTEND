import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HUAQUIAN } from "./cotizacionPdf";
import { formatearFecha } from "./fecha";
import { GRUPOS_GLORIA, calcSubtotalGloria, calcularGloria, descripcionConSubItems } from "./cotizacionItems";

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

const NAVY = [0, 0, 40];
const GRIS_CLARO = [232, 232, 232];
const AMARILLO = [255, 242, 0];

// Párrafos de PENALIDAD — texto legal fijo, específico del formato de
// Gloria (ver plantilla-cotizacion-gloria.xlsx, filas 138/140/141), no son
// campos del form.
const PENALIDAD_PARRAFOS = [
  "Por fabricaciones con mal acabado o con diferentes especificaciones de lo ofertado, mantenimiento y suministro de material inadecuado se aplica una penalidad del 15% del valor de la oferta.",
  "Por incumplimiento de actividades se aplica una penalidad del 10% del valor de la oferta.",
  "La penalidad por defectos y daños en la operación del equipo ocasionados por el mantenimiento inadecuado o incumplimiento de las actividades serán reconocidos con la reparación o sustitución del equipo, sin costo alguno para GLORIA S.A.",
];

// Columna 0 = N° de ítem (ej. "1", "2.3") + columna 1 = descripción — en la
// plantilla real son 2 columnas separadas (B y C:F fusionada), no una sola;
// la fila de cabecera de cada grupo escribe su número + nombre ahí mismo
// (no hay una barra de sección aparte ni un rótulo genérico "DESCRIPCIÓN").
const COLUMNAS_TABLA = {
  cantidad_precio: {
    head: (grupo) => [String(grupo.numero), grupo.label.toUpperCase(), "UND", "CANT.", "P. UNIT.", "VALOR TOTAL S/."],
    fila: (item, numero) => [
      numero,
      descripcionConSubItems(item),
      item.unidad || "und",
      item.cantidad ?? 0,
      (Number(item.precio) || 0).toFixed(2),
      calcSubtotalGloria(item).toFixed(2),
    ],
  },
  mano_obra: {
    head: (grupo) => [String(grupo.numero), grupo.label.toUpperCase(), "N° PERSONAS", "N° HORAS", "S/. POR HORA", "VALOR TOTAL S/."],
    fila: (item, numero) => [
      numero,
      descripcionConSubItems(item),
      item.personas ?? 0,
      item.horas ?? 0,
      (Number(item.tarifaHora) || 0).toFixed(2),
      calcSubtotalGloria(item).toFixed(2),
    ],
  },
};

// Formato exclusivo de la empresa Gloria (RUC 20100190797) — reproduce el
// layout de plantilla-cotizacion-gloria.xlsx (raíz del proyecto) con jsPDF +
// jspdf-autotable en vez del .xlsx real: el contenido de los 5 grupos de
// ítems fluye y pagina solo, sin el riesgo de insertar filas dinámicas en
// una plantilla con ~100 celdas combinadas (ver informeTecnicoExcel.js, que
// documenta corrupción real de archivos con esa técnica en este proyecto).
export const exportarCotizacionGloriaPdf = async (cotizacion) => {
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
    doc.setFillColor(...NAVY);
    doc.rect(M, yy, CONTENT_W, h, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(titulo, M + 3, yy + h / 2 + 1.2);
    doc.setTextColor(0, 0, 0);
    return yy + h + 4;
  };

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

  // ─── Cabecera: logo Huaquian (izq.) + "LECHE GLORIA S.A." / ÁREA
  // (centro) + badge N° Cotización (der.) + los 4 campos de solicitud —
  // layout tomado tal cual de la plantilla real (plantilla-cotizacion-gloria.xlsx).
  let y = 8;
  const logoW = 30, logoH = 26;
  doc.setDrawColor(0);
  doc.rect(M, y, logoW, logoH);
  if (logoHuaquian) {
    const pad = 1.5;
    const ratio = logoHuaquian.naturalWidth / logoHuaquian.naturalHeight;
    let dw = logoW - pad * 2, dh = dw / ratio;
    if (dh > logoH - pad * 2) { dh = logoH - pad * 2; dw = dh * ratio; }
    doc.addImage(logoHuaquian, "JPEG", M + (logoW - dw) / 2, y + (logoH - dh) / 2, dw, dh);
  }

  const badgeW = 45;
  const centroX = M + logoW + 4;
  const centroW = CONTENT_W - logoW - 4 - badgeW - 4;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("LECHE GLORIA S.A.", centroX + centroW / 2, y + 6, { align: "center" });
  doc.setFontSize(10.5);
  doc.text(`ÁREA : ${(cotizacion.area || "—").toUpperCase()}`, centroX + centroW / 2, y + 11.5, { align: "center" });

  let yCampos = y + 16;
  doc.setFontSize(8);
  const campoCabecera = (label, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, centroX + centroW / 2, yCampos, { align: "right" });
    doc.setFont("helvetica", "normal");
    // doc.text(valor || "—", centroX + doc.getTextWidth(label) + 15, yCampos, { align: "left" });
    doc.text(valor || "—", 100, yCampos, { align: "left" });


    yCampos += 3.8;
  };
  campoCabecera("N° DE SOLICITUD DE PEDIDO :", cotizacion.numeroSolicitudPedido);
  campoCabecera("N° DE PETICIÓN DE OFERTA :", cotizacion.numeroPeticionOferta);
  campoCabecera("JEFE / SUPERVISOR SOLICITANTE :", cotizacion.jefeSupervisorSolicitante);
  campoCabecera("COMPRADOR RESPONSABLE:", cotizacion.compradorResponsable);

  // ─── Badge "N° COTIZACIÓN" (amarillo, como en la plantilla real) ───
  y += 30;
  const badgeX = PAGE_W - M - badgeW;
  // doc.setFillColor(...AMARILLO);
  // doc.rect(badgeX, y, badgeW, 7, "F");
  // doc.setDrawColor(0);
  doc.rect(badgeX, y, badgeW, 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("N° COTIZACIÓN:", badgeX + badgeW / 2 - 20, y + 4.7, { align: "left" });
  doc.setFontSize(9);
  // doc.text(String(cotizacion.numeroCotizacion || cotizacion.codigo || "—"), badgeX + badgeW / 2, y + 12, { align: "center" });
  doc.text(String(cotizacion.numeroCotizacion || cotizacion.codigo || "—"), doc.getTextWidth("N° COTIZACIÓN:") + badgeX + badgeW / 2 - 22, y + 4.7, { align: "left" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const fechaStr = cotizacion.fecha ? formatearFecha(cotizacion.fecha) : "—";
  doc.text(`FECHA: ${fechaStr}`, badgeX + badgeW / 2, y, { align: "center" });

  // y = Math.max(y + logoH, yCampos, y + 20) + 6;
  y += 5;
  // ─── DATOS DEL PROVEEDOR (Huaquian, fijo) ───
  y = barraSeccion("DATOS DEL PROVEEDOR", y);
  const colIzqW = CONTENT_W - 55;
  let yProv = y;
  yProv += labelValor(M, yProv, "RAZÓN SOCIAL: ", HUAQUIAN.razonSocial, colIzqW) * 4.2;
  yProv += labelValor(M, yProv, "DIRECCIÓN: ", HUAQUIAN.direccion, colIzqW) * 4.2;
  yProv += labelValor(M, yProv, "REPRESENTANTE DE LA EMPRESA: ", HUAQUIAN.representante, colIzqW) * 4.2;
  yProv += labelValor(M, yProv, "E-MAIL: ", HUAQUIAN.correo, colIzqW) * 4.2;
  const xProvDer = M + colIzqW + 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("RUC: ", xProvDer, y);
  doc.setFont("helvetica", "normal");
  doc.text(HUAQUIAN.ruc, xProvDer + doc.getTextWidth("RUC: "), y);
  doc.setFont("helvetica", "bold");
  doc.text("TELÉFONO: ", xProvDer, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.text(HUAQUIAN.telefono, xProvDer + doc.getTextWidth("TELÉFONO: "), y + 4.2);
  y = yProv + 2;

  // ─── ALCANCE DEL SERVICIO ───
  doc.setFillColor(...GRIS_CLARO);
  doc.rect(M, y, CONTENT_W, 6, "F");
  doc.setDrawColor(0);
  doc.rect(M, y, CONTENT_W, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ALCANCE DEL SERVICIO:", M + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(cotizacion.titulo || "—", M + 2 + doc.getTextWidth("ALCANCE DEL SERVICIO:__"), y + 4);
  y += 6 + 4;

  // ─── Datos del cliente (Gloria) — Área, Jefe/Supervisor solicitante,
  // Comprador responsable y las 2 solicitudes ya se muestran en la cabecera;
  // acá solo queda lo que no tiene lugar ahí.
  // y = barraSeccion("DATOS DEL CLIENTE", y);
  // doc.setFontSize(8.5);
  // y += labelValor(M, y, "OM / AVISO: ", cotizacion.omAviso, CONTENT_W) * 4.2;
  // y += labelValor(M, y, "N° DE GUIA: ", cotizacion.numeroGuia, CONTENT_W) * 4.2;
  y += 2;

  // ─── Las 5 tablas de ítems ───
  // Mismas 6 columnas y mismo ancho en las 5 tablas (el de Materiales) para
  // que las líneas verticales queden alineadas en las 5 — pedido explícito
  // del usuario.
  const items = cotizacion.items || [];
  const anchoColumnas = (item, col3, col4, col5, col6) => {
    const descripcion = CONTENT_W - item - col3 - col4 - col5 - col6;
    return {
      0: { cellWidth: item, halign: "center" },
      1: { cellWidth: descripcion, halign: "left" },
      2: { cellWidth: col3, halign: "center" },
      3: { cellWidth: col4, halign: "center" },
      4: { cellWidth: col5, halign: "right" },
      5: { cellWidth: col6, halign: "right" },
    };
  };
  const ANCHO_MATERIALES = anchoColumnas(10, 12, 12, 20, 20);
  const ESTILO_COLUMNAS_POR_GRUPO = {
    detalle_servicio:  ANCHO_MATERIALES,
    materiales:         ANCHO_MATERIALES,
    mano_obra:          ANCHO_MATERIALES,
    maquinaria_equipos: ANCHO_MATERIALES,
    seguridad_salud:    ANCHO_MATERIALES,
  };

  GRUPOS_GLORIA.forEach((grupo) => {
    y = saltoDePaginaSiHaceFalta(20, y);

    const cols = COLUMNAS_TABLA[grupo.columnas];
    const itemsGrupo = items.filter((i) => i.grupo === grupo.clave);
    const subtotalGrupo = itemsGrupo.reduce((acc, i) => acc + calcSubtotalGloria(i), 0);
    // Sin filas de cuerpo, jspdf-autotable ignora columnStyles.cellWidth y
    // recalcula los anchos según el texto de cabecera/pie — por eso los
    // grupos no obligatorios (Mano de Obra, Maquinaria, Seguridad), que
    // suelen quedar vacíos, se veían más anchos que Materiales. Una fila en
    // blanco basta para que respete el ancho fijo.
    const filas = itemsGrupo.length
      ? itemsGrupo.map((item, idx) => cols.fila(item, `${grupo.numero}.${idx + 1}`))
      : [["", "", "", "", "", ""]];

    // Borde inferior real del header — lo captura didDrawCell mientras
    // autoTable dibuja esa fila, y se vuelve a pintar a mano DESPUÉS de que
    // toda la tabla (body incluido) termine. El body se dibuja después del
    // header en la misma llamada, y su fill blanco (heredado del theme
    // "grid", ver `table.fillColor` en la librería) puede tapar esa línea
    // al superponerse en el límite — repintarla al final la deja siempre
    // encima, sin depender de por qué se tapa.
    let bordeInferiorHeader = null;

    autoTable(doc, {
      startY: y,
      head: [cols.head(grupo)],
      body: filas,
      // "TOTAL" alineado en la columna P. UNIT. (índice 4) — mismo criterio
      // que la plantilla real, no como colSpan sobre las primeras columnas.
      foot: [["", "", "", "", "TOTAL", subtotalGrupo.toFixed(2)]],
      showFoot: "lastPage",
      theme: "grid",
      margin: { left: M, right: M },
      // Ancho total fijo — sin esto, jspdf-autotable puede ensanchar columnas
      // más allá de su cellWidth cuando el texto de cabecera no entra en una
      // línea (ej. "N° PERSONAS", "S/. POR HORA" en Mano de Obra), rompiendo
      // la alineación con las otras 4 tablas.
      tableWidth: CONTENT_W,
      styles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: GRIS_CLARO, lineColor: [0, 0, 0], lineWidth: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } },
      // Sin línea entre ítems (top/bottom en 0) para que los sub-ítems de un
      // mismo grupo se vean como un solo bloque — solo quedan las verticales
      // entre columnas y las horizontales de cabecera/pie.
      // cellPadding vertical más chico (default ~1.76mm arriba+abajo) para
      // que las filas de sub-ítems queden más pegadas entre sí.
      bodyStyles: { lineWidth: { top: 0, bottom: 0.1, left: 0.1, right: 0.1 }, cellPadding: { top: 0.8, bottom: 0.8, left: 1.5, right: 1.5 } },
      footStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: [255, 255, 255], lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: ESTILO_COLUMNAS_POR_GRUPO[grupo.clave],
      // El pie solo tiene contenido en las columnas TOTAL/valor (las otras 4
      // van vacías, ver el "foot" de arriba) — que no pidan marco ni relleno
      // para que no quede una caja completa de 6 celdas con 4 en blanco.
      didParseCell: (data) => {
        if (data.section === "foot" && data.column.index < 4) {
          data.cell.styles.lineWidth = 0;
          data.cell.styles.fillColor = false;
        }
        // jspdf-autotable solo aplica columnStyles al body (ver su código
        // fuente: `colStyles = sectionName === 'body' ? columnStyles : {}`),
        // así que el halign:"right" de la columna de valores no llega al
        // pie — hay que pedirlo a mano acá.
        if (data.section === "foot" && data.column.index === 5) {
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

  // ─── Totales ───
  const simboloDoc = cotizacion.moneda === "USD" ? "US$" : "S/";
  const subtotalTotalItems = items.reduce((acc, i) => acc + calcSubtotalGloria(i), 0);
  const totales = calcularGloria(subtotalTotalItems, cotizacion.gastosGeneralesPorcentaje, cotizacion.utilidadPorcentaje);

  y = saltoDePaginaSiHaceFalta(50, y);
  const totW = 90, totX = PAGE_W - M - totW, filaTotH = 7;
  const filasTotales = [
    ["SUB-TOTAL", `${simboloDoc} ${totales.subtotal.toFixed(2)}`, false],
    [`GASTOS GENERALES (${totales.gastosGeneralesPorcentaje}%)`, `${simboloDoc} ${totales.gastosGenerales.toFixed(2)}`, false],
    [`UTILIDAD (${totales.utilidadPorcentaje}%)`, `${simboloDoc} ${totales.utilidad.toFixed(2)}`, false],
    ["TOTAL", `${simboloDoc} ${totales.totalPreIgv.toFixed(2)}`, false],
    ["I.G.V. (18%)", `${simboloDoc} ${totales.igv.toFixed(2)}`, false],
    ["VALOR TOTAL DE LA OFERTA", `${simboloDoc} ${totales.total.toFixed(2)}`, true],
  ];
  filasTotales.forEach(([label, valor, negrita]) => {
    doc.setFillColor(...(negrita ? [173, 193, 229] : [255, 255, 255]));
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

  // ─── Cláusulas a considerar ───
  y = saltoDePaginaSiHaceFalta(50, y);
  const yClausulasBarra = y;
  y = barraSeccion("CLAÚSULAS A CONSIDERAR", y);
  const yClausulasInicio = y;
  doc.setFontSize(8.5);
  const clausula = (label, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(valor || "—", M + 2 + doc.getTextWidth(label), y);
    y += 4.5;
  };
  clausula("TIEMPO DE ENTREGA: ", cotizacion.plazoEntrega);
  clausula("VALIDEZ DE LA OFERTA: ", cotizacion.validezOferta);
  clausula("FORMAS DE PAGO: ", cotizacion.condicionPago);
  clausula("GARANTÍA: ", cotizacion.tiempoGarantia);
  y += 1;
  doc.setFont("helvetica", "bold");
  doc.text("PENALIDAD:", M + 2, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  PENALIDAD_PARRAFOS.forEach((parrafo) => {
    const lineas = doc.splitTextToSize(`- ${parrafo}`, CONTENT_W - 8);
    doc.text(lineas, M + 4, y);
    y += lineas.length * 3.3 + 1;
  });
  doc.setDrawColor(0);
  doc.rect(M, yClausulasBarra, CONTENT_W, (y - yClausulasInicio) + 4 + (yClausulasInicio - yClausulasBarra));
  y += 6;

  // ─── Pie de página: marcas representadas ───
  // if (marcasFooter) {
  //   const h = CONTENT_W * (marcasFooter.naturalHeight / marcasFooter.naturalWidth) * 0.5;
  //   const w = h * (marcasFooter.naturalWidth / marcasFooter.naturalHeight);
  //   y = saltoDePaginaSiHaceFalta(h, y);
  //   doc.addImage(marcasFooter, "PNG", (PAGE_W - w) / 2, y, w, h);
  // }

  doc.save(`Cotización Gloria N° ${cotizacion.numeroCotizacion || cotizacion.codigo}.pdf`);
};
