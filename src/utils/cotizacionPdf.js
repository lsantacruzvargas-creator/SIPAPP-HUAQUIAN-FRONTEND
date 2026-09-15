import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFecha } from "./fecha";
import { numeroALetras } from "./numeroALetras";

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
const NAVY = [0, 0, 40];       // #000028 — barras de sección, banner y placa "COTIZACIÓN"
const AZUL_CLARO = [173, 193, 229]; // #ADC1E5 — fila "VALOR DE LA OFERTA"
const GRIS_CLARO = [232, 232, 232]; // #E8E8E8 — encabezados de tabla

export const HUAQUIAN = {
  razonSocial: "HUAQUIAN S.A.C.",
  ruc: "20601565235",
  direccion: "MZ.A LT1. ASOCIACIÓN VILLA TALAVERA CAMPOY, SAN JUAN DE LURIGANCHO - LIMA.",
  // Código INEI del domicilio fiscal (San Juan de Lurigancho, Lima, Lima) —
  // usado como "Punto de partida" fijo en EmitirGuia.jsx, para no consultar
  // SUNAT por el RUC propio (fijo, siempre el mismo) en cada carga de la página.
  ubigeo: "150132",
  representante: "JOSE LIDER MATEO MUCHA",
  telefono: "966 -757 - 528.",
  correo: "ventas@huaquian.com",
};

// Nombre del PDF descargado, compartido por los 3 formatos (estándar/Gloria/
// "Alicorp") — pedido explícito del usuario, 2026-09-12: "N° cotización -
// año actual - título de cotización". El título es texto libre (puede traer
// "/", ":", etc.) — se sanea a los caracteres inválidos en nombres de
// archivo de Windows antes de armar el `.pdf`.
export function nombreArchivoCotizacionPdf(cotizacion) {
  const numero = cotizacion.numeroCotizacion || cotizacion.codigo || "—";
  const anioActual = new Date().getFullYear();
  const titulo = cotizacion.titulo || "";
  return `${numero} - ${anioActual} - ${titulo}`.replace(/[\\/:*?"<>|]/g, "-").trim() + ".pdf";
}

const BANCOS = {
  bcpCuentaSoles: "191-2364174-0-44",
  bcpCciSoles: "002-19100236417404456",
  bcpCuentaDolares: "191-2559651-1-69",
  bcpCciDolares: "002-191002255965116958",
  bbvaCuentaSoles: "0011-0189-01-00067659",
  bbvaCciSoles: "011-189-0001-0006765981",
  bnCuentaDetraccion: "00-062-084456",
};

const GARANTIA_TEXTO = "En condiciones normales de uso";
const POLIZA_TEXTO = "- Responsabilidad / Seguro complementario de trabajo de riesgo";
// Texto fijo de NUEVO FORMATO DE COTIZACION.xlsx fila 64 — no viene de ningún
// campo del formulario, igual que GARANTIA_TEXTO/POLIZA_TEXTO.
const REPUESTOS_TEXTO = "* La presente cotización no incluye el suministro ni el reemplazo de repuestos. Cualquier componente que requiera sustitución será informado al cliente y su cambio se realizará únicamente previa aprobación y coordinación correspondiente.";

export const exportarCotizacionPdf = async (cotizacion) => {
  const doc = new jsPDF();
  const empresa = cotizacion.empresa;
  const M = 12; // margen
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CONTENT_W = PAGE_W - M * 2;

  // Los logos de bancos (bcp_logo.png/banco_nacion_logo.png) ya no se
  // dibujan en METODO DE PAGO — NUEVO FORMATO DE COTIZACION.xlsx no los
  // trae, solo el texto de las cuentas.
  const [icono, headerBanner, marcasFooter] = await Promise.all([
    cargarImagen("/assets/logos/huaquian_icon.png"),
    cargarImagen("/assets/logos/huaquian_header.png"),
    cargarImagen("/assets/logos/marcas_footer2.png"),
  ]);

  // ─── Marca de agua: ícono + marcas representadas, en TODAS las hojas ───
  // Se dibuja primero en cada página (antes que cualquier otro texto/imagen)
  // para que quede detrás — en PDF cada trazo nuevo se pinta encima del
  // anterior. Se repite en cada página nueva (autoTable vía `didDrawPage`
  // más abajo, y manualmente después de cada `doc.addPage()` propio).
  const dibujarMarcaDeAgua = () => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    if (icono) {
      const wSize = 100;
      doc.addImage(icono, "PNG", 96 - (PAGE_W - wSize) / 2, (PAGE_H - wSize) / 2 - 35, wSize + 40, wSize + 40);
    }
    // marcasFooter YA NO se dibuja acá como marca de agua — es la MISMA
    // imagen que el "Pie de página" (más abajo) dibuja sólida al final del
    // contenido; en cotizaciones cortas ambos caían en la misma zona visible
    // de la página y se veían superpuestos (una copia pálida detrás de la
    // sólida). Reportado por el usuario, 2026-09-15.
    doc.restoreGraphicsState();
  };
  dibujarMarcaDeAgua();

  // ─── Membrete (izquierda) — logo Huaquian + partners autorizados +
  // dirección/contacto + rubro, todo ya integrado en la imagen extraída de
  // NUEVO FORMATO DE COTIZACION.xlsx (reemplaza el banner navy angosto
  // anterior; ya no hace falta redibujar RAZÓN SOCIAL/RUC/DIRECCIÓN/
  // REPRESENTANTE/TELÉFONO/CORREO como texto aparte, viene todo en la imagen).
  // Se escala por ALTO fija (no por ancho completo): el aspect ratio real de
  // esta imagen (1800×600) es mucho más "cuadrado" que el banner viejo
  // (1600×123) — estirarla a los 186mm de CONTENT_W la haría ocupar 62mm de
  // alto, más de lo que el propio Excel le da (columnas A:L, dejando M:O
  // libres para la placa de COTIZACIÓN N°/RUC/fecha en la misma fila).
  let y = 6;
  const membreteH = 42;
  let membreteBottom;
  if (headerBanner) {
    const w = membreteH * (headerBanner.naturalWidth / headerBanner.naturalHeight);
    doc.addImage(headerBanner, "PNG", M, y, w, membreteH);
    membreteBottom = y + membreteH;
  } else {
    doc.setFillColor(...NAVY);
    doc.rect(M, y, CONTENT_W, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("HUAQUIAN", M + 4, y + 9);
    membreteBottom = y + 14;
  }

  // ─── Placa "COTIZACIÓN" (arriba a la derecha, misma fila que el
  // membrete) — un solo marco: barra "COTIZACIÓN" arriba, número debajo
  // centrado, RUC y fecha debajo de eso, todo dentro del mismo borde.
  // Corregido 2026-09-15 a pedido del usuario: antes N°/RUC/fecha quedaban
  // repartidos en dos bloques sueltos (uno al lado, otro debajo sin marco);
  // debe verse exactamente como NUEVO FORMATO DE COTIZACION.xlsx.
  y += 6;
  const boxW = 48, barH = 7, boxX = PAGE_W - M - boxW;
  const fechaStr = cotizacion.fecha ? formatearFecha(cotizacion.fecha) : "—";
  const boxCenter = boxX + boxW / 2;

  doc.setFillColor(...NAVY);
  doc.rect(boxX, y, boxW, barH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COTIZACIÓN", boxCenter, y + barH / 2 + 1.3, { align: "center" });
  doc.setTextColor(0, 0, 0);

  let yBox = y + barH + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(String(cotizacion.numeroCotizacion || cotizacion.codigo || "—"), boxCenter, yBox, { align: "center" });
  yBox += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(HUAQUIAN.ruc, boxCenter, yBox, { align: "center" });
  yBox += 4.5;
  doc.text(fechaStr, boxCenter, yBox, { align: "center" });
  yBox += 3;

  doc.setDrawColor(0);
  doc.rect(boxX, y, boxW, yBox - y);

  y = Math.max(membreteBottom, yBox) + 4;

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

  // ─── Barra de sección navy — `w` angosta cuando comparte fila con la
  // tarjeta del asesor comercial (ver METODO DE PAGO / CONDICIONES GENERALES).
  const barraSeccion = (titulo, yy, h = 6, w = CONTENT_W) => {
    doc.setFillColor(...NAVY);
    doc.rect(M, yy, w, h, "F");
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
  // yClIzq += labelValor(M, yClIzq, "ÁREA: ", cotizacion.area, clienteColW) * 4.2;
  yClIzq += labelValor(M, yClIzq, "OM / AVISO: ", cotizacion.omAviso, clienteColW) * 4.2;
  yClIzq += labelValor(M, yClIzq, "N° DE GUIA: ", cotizacion.numeroGuia, clienteColW) * 4.2;
  const xClDer = M + clienteColW + 4;
  yClDer += labelValor(xClDer, yClDer, "JEFE / SUPERVISOR SOLICITANTE: ", cotizacion.jefeSupervisorSolicitante, clienteColW) * 4.2;
  yClDer += labelValor(xClDer, yClDer, "COMPRADOR RESPONSABLE: ", cotizacion.compradorResponsable, clienteColW) * 4.2;
  // No es un input del form — sale del contacto de empresa ya seleccionado
  // (ver correoContacto en DetalleCotizacion.jsx:datosParaPdf), igual que
  // el teléfono que ya se ve junto al selector de contacto.
  yClDer += labelValor(xClDer, yClDer, "CORREO: ", cotizacion.correoContacto, clienteColW) * 4.2;
  // yClDer += labelValor(xClDer, yClDer, "N° DE SOLICITUD DE PEDIDO: ", cotizacion.numeroSolicitudPedido, clienteColW) * 4.2;
  // yClDer += labelValor(xClDer, yClDer, "N° DE PETICIÓN DE OFERTA: ", cotizacion.numeroPeticionOferta, clienteColW) * 4.2;
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

  // Un ítem = una fila; sus sub-ítems (si tiene) van DENTRO de la misma
  // celda de Descripción, como líneas en bullet debajo del texto padre (no
  // como filas propias) — mismo patrón que el proyecto Alcoinsac
  // (Frontend/src/utils/cotizacionPdf.js): autoTable no soporta estilos
  // mixtos dentro de una celda, así que la celda completa se dibuja primero
  // en peso normal (padre + bullets con "\n"), y en `didDrawCell` se tapa
  // con un rectángulo blanco solo la franja del texto padre para
  // redibujarla en negrita encima — ver receta #1/#2 del skill
  // pdf-cotizacion-recetas (el alto de línea real sale de lo que autoTable
  // ya calculó para esa celda, `doc.getLineHeight()` no coincide).
  autoTable(doc, {
    startY: y,
    head: [["ITEM", "DESCRIPCIÓN", "UNID.", "CANT.", "PRECIO UNITARIO", "PRECIO TOTAL"]],
    body: cotizacion.items.map((item, i) => {
      const precioNum = Number(item.precio) || 0;
      const subtotalNum = Number(item.subtotal) || 0;
      const esInformativo = precioNum === 0;
      let desc = item.descripcion;
      if (item.subItems?.length > 0) {
        desc += "\n" + item.subItems.map((s) => `   • ${s}`).join("\n");
      }
      return [
        esInformativo ? "" : i + 1,
        desc,
        esInformativo ? "" : (item.unidad || "und"),
        esInformativo ? "" : item.cantidad,
        esInformativo ? "" : precioNum.toFixed(2),
        subtotalNum === 0 ? "" : subtotalNum.toFixed(2),
      ];
    }),
    theme: "grid",
    margin: { left: M, right: M },
    styles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fontSize: 8, fontStyle: "bold", textColor: [0, 0, 0], fillColor: GRIS_CLARO, lineColor: [0, 0, 0], lineWidth: 0.1, halign: "center" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
    },
    didDrawPage: dibujarMarcaDeAgua,
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const item = cotizacion.items[data.row.index];
      if (!item) return;
      const { cell } = data;
      doc.setFontSize(cell.styles.fontSize);
      const maxWidth = cell.width - cell.padding("left") - cell.padding("right");
      const lineasPadre = doc.splitTextToSize(item.descripcion, maxWidth);

      const totalLineas = Array.isArray(cell.text) && cell.text.length > 0 ? cell.text.length : lineasPadre.length;
      const padTop = cell.padding("top");
      const padBottom = cell.padding("bottom");
      const alturaInterior = cell.height - padTop - padBottom;
      const lineHeight = alturaInterior / totalLineas;
      const bandHeight = lineasPadre.length * lineHeight;

      doc.setFillColor(255, 255, 255);
      doc.rect(cell.x + 0.3, cell.y + padTop - 0.2, cell.width - 0.6, bandHeight + 0.2, "F");

      const x = cell.x + cell.padding("left");
      let ly = cell.y + padTop + lineHeight * 0.75;
      doc.setFont("helvetica", "bold");
      lineasPadre.forEach((linea) => { doc.text(linea, x, ly); ly += lineHeight; });
      doc.setFont("helvetica", "normal");
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ─── "SON: <monto en letras>" — pedido explícito del usuario, 2026-09-15:
  // se autocompleta desde el total/moneda, NO es un input del formulario
  // (ver NUEVO FORMATO DE COTIZACION.xlsx fila 42, "SON: XXXXXXXXX").
  if (y + 12 > PAGE_H - 15) { doc.addPage(); dibujarMarcaDeAgua(); y = 15; }
  const totW = 80, totX = PAGE_W - M - totW;
  const sonLabel = "SON: ";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const sonLabelW = doc.getTextWidth(sonLabel);
  doc.text(sonLabel, M, y);
  doc.setFont("helvetica", "normal");
  const sonTexto = numeroALetras(Number(cotizacion.total) || 0, cotizacion.moneda === "USD" ? "USD" : "PEN");
  // const sonAnchoDisponible = totX - 4 - (M + sonLabelW);
    const sonAnchoDisponible = 150;

  const sonLineas = doc.splitTextToSize(sonTexto, sonAnchoDisponible);
  doc.text(sonLineas, M + sonLabelW, y);
  y += sonLineas.length * 4.2 + 4;

  // ─── Totales (VALOR DE LA OFERTA / I.G.V. / VALOR TOTAL) ───
  if (y + 24 > PAGE_H - 15) { doc.addPage(); dibujarMarcaDeAgua(); y = 15; }
  const filaTotH = 7;
  // El descuento global (sobre la suma de subtotales, antes del IGV) solo
  // se muestra si se aplicó — ver mismo cálculo en DetalleCotizacion.jsx.
  const descuentoPct = Number(cotizacion.descuentoPorcentaje) || 0;
  // Se deriva del subtotal en vez de depender de un campo `descuento` aparte
  // — no todos los que llaman a esta función lo mandan (ej. la cotización
  // recién guardada del backend solo trae `descuentoPorcentaje`).
  const descuentoMonto = (Number(cotizacion.subtotal) || 0) * (descuentoPct / 100);
  // SUBTOTAL = VALOR DE LA OFERTA - DESCUENTO — fila nueva pedida por el
  // usuario, 2026-09-15, solo de presentación (el IGV ya se calculaba sobre
  // este mismo monto, ver totalesMostrados en DetalleCotizacion.jsx).
  const subtotalNeto = (Number(cotizacion.subtotal) || 0) - descuentoMonto;
  const totales = [
    ["VALOR DE LA OFERTA", `${simboloDoc} ${Number(cotizacion.subtotal).toFixed(2)}`, AZUL_CLARO, false],
    ...(descuentoPct > 0 ? [
      [`DESCUENTO (${descuentoPct}%)`, `- ${simboloDoc} ${descuentoMonto.toFixed(2)}`, [255, 255, 255], false],
    ] : []),
    ["SUBTOTAL", `${simboloDoc} ${subtotalNeto.toFixed(2)}`, [255, 255, 255], false],
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

  // ─── METODO DE PAGO + CONDICIONES GENERALES (columna izquierda) con la
  // tarjeta del Asesor Comercial a la derecha, abarcando ambas secciones —
  // layout de NUEVO FORMATO DE COTIZACION.xlsx (METODO DE PAGO fila 51,
  // CONDICIONES GENERALES fila 58, tarjeta de asesor merge L56:O61).
  if (y + 95 > PAGE_H - 15) { doc.addPage(); dibujarMarcaDeAgua(); y = 15; }
  const yBloqueInicio = y;
  const asesorW = 44, asesorX = PAGE_W - M - asesorW;
  const colPagoW = CONTENT_W - asesorW - 4 - 33;

  // METODO DE PAGO — cuenta + CCI del mismo banco en UNA sola línea (como
  // NUEVO FORMATO DE COTIZACION.xlsx filas 52-56: "CTA CTE BCP SOLES : ...
  // CCI : ..."), con el mismo estilo (bold+normal, 8.5pt) que CONDICIONES
  // GENERALES en vez del 8pt/dos líneas de antes. Pedido explícito del
  // usuario, 2026-09-15.
  const yPagoBarra = y;
  y = barraSeccion("METODO DE PAGO", y, 6, colPagoW);
  const yPagoInicio = y;
  y += 1;
  doc.setFontSize(7);
  const lineaPago = (label, valor, ciCi) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M + 2, y);
    doc.setFont("helvetica", "normal");
    let x = M + 2 + doc.getTextWidth(label);
    doc.text(valor, x, y);
    if (ciCi) {
      x += doc.getTextWidth(valor) + 6;
      doc.setFont("helvetica", "bold");
      doc.text("CCI : ", x, y);
      doc.setFont("helvetica", "normal");
      doc.text(ciCi, x + doc.getTextWidth("CCI : "), y);
    }
    y += 4.2;
  };
  lineaPago("CTA CTE BCP SOLES : ", BANCOS.bcpCuentaSoles, BANCOS.bcpCciSoles);
  lineaPago("CTA CTE BCP DOLARES :  ", BANCOS.bcpCuentaDolares, BANCOS.bcpCciDolares);
  lineaPago("CTA CTE BBVA SOLES :  ", BANCOS.bbvaCuentaSoles, BANCOS.bbvaCciSoles);
  y += 1;
  lineaPago("CUENTA DETRACCION : ", BANCOS.bnCuentaDetraccion);
  doc.setFont("helvetica", "bold");
  doc.text("A nombre de : ", M + 2 + doc.getTextWidth("CUENTA DETRACCION : ") + doc.getTextWidth(BANCOS.bnCuentaDetraccion) + 6, y - 4.2);
  doc.setFont("helvetica", "normal");
  const xANombre = M + 2 + doc.getTextWidth("CUENTA DETRACCION :  ") + doc.getTextWidth(BANCOS.bnCuentaDetraccion) + 6 + doc.getTextWidth("A nombre de : ");
  doc.text("HUAQUIAN S.A.C", xANombre + 2, y - 4.2);
  doc.setDrawColor(0);
  doc.rect(M, yPagoBarra, colPagoW , (y - yPagoInicio)  + (yPagoInicio - yPagoBarra)-2);
  y += 6;

  // CONDICIONES GENERALES (antes "TERMINOS Y CONDICIONES") — renombrada y
  // reorganizada en pares para calzar con el nuevo formato.
  const yCondBarra = y;
  y = barraSeccion("CONDICIONES GENERALES", y, 6, colPagoW);
  const yCondInicio = y;
  doc.setFontSize(8.5);
  const mitadCond = (colPagoW - 4) / 2;
  const xCondDer = M + mitadCond + 4;
  const parLabelValor = (x, yy, label, valor, maxW) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const w = doc.getTextWidth(label);
    doc.text(label, x, yy);
    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(valor || "—", maxW - w);
    doc.text(lineas, x + w, yy);
    return lineas.length;
  };
  let yCondIzq = y, yCondDer = y;
  yCondIzq += parLabelValor(M + 2, yCondIzq, "TIEMPO DE ENTREGA: ", cotizacion.plazoEntrega, mitadCond) * 4.2;
  yCondDer += parLabelValor(xCondDer, yCondDer, "GARANTÍA: ", GARANTIA_TEXTO, mitadCond) * 4.2;
  yCondIzq += parLabelValor(M + 2, yCondIzq, "VALIDEZ DE LA OFERTA: ", cotizacion.validezOferta, mitadCond) * 4.2;
  yCondDer += parLabelValor(xCondDer, yCondDer, "TIEMPO DE GARANTIA: ", cotizacion.tiempoGarantia, mitadCond) * 4.2;


  yCondIzq += parLabelValor(M + 2, yCondIzq, "FORMA DE PAGO: ", cotizacion.condicionPago, mitadCond) * 4.2;
  y = Math.max(yCondIzq, yCondDer) + 1;
  // y += parLabelValor(M + 2, y, "FORMA DE PAGO: ", cotizacion.condicionPago, colPagoW - 4) * 4.2;
  // doc.setFont("helvetica", "bold");
  // doc.text("POLIZAS DE GARANTÍA: ", M + 2, y); y += 4.2;
  // doc.setFont("helvetica", "normal");
  // doc.text(POLIZA_TEXTO, M + 2, y); y += 4.2;
  doc.setFont("helvetica", "bold");
  doc.text("OBSERVACIONES:", M + 2, y); y += 4.2;
  doc.setFont("helvetica", "normal");
  doc.text("* El valor total de la oferta INCLUYE IGV", M + 2, y); y += 4.2;
  const repuestosLineas = doc.splitTextToSize(REPUESTOS_TEXTO, colPagoW - 4);
  doc.text(repuestosLineas, M + 2, y); y += repuestosLineas.length * 4.2;
  y += 2;
  doc.setDrawColor(0);
  doc.rect(M, yCondBarra, colPagoW, (y - yCondInicio) + 2 + (yCondInicio - yCondBarra)- 8);

  // Tarjeta del Asesor Comercial — a la derecha. El marco se ajusta a su
  // propio contenido (no se estira a la altura completa de METODO DE PAGO +
  // CONDICIONES GENERALES, que es más alta) y queda centrada verticalmente
  // dentro de ese bloque — antes el marco quedaba enorme con mucho espacio
  // vacío abajo. Corregido 2026-09-15 a pedido del usuario.
  const yBloqueFin = y;
  const asesorCenter = asesorX + asesorW / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const asesorNombreLineas = doc.splitTextToSize(cotizacion.asesorComercial || "—", asesorW - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const correoAsesorLineas = doc.splitTextToSize(HUAQUIAN.correo, asesorW - 4);

  const padVert = 5, rolH = 5.5, celularH = 4;
  const nombreH = asesorNombreLineas.length * 4;
  const correoH = correoAsesorLineas.length * 3.4;
  const asesorH = padVert * 2 + nombreH + 1 + rolH + correoH + 1 + celularH;
  const asesorY = yBloqueInicio + Math.max(0, (yBloqueFin - yBloqueInicio - asesorH) / 2);

  doc.setDrawColor(0);
  doc.rect(asesorX, asesorY, asesorW, asesorH);

  let yAs = asesorY + padVert + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(asesorNombreLineas, asesorCenter, yAs, { align: "center" });
  yAs += nombreH + 1;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("Asesor Comercial", asesorCenter, yAs, { align: "center" });
  yAs += rolH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(correoAsesorLineas, asesorCenter, yAs, { align: "center" });
  yAs += correoH + 1;
  doc.text(cotizacion.numeroCelular || "—", asesorCenter, yAs, { align: "center" });

  y = yBloqueFin + 6;

  // ─── Pie de página: grid de marcas representadas ───
  if (marcasFooter) {
    const h = CONTENT_W * (marcasFooter.naturalHeight / marcasFooter.naturalWidth) * 1.05;
    const w = h * (marcasFooter.naturalWidth / marcasFooter.naturalHeight);
    if (y + h > PAGE_H - 6) { doc.addPage(); dibujarMarcaDeAgua(); y = 15; }
    doc.addImage(marcasFooter, "PNG", (PAGE_W - w) / 2, y, w, h);
    // doc.addImage(marcasFooter, "PNG", 15, y, 180, 70);

  }

  doc.save(nombreArchivoCotizacionPdf(cotizacion));
};
