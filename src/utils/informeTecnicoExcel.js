import ExcelJS from "exceljs";
import JSZip from "jszip";
import { tipoInformePorValor, claveChecklist } from "./informesTecnicos";
import { fetchUpload } from "./fetchAuth";
import { formatearFecha } from "./fecha";

// exceljs solo puede incrustar estos 3 formatos — si la foto subida es de
// otro tipo (ej. webp/heic) se omite del Excel (sigue disponible en la app).
const EXTENSION_SOPORTADA = (ruta) => {
  const ext = (ruta.split(".").pop() || "").toLowerCase();
  if (ext === "jpg") return "jpeg";
  if (["jpeg", "png", "gif"].includes(ext)) return ext;
  return null;
};

// Ancho/alto real en píxeles de la foto (para insertarla en el Excel con su
// tamaño original en vez de estirarla a una celda o forzarla a un tamaño
// fijo) — se decodifica vía <img>, igual que cargarImagen() en los exports
// de PDF, en vez de parsear los bytes del header PNG/JPEG a mano.
const dimensionesImagen = (buffer, extension) =>
  new Promise((resolve) => {
    const blob = new Blob([buffer], { type: `image/${extension}` });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

// Comprime/redimensiona cada foto justo antes de insertarla en el Excel —
// las fotos de celular vienen a menudo en 3-8MB c/u, y con 10-20 fotos por
// informe el .xlsx resultante se vuelve pesadísimo para descargar (pedido
// explícito del usuario, 2026-09-03). Solo afecta la copia que se pega en
// ESTE Excel puntual — el archivo guardado en el servidor (fetchUpload)
// nunca se toca, sigue disponible a resolución original para ver/hacer zoom
// en la app. Se reescala (nunca se agranda) al lado más largo, se recodifica
// siempre como JPEG a calidad 0.75 vía canvas (mismo patrón que
// dimensionesImagen/cargarImagen en los exports de PDF) — un fondo blanco
// evita que un PNG con transparencia salga negro al perder el canal alfa.
// Si falla la decodificación (formato raro, buffer corrupto), cae al buffer
// original sin comprimir en vez de perder la foto.
const MAX_LADO_FOTO_EXCEL = 1600;
const CALIDAD_JPEG_EXCEL = 0.75;
const comprimirImagenParaExcel = (buffer, extension) =>
  new Promise((resolve) => {
    const blob = new Blob([buffer], { type: `image/${extension}` });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, MAX_LADO_FOTO_EXCEL / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * escala));
      const h = Math.max(1, Math.round(img.naturalHeight * escala));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blobComprimido) => {
          if (!blobComprimido) { resolve(null); return; }
          blobComprimido.arrayBuffer().then((buf) => resolve({ buffer: buf, extension: "jpeg" }));
        },
        "image/jpeg",
        CALIDAD_JPEG_EXCEL
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

// exceljs pierde varios metadatos de la hoja al recargar y regrabar el
// archivo, todos ajenos a los datos del informe (nunca cambian entre
// exportaciones de la misma plantilla), así que se restauran byte a byte
// desde la plantilla original después de que exceljs termina de escribir
// el buffer:
//
// 1. <rowBreaks> — saltos de página MANUALES que alinean el corte de
//    impresión con las bandas repetidas de encabezado/evidencias de cada
//    "página" dentro de la hoja continua. exceljs ni siquiera los LEE al
//    cargar el archivo (ws.rowBreaks queda [] vacío), así que se pierden
//    siempre. Sin esto, Excel repagina automático según el escalado, y el
//    corte entre páginas queda desalineado — el contenido de una página
//    se "cuela" visualmente en la siguiente (reportado por el usuario en
//    "INFORME TECNICO DE MANTENIMIENTO": la página 2 mostraba parte de la
//    página 3).
// 2. <pageSetup> — exceljs regrabа este elemento con fitToWidth/
//    fitToHeight inventados (no estaban en el original) y sin el r:id de
//    printerSettings, cambiando cómo se escala/pagina la impresión. Se
//    reemplaza por el original completo (sin ese r:id — tampoco se
//    restaura el archivo de printerSettings, así que dejarlo apuntando a
//    él sería una referencia colgante).
// 3. Imagen de header/footer (marca de agua / logo) — exceljs descarta el
//    dibujo VML legado que la contiene, su relación <legacyDrawingHF> y el
//    elemento <headerFooter> entero (con el código &G que le dice a Excel
//    "acá va la imagen"). El vmlDrawing correcto se identifica siguiendo
//    la relación real <legacyDrawingHF r:id="X"> → rels de la hoja, no
//    adivinando por nombre de archivo — las plantillas pueden tener más
//    de un vmlDrawing (uno para comentarios de celda, otro para el
//    header/footer). Si el header/footer no tiene el código &G en ningún
//    lado (el elemento no existe, o existe vacío — ej. <headerFooter
//    scaleWithDoc="0"/>, que quedó así en varias plantillas después de
//    que el usuario sacó las imágenes de ahí y las puso como dibujos
//    normales), no hay nada que restaurar acá.
async function restaurarMetadatosDePagina(bufferPlantillaOriginal, bufferExportado) {
  const zipOriginal = await JSZip.loadAsync(bufferPlantillaOriginal);
  const sheetPathOriginal = Object.keys(zipOriginal.files).find((f) => /^xl\/worksheets\/sheet\d*\.xml$/.test(f));
  const sheetXmlOriginal = await zipOriginal.files[sheetPathOriginal].async("string");

  const zipSalida = await JSZip.loadAsync(bufferExportado);
  const sheetPath = Object.keys(zipSalida.files).find((f) => /^xl\/worksheets\/sheet\d*\.xml$/.test(f));
  const sheetRelsPath = sheetPath.replace("worksheets/", "worksheets/_rels/") + ".rels";

  let sheetXml = await zipSalida.files[sheetPath].async("string");
  let sheetRelsXml = zipSalida.files[sheetRelsPath]
    ? await zipSalida.files[sheetRelsPath].async("string")
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  // --- 1) pageSetup: reemplazo directo (mismo elemento, ya existe en la
  // salida de exceljs, solo hay que corregir sus atributos).
  let pageSetupOriginal = sheetXmlOriginal.match(/<pageSetup[^/]*\/>/)?.[0] || "";
  pageSetupOriginal = pageSetupOriginal.replace(/\s+r:id="rId\d+"/, "");
  if (pageSetupOriginal && sheetXml.match(/<pageSetup[^/]*\/>/)) {
    sheetXml = sheetXml.replace(/<pageSetup[^/]*\/>/, pageSetupOriginal);
  }

  // --- 2) headerFooter (imagen de marca de agua/logo), si sigue activa.
  const headerFooterXml = sheetXmlOriginal.match(/<headerFooter[\s\S]*?(?:\/>|<\/headerFooter>)/)?.[0] || "";
  const hayMarcaDeAgua = headerFooterXml.includes("&amp;G");
  // El orden de esquema de OOXML exige headerFooter después de pageSetup (o
  // pageMargins si no hay pageSetup) y antes de rowBreaks/drawing —
  // insertarlo en cualquier otro lugar deja el archivo inválido.
  if (hayMarcaDeAgua) {
    if (sheetXml.match(/<pageSetup[^/]*\/>/)) {
      sheetXml = sheetXml.replace(/(<pageSetup[^/]*\/>)/, `$1${headerFooterXml}`);
    } else if (sheetXml.match(/<pageMargins[^/]*\/>/)) {
      sheetXml = sheetXml.replace(/(<pageMargins[^/]*\/>)/, `$1${headerFooterXml}`);
    } else if (sheetXml.match(/<drawing r:id="[^"]*"\/>/)) {
      sheetXml = sheetXml.replace(/(<drawing r:id="[^"]*"\/>)/, `${headerFooterXml}$1`);
    } else {
      sheetXml = sheetXml.replace("</worksheet>", `${headerFooterXml}</worksheet>`);
    }
  }

  // --- 3) rowBreaks: va después de headerFooter si se acaba de insertar,
  // si no después de pageSetup/pageMargins, si no antes de drawing.
  const rowBreaksXml = sheetXmlOriginal.match(/<rowBreaks[\s\S]*?<\/rowBreaks>/)?.[0] || "";
  if (rowBreaksXml) {
    if (hayMarcaDeAgua && sheetXml.includes(headerFooterXml)) {
      sheetXml = sheetXml.replace(headerFooterXml, `${headerFooterXml}${rowBreaksXml}`);
    } else if (sheetXml.match(/<pageSetup[^/]*\/>/)) {
      sheetXml = sheetXml.replace(/(<pageSetup[^/]*\/>)/, `$1${rowBreaksXml}`);
    } else if (sheetXml.match(/<pageMargins[^/]*\/>/)) {
      sheetXml = sheetXml.replace(/(<pageMargins[^/]*\/>)/, `$1${rowBreaksXml}`);
    } else if (sheetXml.match(/<drawing r:id="[^"]*"\/>/)) {
      sheetXml = sheetXml.replace(/(<drawing r:id="[^"]*"\/>)/, `${rowBreaksXml}$1`);
    } else {
      sheetXml = sheetXml.replace("</worksheet>", `${rowBreaksXml}</worksheet>`);
    }
  }

  // --- 4) vmlDrawing + legacyDrawingHF de la marca de agua/logo, si aplica.
  if (hayMarcaDeAgua) {
    const relIdOriginal = sheetXmlOriginal.match(/<legacyDrawingHF r:id="(rId\d+)"/)?.[1];
    const sheetRelsPathOriginal = sheetPathOriginal.replace("worksheets/", "worksheets/_rels/") + ".rels";
    const sheetRelsXmlOriginal = relIdOriginal && zipOriginal.files[sheetRelsPathOriginal]
      ? await zipOriginal.files[sheetRelsPathOriginal].async("string")
      : "";
    const vmlPath = relIdOriginal
      ? sheetRelsXmlOriginal.match(new RegExp(`Id="${relIdOriginal}"[^>]*Target="([^"]+)"`))?.[1]
      : null;
    const vmlPathAbsoluto = vmlPath ? new URL(vmlPath, "http://x/xl/worksheets/").pathname.replace(/^\//, "") : null;

    if (vmlPathAbsoluto && zipOriginal.files[vmlPathAbsoluto]) {
      const vmlRelsPath = `xl/drawings/_rels/${vmlPathAbsoluto.split("/").pop()}.rels`;
      const vmlContent = await zipOriginal.files[vmlPathAbsoluto].async("uint8array");
      const vmlRelsContent = zipOriginal.files[vmlRelsPath] ? await zipOriginal.files[vmlRelsPath].async("uint8array") : null;

      const idsUsados = [...sheetRelsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
      const nuevoId = `rId${(idsUsados.length ? Math.max(...idsUsados) : 0) + 1}`;

      const vmlFileName = vmlPathAbsoluto.split("/").pop();
      sheetRelsXml = sheetRelsXml.replace(
        "</Relationships>",
        `<Relationship Id="${nuevoId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/${vmlFileName}"/></Relationships>`
      );

      if (sheetXml.includes("<legacyDrawingHF")) {
        sheetXml = sheetXml.replace(/<legacyDrawingHF[^/]*\/>/, `<legacyDrawingHF r:id="${nuevoId}"/>`);
      } else if (sheetXml.match(/<drawing r:id="[^"]*"\/>/)) {
        sheetXml = sheetXml.replace(/(<drawing r:id="[^"]*"\/>)/, `$1<legacyDrawingHF r:id="${nuevoId}"/>`);
      } else {
        sheetXml = sheetXml.replace("</worksheet>", `<legacyDrawingHF r:id="${nuevoId}"/></worksheet>`);
      }

      zipSalida.file(vmlPathAbsoluto, vmlContent);
      if (vmlRelsContent) zipSalida.file(vmlRelsPath, vmlRelsContent);
    }
  }

  zipSalida.file(sheetPath, sheetXml);
  zipSalida.file(sheetRelsPath, sheetRelsXml);

  return zipSalida.generateAsync({ type: "arraybuffer" });
}

// Se intentó restaurar el logo de "INFORME SUMINISTRO.xlsx" (vive como
// "imagen dentro de la celda" / Rich Value Data Types en A3 — celda t="e"
// vm="N" que exceljs descarta al regrabar el archivo, ver investigación en
// [[huaquian-phases-progress]] Fase 21) copiando xl/metadata.xml +
// xl/richData/ de vuelta y reinyectando `vm` en la celda. El archivo
// resultante disparaba el diálogo de reparación de Excel — corrupción real,
// peor que el logo faltante — así que se revirtió. Pendiente de retomar con
// más cuidado (o de decidir que no vale la pena, dado el riesgo de
// corromper el archivo para algo puramente decorativo).

// Direcciones de celda de las 13 plantillas nuevas de
// Frontend/public/informes-templates/ (reemplazo completo del set anterior
// de 5 tipos — ver Backend/src/models/InformeTecnico.js). Mapeadas leyendo
// cada plantilla real con exceljs (celdas + merges) y verificadas de forma
// programática contra los archivos reales: un script cargó cada .xlsx y
// confirmó que cada celda mapeada cae dentro de la sección correcta (no
// sobre un rótulo/encabezado impreso). El bloque "Datos generales"
// (encabezado), "Datos del equipo" y el checklist principal de cada tipo
// tienen alta confianza. Quedan sin mapear a propósito — y por lo tanto
// caen al bloque "DATOS CAPTURADOS" anexado más abajo, nunca se pierden —
// los campos secundarios que no se pudieron ubicar con certeza sin abrir
// el archivo en Excel (algunas tablas de medición y el protocolo de
// prueba de arrancador/variador/ups), y prácticamente todo el checklist de
// "servomotor" (la plantilla más grande, ~90 ítems — solo se mapeó el
// encabezado y los datos del equipo).
// Un campo/ítem/celda que no aparece acá simplemente no tiene posición
// conocida en la plantilla — su valor igual se garantiza en el bloque
// "DATOS CAPTURADOS" que se anexa más abajo.
// Encabezado "INFORME DE SERVICIO" (D3..D11) — idéntico en las 9 columnas
// D..I de las 13 plantillas nuevas (Frontend/public/informes-templates/),
// solo cambia el ancho de página (algunas llegan a F, otras a I) pero la
// celda de INICIO de cada campo es siempre la misma. `categoria` (celda
// C9/D9) en varias plantillas trae impreso un valor fijo ("VARIADORES",
// "PANEL"...) — si el técnico no lo toca, `escribir()` no sobrescribe la
// celda (ignora valores vacíos) y ese texto impreso queda tal cual.
const CAMPOS_ENCABEZADO_SERVICIO = {
  empresa: "D3", contacto: "D4", ordenCompra: "D5", cot: "D6",
  lineaArea: "D7", descripcion: "D8", categoria: "D9", cantidad: "D10", fecha: "D11",
};
const CAMPOS_ENCABEZADO_SOPORTE = { ...CAMPOS_ENCABEZADO_SERVICIO, fechaInicio: "D11", fechaTermino: "D12" };
delete CAMPOS_ENCABEZADO_SOPORTE.fecha;

// "DATOS DEL EQUIPO" — layout de 9 columnas (C..I) que se repite igual en
// tarjetas/pc/panel/adicional/plc/arrancador/variador_reparacion/ups. La
// fila 14 trae los RÓTULOS (EQUIPO/MARCA, MODELO, CODIGO, TAG, POTENCIA,
// S/N) — el dato en sí va en la fila 15, justo debajo (confirmado
// programáticamente: la primera versión de este mapeo apuntaba a la fila
// 14 por error y el script de verificación encontró el texto del rótulo
// en vez de una celda vacía).
const CAMPOS_EQUIPO_9COL = {
  equipoMarca: "C15", modelo: "D15", codigo: "E15", tag: "G15", potencia: "H15", serie: "I15",
  observacionIngreso: "E16",
};

// "Protocolo de prueba inicial / final" (arrancador, variador_reparacion,
// ups, servomotor) — confirmado celda por celda contra las 4 plantillas
// reales: los 13 (o 12, servomotor) valores van uno por fila, columna B
// (inicial) / G (final) — filas 19..31, cada una su propia celda (o su
// propio merge de altura fija en servomotor, ver abajo). "Observación" es
// una celda aparte merge A33:B33 (inicial) / F33:G33 (final). "Prueba de
// equipo" es un cuadro de texto libre grande, merge C19:D31 (inicial) /
// H19:I31 (final) — con exceljs basta escribir en la celda "master" del
// merge (la esquina superior-izquierda: C19/H19), escribir en cualquier
// otra celda del rango no tiene efecto.
// servomotor: "CORRIENTE DE MEDIDA DE FASES" se ve impreso en 2 filas (26 y
// 27) pero es UN solo campo — B26:B27/G26:G27 están fusionadas 2 filas de
// alto (igual A26:A27/F26:F27 del lado del rótulo), no son 2 valores
// separados. Se mapea a la celda master B26/G26 igual que cualquier otro
// merge de este archivo.
const filaProtocolo = (n) => 19 + n; // n=0 -> fila 19, n=12 -> fila 31
const CAMPOS_PROTOCOLO_ESTANDAR = (() => {
  const items = [
    "Encendido", "Backup", "Temperatura", "Ventilador", "TiempoPrueba", "CorrienteSalida",
    "CorrienteSoftware", "VoltajeSalida", "VoltajeSoftware", "MedicionBusDc", "MedicionLineaTierra",
    "ProtocoloComunicacion", "IdProtocolo",
  ];
  const campos = {};
  items.forEach((sufijo, i) => {
    campos[`protoInicial${sufijo}`] = `B${filaProtocolo(i)}`;
    campos[`protoFinal${sufijo}`] = `G${filaProtocolo(i)}`;
  });
  campos.protoInicialObservacion = "A33"; campos.protoFinalObservacion = "F33";
  return campos;
})();
// "PRUEBA DE EQUIPO INICIAL/FINAL" es un recuadro de foto (merge C19:D31 /
// H19:I31), no texto — ver EVIDENCIAS_PRUEBA_EQUIPO en informesTecnicos.js
// y SLOTS_FOTOS.<tipo> más abajo.
const RANGOS_PRUEBA_EQUIPO = { protoInicialPrueba: "C19:D31", protoFinalPrueba: "H19:I31" };
// Re-mapeado completo (2026-09-03): la plantilla real ya no trae el bloque de
// encabezado — todo el contenido subió 8 filas (confirmado celda por celda
// contra la plantilla real, mismo offset que el resto de tipos remapeados
// hoy).
const CAMPOS_PROTOCOLO_SERVOMOTOR = {
  protoInicialEncendido: "B11", protoInicialTemperatura: "B12", protoInicialVentilador: "B13", protoInicialTiempoPrueba: "B14",
  protoInicialTensionAc: "B15", protoInicialVelocidadRpm: "B16", protoInicialVibracion: "B17", protoInicialCorrienteFases: "B18",
  protoInicialCorrienteLu: "B20", protoInicialCorrienteLv: "B21", protoInicialCorrienteLw: "B22", protoInicialMedicionPolos: "B23",
  protoInicialObservacion: "A25",
  protoFinalEncendido: "G11", protoFinalTemperatura: "G12", protoFinalVentilador: "G13", protoFinalTiempoPrueba: "G14",
  protoFinalTensionAc: "G15", protoFinalVelocidadRpm: "G16", protoFinalVibracion: "G17", protoFinalCorrienteFases: "G18",
  protoFinalCorrienteLu: "G20", protoFinalCorrienteLv: "G21", protoFinalCorrienteLw: "G22", protoFinalMedicionPolos: "G23",
  protoFinalObservacion: "F25",
};

const MAPEOS = {
  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT). El recuadro
  // de foto subió con el resto del contenido y ahora es mucho más alto (el
  // hueco libre entre la fila 8 y el rótulo "VISTA FRONTAL COMPONENTE" en
  // la fila 36, igual patrón que "adicional" — rótulo DEBAJO del recuadro,
  // no encima como en las demás plantillas).
  suministro: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", potenciaComponente: "E7", cantidadComponente: "F7",
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: {
          item1: "F39", item2: "F40", item3: "F41", item4: "F42", item5: "F43", item6: "F44", item7: "F45",
        },
      },
    },
    bullets: { recomendaciones: { col: "A", fila: 47, max: 5 } },
  },

  soporte: {
    campos: {
      ...CAMPOS_ENCABEZADO_SOPORTE,
      tablero: "C14", marca: "C15", modelo: "C16", serie: "C17", codigo: "C18",
      potencia: "C19", entrada: "C20", salida: "C21",
    },
    bullets: {
      observacion: { col: "A", fila: 40, max: 4 },
      conclusion: { col: "A", fila: 45, max: 4 },
      recomendacion: { col: "A", fila: 50, max: 4 },
    },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT). "Datos del
  // equipo" usa fila 7 (Equipo/Marca y Modelo fusionados a 2 columnas,
  // Código/Tag/Potencia/S-N sueltos), Operario/Observación comparten la fila
  // 8 (mismo patrón que diagnostico_servomotor). "Medición de diodos de
  // IGBT" y "Piezas a reemplazar" ahora SÍ tienen celda propia (antes caían
  // al anexo) — ver el cambio de PIEZAS_A_REEMPLAZAR a
  // PIEZAS_A_REEMPLAZAR_TABLA para este tipo en informesTecnicos.js.
  diagnostico_equipo: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "F7", potencia: "G7", serie: "H7",
      operario: "B8", observacionIngreso: "E8",
      // Rótulos editables sobre los recuadros de "Fotos del diagnóstico" (ver
      // sección con `campoTitulo` en informesTecnicos.js).
      tituloVistaFrontal: "A22", tituloPlaca: "C22", tituloEstadoInterno1: "E22", tituloEstadoInterno2: "G22",
      tituloEstadoCarcasa: "A35", tituloEstadoTarjeta: "C35", tituloComponentesMalEstado: "E35", tituloEstadoVentiladores: "G35",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "E", colDescripcion: "F", filaInicial: 39, max: 9 },
    },
    tabla: {
      medicionDiodosIgbt: {
        l1__dcMenos: "B39", l1__dcMas: "C39",
        l2__dcMenos: "B40", l2__dcMas: "C40",
        l3__dcMenos: "B41", l3__dcMas: "C41",
        u__dcMenos: "B43", u__dcMas: "C43",
        v__dcMenos: "B44", v__dcMas: "C44",
        w__dcMenos: "B45", w__dcMas: "C45",
      },
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`item${i + 1}`, `H${50 + i}`])),
      },
    },
    bullets: {
      observacionesIgbt: { col: "B", fila: 46, max: 1 },
      observacionFallas: { col: "A", fila: 63, max: 5 },
      recomendacion: { col: "A", fila: 69, max: 5 },
    },
    // "Estado general" ya no es texto libre — se migró a 8 slots de foto
    // fijos, ver SLOTS_FOTOS.diagnostico_equipo.
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT). "Datos del
  // equipo" usa fila 7 con Equipo/Marca y Modelo fusionados a 2 columnas
  // (Código/Tag/Potencia/S-N siguen siendo 1 celda cada uno), y Operario/
  // Observación comparten la fila 8 en vez de tener su propia fila de valor
  // debajo (distinto del patrón de arrancador/plc). "Piezas a reemplazar"
  // ahora SÍ tiene celda propia (tabla Cantidad/Descripción, antes cayía al
  // anexo) — ver el cambio de PIEZAS_A_REEMPLAZAR a PIEZAS_A_REEMPLAZAR_TABLA
  // para este tipo en informesTecnicos.js. El checklist sigue siendo de una
  // sola columna OK/NOK (no doble inicial/final).
  diagnostico_servomotor: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "F7", potencia: "G7", serie: "H7",
      operario: "B8", observacionIngreso: "E8",
      // Rótulos editables sobre los recuadros de "Fotos del diagnóstico" (ver
      // sección "Títulos de las fotos" en informesTecnicos.js) — a diferencia
      // de arrancador/plc, acá los 8 rótulos son todos independientes.
      tituloVistaFrontal: "A22", tituloPlaca: "C22", tituloEstadoCarcasa: "E22", tituloEstadoEncoder: "G22",
      tituloEstadoInterno: "A35", tituloConectores: "C35", tituloEstadoRodamientos: "E35", tituloPruebaEquipo: "G35",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 38, max: 5 },
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`item${i + 1}`, `H${45 + i}`])),
      },
    },
    bullets: {
      observacionFallas: { col: "A", fila: 59, max: 5 },
      actividadesARealizar: { col: "A", fila: 65, max: 5 },
    },
    // "Estado general" ya no es texto libre — se migró a 8 slots de foto
    // fijos, ver SLOTS_FOTOS.diagnostico_servomotor.
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT), mismo
  // patrón de fila 7 que plc/panel/pc (Equipo/Marca-Modelo-Código fusionados
  // a 2 columnas). Operario/Observación con celdas propias (A9/D8), distinto
  // patrón que otros tipos. Conclusiones/Recomendaciones con caja de 5
  // líneas cada una.
  tarjetas: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "D8",
      // Rótulos editables sobre los 3 recuadros de "Imágenes" (ver sección
      // con `campoTitulo` en informesTecnicos.js).
      tituloImagenA: "A31", tituloImagenB: "D31", tituloImagenC: "G31",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 35, max: 4 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i, 41 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      conclusiones: { col: "A", fila: 50, max: 5 },
      recomendaciones: { col: "A", fila: 56, max: 5 },
    },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT), mismo patrón
  // que plc/panel (fila 7 con Equipo/Marca-Modelo-Código fusionados a 2
  // columnas, Operario/Observación con celda C8:I9). Sin bullet
  // "Observaciones" (esta plantilla nunca lo tuvo) — Conclusiones/
  // Recomendaciones con caja de 5 líneas cada una (igual que plc/panel).
  pc: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "C8",
      // Rótulos editables sobre los recuadros de "Fotos del mantenimiento"
      // (ver sección con `campoTitulo` en informesTecnicos.js).
      tituloVistaFrontal: "A31", tituloPlacaEquipo: "D31", tituloCarcasaContaminada: "G31",
      tituloCarcasaDescontaminada: "A52",
      tituloLimpiezaTarjetaInicial: "D52", tituloLimpiezaTarjetaFinal: "D52",
      tituloCambioVentilador: "G52",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 56, max: 5 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [i, 63 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      conclusiones: { col: "A", fila: 73, max: 5 },
      recomendaciones: { col: "A", fila: 79, max: 5 },
    },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT), mismo patrón
  // que plc (fila 7 con Equipo/Marca-Modelo-Código fusionados a 2 columnas,
  // Operario/Observación con celda C8:I9). Observaciones/Conclusiones/
  // Recomendaciones tienen caja de 5 líneas cada una (igual que plc).
  panel: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "C8",
      // Rótulos editables sobre los recuadros de "Fotos del mantenimiento"
      // (ver sección con `campoTitulo` en informesTecnicos.js).
      tituloVistaFrontal: "A31", tituloPlacaEquipo: "D31",
      tituloCarcasaContaminada: "G31", tituloCarcasaDescontaminada: "G31",
      tituloLimpiezaTarjetaInicial: "A52", tituloLimpiezaTarjetaFinal: "A52",
      tituloCambioLcdInicial: "D52", tituloCambioLcdFinal: "D52",
      tituloCambioTouchInicial: "G52", tituloCambioTouchFinal: "G52",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 56, max: 5 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i, 63 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observaciones: { col: "A", fila: 72, max: 5 },
      conclusiones: { col: "A", fila: 78, max: 5 },
      recomendaciones: { col: "A", fila: 84, max: 5 },
    },
  },

  // Re-mapeada completa — la plantilla real ya no trae el bloque de
  // encabezado (CAMPOS_ENCABEZADO_SERVICIO): en su lugar, una sola celda
  // combinada A2:H3 (bajo el rótulo impreso "DESCRIPCION" en A1:H1) recibe
  // la descripción de la OT. El resto del contenido subió ~8 filas por la
  // eliminación del encabezado (confirmado celda por celda contra la
  // plantilla real, 2026-08-31): datos del componente/equipo en fila 7
  // (rótulos en fila 6), checklist en H24:H30, recomendaciones con 5 líneas
  // (filas 32-36, hasta la última fila real de la hoja).
  adicional: {
    campos: {
      descripcion: "A2",
      componenteMarca: "A7", componenteModelo: "B7", componentePotencia: "C7", componenteCantidad: "D7",
      equipoMarca: "E7", equipoModelo: "F7", equipoPotencia: "G7", equipoCantidad: "H7",
      // Rótulos A21:D21/E21:H21, editables — si el técnico los deja vacíos,
      // escribir() no toca la celda y queda el texto impreso de la plantilla.
      tituloVistaComponente: "A21", tituloVistaEquipo: "E21",
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`item${i + 1}`, `H${24 + i}`])),
      },
    },
    bullets: { recomendaciones: { col: "A", fila: 32, max: 5 } },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — igual que "adicional"/"arrancador", A3 (bajo el rótulo
  // impreso "DESCRIPCION" en A1:I2) recibe la descripción. "Datos del
  // equipo"/fotos/checklist subieron 8 filas por la eliminación del
  // encabezado (confirmado celda por celda). Observaciones/Conclusiones/
  // Recomendaciones ya no son de 1-2 líneas: la plantilla les dio una caja
  // de 5 líneas cada una (filas 71-75/77-81/83-87), no solo se corrieron.
  plc: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "C8",
      // Rótulos editables sobre los recuadros de "Fotos del mantenimiento"
      // (ver sección "Títulos de las fotos" en informesTecnicos.js).
      tituloVistaFrontal: "A31", tituloPlacaEquipo: "D31", tituloCarcasaContaminada: "G31",
      tituloCarcasaDescontaminada: "A52",
      tituloLimpiezaTarjetaInicial: "D52", tituloLimpiezaTarjetaFinal: "D52",
      tituloCambioComponentes: "G52",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 56, max: 4 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i, 62 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observaciones: { col: "A", fila: 71, max: 5 },
      conclusiones: { col: "A", fila: 77, max: 5 },
      recomendaciones: { col: "A", fila: 83, max: 5 },
    },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado (CAMPOS_ENCABEZADO_SERVICIO) — igual que "adicional", una
  // sola celda A3 (bajo el rótulo impreso "DESCRIPCION" en A1:I2) recibe la
  // descripción. Todo el resto del contenido, desde "DATOS DEL EQUIPO" en
  // adelante, subió exactamente 8 filas por la eliminación del encabezado
  // (confirmado celda por celda contra la plantilla real). "Equipo/Marca",
  // "Modelo" y "Código" ahora van en celdas fusionadas de 2 columnas (antes
  // 1 sola) — Tag/Potencia/S-N siguen siendo 1 celda. Ver SLOTS_FOTOS.arrancador
  // para el recuadro de "Prueba de equipo inicial/final" (reubicado, pedido
  // explícito del usuario).
  arrancador: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "C8",
      protoInicialEncendido: "B11", protoFinalEncendido: "G11",
      protoInicialBackup: "B12", protoFinalBackup: "G12",
      protoInicialTemperatura: "B13", protoFinalTemperatura: "G13",
      protoInicialVentilador: "B14", protoFinalVentilador: "G14",
      protoInicialTiempoPrueba: "B15", protoFinalTiempoPrueba: "G15",
      protoInicialCorrienteSalida: "B16", protoFinalCorrienteSalida: "G16",
      protoInicialCorrienteSoftware: "B17", protoFinalCorrienteSoftware: "G17",
      protoInicialVoltajeSalida: "B18", protoFinalVoltajeSalida: "G18",
      protoInicialVoltajeSoftware: "B19", protoFinalVoltajeSoftware: "G19",
      protoInicialMedicionBusDc: "B20", protoFinalMedicionBusDc: "G20",
      protoInicialMedicionLineaTierra: "B21", protoFinalMedicionLineaTierra: "G21",
      protoInicialProtocoloComunicacion: "B22", protoFinalProtocoloComunicacion: "G22",
      protoInicialIdProtocolo: "B23", protoFinalIdProtocolo: "G23",
      protoInicialObservacion: "A25", protoFinalObservacion: "F25",
      // Rótulos editables sobre los recuadros de "Fotos del mantenimiento"
      // (ver sección "Títulos de las fotos" en informesTecnicos.js) — celda
      // master de cada rótulo fusionado, confirmada contra la plantilla real.
      tituloVistaFrontal: "A47", tituloPlacaEquipo: "D47", tituloCarcasaContaminada: "G47",
      tituloCarcasaDescontaminada: "A68",
      tituloLimpiezaContaminada: "D68", tituloLimpiezaDescontaminada: "D68",
      tituloPastaTermicaSeca: "G68", tituloPastaTermicaNueva: "G68",
      tituloCambioVentilador: "A89",
      tituloCambioComponentesInicial: "D89", tituloCambioComponentesFinal: "D89",
      tituloMedicionScrInicial: "G89", tituloMedicionScrFinal: "G89",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "F", colDescripcion: "G", filaInicial: 93, max: 3 },
    },
    tabla: {
      medicionScr: {
        scr1__gateAnode: "B93", scr1__gateCathode: "C93",
        scr2__gateAnode: "B94", scr2__gateCathode: "C94",
        scr3__gateAnode: "B95", scr3__gateCathode: "C95",
      },
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 13 }, (_, i) => [i, 100 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observacionesScr: { col: "A", fila: 97, max: 1 },
      observaciones: { col: "A", fila: 114, max: 1 },
      conclusiones: { col: "A", fila: 116, max: 3 },
      recomendaciones: { col: "A", fila: 120, max: 2 },
    },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — layout prácticamente idéntico a arrancador (mismas filas
  // exactas para protocolo/fotos: 47/68/89). Piezas a reemplazar (F:I) ocupa
  // exactamente la misma altura que la tabla de medición IGBT al lado (7
  // filas: L1/L2/L3/divisor SALIDA/U/V/W), no el bloque típico de 5.
  variador_reparacion: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "D8",
      protoInicialEncendido: "B11", protoFinalEncendido: "G11",
      protoInicialBackup: "B12", protoFinalBackup: "G12",
      protoInicialTemperatura: "B13", protoFinalTemperatura: "G13",
      protoInicialVentilador: "B14", protoFinalVentilador: "G14",
      protoInicialTiempoPrueba: "B15", protoFinalTiempoPrueba: "G15",
      protoInicialCorrienteSalida: "B16", protoFinalCorrienteSalida: "G16",
      protoInicialCorrienteSoftware: "B17", protoFinalCorrienteSoftware: "G17",
      protoInicialVoltajeSalida: "B18", protoFinalVoltajeSalida: "G18",
      protoInicialVoltajeSoftware: "B19", protoFinalVoltajeSoftware: "G19",
      protoInicialMedicionBusDc: "B20", protoFinalMedicionBusDc: "G20",
      protoInicialMedicionLineaTierra: "B21", protoFinalMedicionLineaTierra: "G21",
      protoInicialProtocoloComunicacion: "B22", protoFinalProtocoloComunicacion: "G22",
      protoInicialIdProtocolo: "B23", protoFinalIdProtocolo: "G23",
      protoInicialObservacion: "A25", protoFinalObservacion: "F25",
      // Rótulos editables sobre los recuadros de "Fotos del mantenimiento"
      // (ver sección con `campoTitulo` en informesTecnicos.js).
      tituloVistaFrontal: "A47", tituloPlacaEquipo: "D47", tituloCarcasaContaminada: "G47",
      tituloCarcasaDescontaminada: "A68",
      tituloTarjetaContaminada: "D68", tituloTarjetaDescontaminada: "D68",
      tituloPastaTermicaSeca: "G68", tituloPastaTermicaNueva: "G68",
      tituloCambioVentilador: "A89",
      tituloCambioComponentesInicial: "D89", tituloCambioComponentesFinal: "D89",
      tituloMedicionIgbtInicial: "G89", tituloMedicionIgbtFinal: "G89",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "F", colDescripcion: "G", filaInicial: 93, max: 7 },
    },
    tabla: {
      medicionIgbtIngreso: { l1__dcMenos: "B93", l1__dcMas: "C93", l2__dcMenos: "B94", l2__dcMas: "C94", l3__dcMenos: "B95", l3__dcMas: "C95" },
      medicionIgbtSalida: { u__dcMenos: "B97", u__dcMas: "C97", v__dcMenos: "B98", v__dcMas: "C98", w__dcMenos: "B99", w__dcMas: "C99" },
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i, 104 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observacionesIgbt: { col: "B", fila: 100, max: 1 },
      observaciones: { col: "A", fila: 117, max: 5 },
      conclusiones: { col: "A", fila: 123, max: 5 },
      recomendaciones: { col: "A", fila: 129, max: 5 },
    },
  },

  // Re-mapeada completa (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — layout prácticamente idéntico a arrancador (mismas filas
  // exactas para protocolo/fotos/checklist/bullets), con "Medición de
  // baterías" y "Piezas a reemplazar" compartiendo el bloque de 10 filas
  // (93-102) lado a lado en vez del típico bloque de 5. La plantilla trae
  // además 9 recuadros de foto con rótulo propio (antes esta era la única
  // plantilla del set sin `slotsFijos` — modo libre); se migra al mismo
  // patrón que arrancador para que los rótulos impresos sean editables.
  ups: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", codigo: "E7", tag: "G7", potencia: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "C8",
      protoInicialEncendido: "B11", protoFinalEncendido: "G11",
      protoInicialBackup: "B12", protoFinalBackup: "G12",
      protoInicialTemperatura: "B13", protoFinalTemperatura: "G13",
      protoInicialVentilador: "B14", protoFinalVentilador: "G14",
      protoInicialTiempoPrueba: "B15", protoFinalTiempoPrueba: "G15",
      protoInicialCorrienteSalida: "B16", protoFinalCorrienteSalida: "G16",
      protoInicialCorrienteSoftware: "B17", protoFinalCorrienteSoftware: "G17",
      protoInicialVoltajeSalida: "B18", protoFinalVoltajeSalida: "G18",
      protoInicialVoltajeSoftware: "B19", protoFinalVoltajeSoftware: "G19",
      protoInicialMedicionBusDc: "B20", protoFinalMedicionBusDc: "G20",
      protoInicialMedicionLineaTierra: "B21", protoFinalMedicionLineaTierra: "G21",
      protoInicialProtocoloComunicacion: "B22", protoFinalProtocoloComunicacion: "G22",
      protoInicialIdProtocolo: "B23", protoFinalIdProtocolo: "G23",
      protoInicialObservacion: "A25", protoFinalObservacion: "F25",
      tituloVistaFrontal: "A47", tituloPlacaEquipo: "D47", tituloCarcasaContaminada: "G47",
      tituloCarcasaDescontaminada: "A68",
      tituloTarjetaContaminada: "D68", tituloTarjetaDescontaminada: "D68",
      tituloBateriasContaminadas: "G68", tituloBateriasDescontaminadas: "G68",
      tituloCambioVentilador: "A89",
      tituloCambioComponentesInicial: "D89", tituloCambioComponentesFinal: "D89",
      tituloMedicionBateriasInicial: "G89", tituloMedicionBateriasFinal: "G89",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "F", colDescripcion: "G", filaInicial: 93, max: 10 },
    },
    tabla: {
      medicionBaterias: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [i, 93 + i]).flatMap(([i, fila]) => [
          [`bateria${i + 1}__nominal`, `B${fila}`], [`bateria${i + 1}__real`, `C${fila}`],
        ])
      ),
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i, 106 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observaciones: { col: "A", fila: 119, max: 5 },
      conclusiones: { col: "A", fila: 125, max: 5 },
      recomendaciones: { col: "A", fila: 131, max: 5 },
    },
  },

  // La plantilla más grande y compleja del set (489 filas, ~90 ítems de
  // checklist repartidos en 4 sub-checklists + tablas de mediciones
  // eléctricas/mecánicas + tolerancias EASA AR100). Solo se mapeó con
  // confianza el bloque superior (encabezado + datos del equipo); el resto
  // de las ~90 celdas de checklist y las tablas de medición necesitan
  // verificación visual contra el Excel real antes de mapearse — todos esos
  // campos SÍ existen en el formulario de la app, solo caen al bloque anexo
  // al exportar en vez de quedar en su celda exacta de la plantilla.
  // Re-mapeado completo (2026-09-03): la plantilla real ya no trae el bloque
  // de encabezado — A3 recibe la descripción (título de la OT). "Datos del
  // equipo" en fila 7 (Equipo/Marca y Modelo fusionados a 2 columnas, Tag/
  // Potencia/Voltaje/RPM/S-N sueltos). A diferencia del resto de tipos,
  // Operario SÍ tiene celda de valor propia acá (A9, fila aparte de la
  // etiqueta) — antes caía al anexo. "Piezas a reemplazar" ocupa todo el
  // ancho (sin otra tabla al lado, a diferencia de arrancador/ups).
  //
  // Pruebas eléctricas/mecánicas (filas 96-119, confirmado celda por celda
  // valor+merge, no solo texto): termistor/aislamiento/bobina del estator
  // SÍ tienen celda propia ahora. "Tolerancia norma EASA AR100" (Desde/
  // Hasta, delantero y trasero) trae un valor DE FÁBRICA impreso
  // ("0.000mm"/"0.025mm", el estándar) — se mapea igual (mismo criterio que
  // "categoria": si el técnico no lo toca, el valor impreso queda). La
  // lista de "Herramientas y materiales" (filas 112-119, columnas G:I) es
  // un checklist FIJO ya impreso en la plantilla (nombres de herramientas
  // reales, no celdas en blanco) — no hay dónde meter el texto libre del
  // técnico sin pisar ese checklist, así que `herramientasMateriales`
  // sigue sin celda y cae al anexo.
  servomotor: {
    campos: {
      descripcion: "A3",
      equipoMarca: "A7", modelo: "C7", tag: "E7", potencia: "F7", voltaje: "G7", rpm: "H7", serie: "I7",
      operario: "A9", observacionIngreso: "C9",
      ...CAMPOS_PROTOCOLO_SERVOMOTOR,
      termistorValor: "B99", termistorSituacion: "B100", termistorEstado: "B101",
      aislamientoTempAmbiente: "D99", aislamientoTensionPrueba: "D100", aislamientoTiempoPrueba: "D101", aislamientoEstado: "E102",
      modeloRodamientoDelantero: "C108", toleranciaDelanteroDesde: "A111", toleranciaDelanteroHasta: "B111",
      modeloRodamientoTrasero: "C116", toleranciaTraseroDesde: "A119", toleranciaTraseroHasta: "B119",
      deflexionDiametro: "G106", deflexionValor: "H106", deflexionEstado: "I106",
      deflexionToleranciaDesde: "F109", deflexionToleranciaHasta: "H109",
      // "MARCA"/"MODELO"/"VOLTAJE" ya vienen impresos en G178/G179/G180 —
      // solo hace falta el valor, en la celda merge H178:I178 etc.
      placaMarca: "H178", placaModelo: "H179", placaVoltaje: "H180",
      // Rótulos editables sobre los recuadros de "Evidencias de
      // mantenimiento" (ver sección con `campoTitulo` en informesTecnicos.js)
      // — los 4 recuadros genéricos A/B/C/D no tienen rótulo propio (comparten
      // el título de sección "EVIDENCIAS DE MANTENIMIENTO"), no son editables.
      tituloEstadoEjeRotor: "A132", tituloAsientoRodamientoDelantero: "C132", tituloEstadoNucleoRotor: "E132", tituloAsientoTrasero: "H132",
      tituloEstadoChaveteroChaveta: "A147", tituloRodamientoDelantero: "C147", tituloFotoOriginalRotor: "E147", tituloRodamientoTrasero: "H147",
      tituloVistaFrontalEquipo: "A181", tituloPlacaEquipoFoto: "D181", tituloFotoEncoder: "G181",
      tituloCambioRodamientosFoto: "A202", tituloEstadoInternoEquipoInicial: "D202", tituloEstadoInternoEquipoFinal: "G202",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 29, max: 4 },
    },
    tabla: {
      medicionBobinaEstator: {
        faseUV__resistencia: "G99", faseUV__inductancia: "I99",
        faseVW__resistencia: "G100", faseVW__inductancia: "I100",
        faseUW__resistencia: "G101", faseUW__inductancia: "I101",
      },
      medicionesMecanicasDelanteras: {
        alojamiento__diametro: "B106", alojamiento__estado: "C106",
        asiento__diametro: "B107", asiento__estado: "C107",
      },
      medicionesMecanicasTraseras: {
        alojamiento__diametro: "B114", alojamiento__estado: "C114",
        asiento__diametro: "B115", asiento__estado: "C115",
      },
    },
    // Los 3 checklists confirmados celda por celda contra la plantilla
    // real: etiqueta fusionada A:H, valor en la columna I (única celda sin
    // fusionar de la fila) — mismo layout en los 3, sólo cambia la fila
    // inicial. Las claves (`insp_item1`...) deben coincidir con el
    // prefijo pasado a `checklistOkNok` en informesTecnicos.js.
    checklist: {
      "Checklist — Inspección visual y medición básica": {
        items: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`insp_item${i + 1}`, `I${35 + i}`])),
      },
      "Checklist del proceso desarmado": {
        items: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`desarme_item${i + 1}`, `I${58 + i}`])),
      },
      "Checklist del proceso de armado": {
        items: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`armado_item${i + 1}`, `I${80 + i}`])),
      },
    },
    bullets: {
      observacionesArmado: { col: "C", fila: 95, max: 1 },
      observaciones: { col: "A", fila: 204, max: 5 },
      conclusiones: { col: "A", fila: 210, max: 5 },
      recomendaciones: { col: "A", fila: 216, max: 5 },
    },
  },
};

// Tipos donde el bloque anexo "DATOS ADICIONALES" no debe mostrar el
// listado de fotos sin título ("Evidencia de los trabajos") ni la "Firma"
// — pedido explícito del usuario para que en el Excel de bobina de estator
// solo queden las imágenes, sin texto sobrante debajo. Las fotos en sí se
// siguen insertando igual (esa inserción no depende de este bloque).
//
// Ninguno de los 13 tipos nuevos lo necesita: ninguna de sus plantillas
// trae impreso un bloque "HECHO POR / V.B. / FECHA", así que la firma cae
// al anexo por diseño (mismo comportamiento que cualquier campo sin celda
// mapeada) — no hace falta la excepción.
const SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA = new Set([]);

// Plantillas donde ya se conoce la posición exacta del recuadro de foto
// impreso (pedido explícito del usuario, citando la celda directamente) —
// la(s) primera(s) foto(s) del informe se anclan ahí con ancla de DOS puntos
// (llena el rango exacto y se ajusta sola si cambian anchos/altos de fila o
// columna), en vez de la posición genérica "4 columnas a la derecha" de más
// abajo. Si el informe trae más fotos que slots definidos acá, las que
// sobran caen igual al área genérica de siempre — nunca se pierden.
// Dos formas de definir slots:
// - Array de rangos: posicional, la foto N (contando TODAS las fotos del
//   informe en orden) va al rango N.
// - Objeto { LETRA: rango }: por identidad de grupo — cada grupo de
//   evidencias con ese título fijo (ver `slotsFijos` en informesTecnicos.js
//   y SeccionEvidencias en FormInformeTecnico.jsx) siempre va a ese rango,
//   sin importar el orden de subida. Solo la PRIMERA foto de cada grupo
//   nombrado ocupa su slot — si el técnico sube más de una foto al mismo
//   recuadro, las de más caen al área genérica, igual que un tipo sin slots.
const SLOTS_FOTOS = {
  // El recuadro subió y se agrandó con el resto del contenido — confirmado
  // celda por celda 2026-09-03 (filas 9-35 completamente vacías antes del
  // rótulo "VISTA FRONTAL COMPONENTE" en la fila 36). Solo importa la
  // esquina superior-izquierda acá (ver "esSuministro" en
  // exportarInformeTecnicoExcel, la foto entra a tamaño real sin estirar).
  suministro: ["B9:E35"],
  soporte: { A: "A23:B37", B: "C23:D37", C: "E23:F37", D: "G23:H37" },
  // 8 filas más arriba por la eliminación del encabezado (confirmado celda
  // por celda 2026-09-03).
  diagnostico_equipo: {
    vistaFrontal: "A10:B21", placa: "C10:D21", estadoInterno1: "E10:F21", estadoInterno2: "G10:H21",
    estadoCarcasa: "A23:B34", estadoTarjeta: "C23:D34", componentesMalEstado: "E23:F34", estadoVentiladores: "G23:H34",
  },
  // 8 filas más arriba por la eliminación del encabezado (confirmado celda
  // por celda 2026-09-03).
  diagnostico_servomotor: {
    vistaFrontal: "A10:B21", placa: "C10:D21", estadoCarcasa: "E10:F21", estadoEncoder: "G10:H21",
    estadoInterno: "A23:B34", conectores: "C23:D34", estadoRodamientos: "E23:F34", pruebaEquipo: "G23:H34",
  },
  // 8 filas más arriba por la eliminación del encabezado (confirmado celda
  // por celda 2026-09-03).
  tarjetas: { imagenA: "A11:C30", imagenB: "D11:F30", imagenC: "G11:I30" },
  // 8 filas más arriba por la eliminación del encabezado (confirmado celda
  // por celda 2026-09-03).
  pc: {
    vistaFrontal: "A11:C30", placaEquipo: "D11:F30", carcasaContaminada: "G11:I30",
    carcasaDescontaminada: "A32:C51", limpiezaTarjetaInicial: "D32:F41", limpiezaTarjetaFinal: "D42:F51",
    cambioVentilador: "G32:I51",
  },
  // 8 filas más arriba por la eliminación del encabezado (confirmado celda
  // por celda 2026-09-03).
  panel: {
    vistaFrontal: "A11:C30", placaEquipo: "D11:F30",
    carcasaContaminada: "G11:I20", carcasaDescontaminada: "G21:I30",
    limpiezaTarjetaInicial: "A32:C41", limpiezaTarjetaFinal: "A42:C51",
    cambioLcdInicial: "D32:F41", cambioLcdFinal: "D42:F51",
    cambioTouchInicial: "G32:I41", cambioTouchFinal: "G42:I51",
  },
  // Recuadro subió con el resto del contenido (ver comentario en MAPEOS.adicional)
  // — inferido por el hueco entre la fila 8 (spacer) y el rótulo "VISTA FRONTAL..."
  // en la fila 21 (ahora DEBAJO del recuadro, no encima como en las demás
  // plantillas); no confirmado visualmente con una foto real insertada.
  adicional: { vistaFrontalComponente: "A9:D20", vistaFrontalEquipo: "E9:H20" },
  // 8 filas más arriba por la eliminación del encabezado (ver comentario en
  // MAPEOS.plc, confirmado celda por celda 2026-09-03).
  plc: {
    vistaFrontal: "A11:C30", placaEquipo: "D11:F30", carcasaContaminada: "G11:I30",
    carcasaDescontaminada: "A32:C51", limpiezaTarjetaInicial: "D32:F41", limpiezaTarjetaFinal: "D42:F51",
    cambioComponentes: "G32:I51",
  },
  // Mismo layout de 13 recuadros que antes, 8 filas más arriba por la
  // eliminación del encabezado (ver comentario en MAPEOS.arrancador,
  // confirmado celda por celda 2026-09-03). "Prueba de equipo inicial/final"
  // ya NO usa el recuadro chico C24:D25/H24:I25 impreso en la plantilla —
  // pedido explícito del usuario: ocupa toda la altura de su tabla de
  // protocolo (misma fila que el primer/último ítem, C11:D23 / H11:I23).
  arrancador: {
    vistaFrontal: "A27:C46", placaEquipo: "D27:F46", carcasaContaminada: "G27:I46",
    carcasaDescontaminada: "A48:C67", limpiezaContaminada: "D48:F57", limpiezaDescontaminada: "D58:F67",
    pastaTermicaSeca: "G48:I57", pastaTermicaNueva: "G58:I67",
    cambioVentilador: "A69:C88", cambioComponentesInicial: "D69:F78", cambioComponentesFinal: "D79:F88",
    medicionScrInicial: "G69:I78", medicionScrFinal: "G79:I88",
    protoInicialPrueba: "C11:D23", protoFinalPrueba: "H11:I23",
  },
  // Mismas filas exactas que arrancador (confirmado celda por celda
  // 2026-09-03), "Prueba de equipo inicial/final" también reubicada a toda
  // la altura de su tabla de protocolo (pedido explícito del usuario) en
  // vez del recuadro chico impreso.
  variador_reparacion: {
    vistaFrontal: "A27:C46", placaEquipo: "D27:F46", carcasaContaminada: "G27:I46",
    carcasaDescontaminada: "A48:C67", tarjetaContaminada: "D48:F57", tarjetaDescontaminada: "D58:F67",
    pastaTermicaSeca: "G48:I57", pastaTermicaNueva: "G58:I67",
    cambioVentilador: "A69:C88", cambioComponentesInicial: "D69:F78", cambioComponentesFinal: "D79:F88",
    medicionIgbtFotoInicial: "G69:I78", medicionIgbtFotoFinal: "G79:I88",
    protoInicialPrueba: "C11:D23", protoFinalPrueba: "H11:I23",
  },
  // 9 recuadros de foto (13 slots contando las variantes antes/después) —
  // mismas filas exactas que arrancador (confirmado celda por celda
  // 2026-09-03), "Prueba de equipo inicial/final" también reubicada a toda
  // la altura de su tabla de protocolo en vez del recuadro chico impreso.
  ups: {
    vistaFrontal: "A27:C46", placaEquipo: "D27:F46", carcasaContaminada: "G27:I46",
    carcasaDescontaminada: "A48:C67", tarjetaContaminada: "D48:F57", tarjetaDescontaminada: "D58:F67",
    bateriasContaminadas: "G48:I57", bateriasDescontaminadas: "G58:I67",
    cambioVentilador: "A69:C88", cambioComponentesInicial: "D69:F78", cambioComponentesFinal: "D79:F88",
    medicionBateriasInicial: "G69:I78", medicionBateriasFinal: "G79:I88",
    protoInicialPrueba: "C11:D23", protoFinalPrueba: "H11:I23",
  },
  // 8 filas más arriba por la eliminación del encabezado (confirmado celda
  // por celda 2026-09-03). "Prueba de equipo inicial/final" reubicada a
  // toda la altura de su tabla de protocolo (pedido explícito del usuario,
  // mismo criterio que arrancador/ups) en vez del recuadro chico C24:D25/
  // H24:I25 impreso en la plantilla.
  servomotor: {
    estadoEjeRotor: "A120:B131", asientoRodamientoDelantero: "C120:D131", estadoNucleoRotor: "E120:G131", asientoTrasero: "H120:I131",
    estadoChaveteroChaveta: "A133:B146", rodamientoDelantero: "C133:D146", fotoOriginalRotor: "E133:G146", rodamientoTrasero: "H133:I146",
    evidenciaA: "A148:B159", evidenciaB: "C148:D159", evidenciaC: "E148:G159", evidenciaD: "H148:I159",
    vistaFrontalEquipo: "A161:C180", placaEquipoFoto: "D161:F180", fotoEncoder: "G161:I177",
    cambioRodamientosFoto: "A182:C201", estadoInternoEquipoInicial: "D182:F201", estadoInternoEquipoFinal: "G182:I201",
    protoInicialPrueba: "C11:D23", protoFinalPrueba: "H11:I23",
  },
};

// "B23" -> 2 (1-based, B es la 2da columna).
const columnaANumero = (letras) => {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
};

// "B23:E34" -> anchor de dos puntos para ws.addImage. `br` apunta a la
// esquina superior-izquierda de la celda SIGUIENTE a la final (col+1 sin
// -1, row sin -1) para que el rectángulo incluya la celda final completa,
// no se detenga en su propia esquina superior-izquierda.
const rangoAAnchor = (rango) => {
  const [ini, fin] = rango.split(":");
  const [, colIni, filaIni] = ini.match(/^([A-Z]+)(\d+)$/);
  const [, colFin, filaFin] = fin.match(/^([A-Z]+)(\d+)$/);
  return {
    tl: { col: columnaANumero(colIni) - 1, row: Number(filaIni) - 1 },
    br: { col: columnaANumero(colFin), row: Number(filaFin) },
  };
};

// Para campos/checklist/tabla, una sección puede tener SOLO ALGUNOS de sus
// elementos mapeados (ej. un ítem de checklist sin celda propia en la
// plantilla real) — esta función devuelve nada más los pares [label, valor]
// de lo que efectivamente NO tiene celda, para no duplicar en el bloque
// anexo lo que ya se escribió con precisión.
// Con slotsFijos, `g.titulo` guarda la clave interna del slot (ej.
// "vistaFrontal"), no el texto legible — se resuelve contra la definición
// de la sección (mismo criterio que VistaInformeTecnico.jsx) para no
// filtrar claves en camelCase al Excel (celdas de texto o bloque anexo).
const tituloGrupo = (seccion, g) => seccion.slotsFijos?.find((s) => s.clave === g.titulo)?.label ?? g.titulo;

const elementosSinMapear = (seccion, mapa, campos) => {
  if (seccion.tipo === "campos") {
    return seccion.campos
      .filter((c) => !mapa.campos?.[c.clave])
      .map((c) => [c.label, campos[c.clave] ?? ""]);
  }
  if (seccion.tipo === "checklist") {
    const m = mapa.checklist?.[seccion.titulo];
    const pares = [];
    if (seccion.hechoPor && !m?.hechoPor) pares.push(["Hecho por", campos[`${claveChecklist(seccion.titulo)}__hechoPor`] ?? ""]);
    if (seccion.hechoPor && !m?.fecha) pares.push(["Fecha", campos[`${claveChecklist(seccion.titulo)}__fecha`] ?? ""]);
    seccion.items
      .filter((it) => !m?.items?.[it.clave])
      .forEach((it) => pares.push([it.label, campos[it.clave] ?? ""]));
    return pares;
  }
  if (seccion.tipo === "tabla") {
    const m = mapa.tabla?.[seccion.clave] || {};
    const valores = campos[seccion.clave] || {};
    const pares = [];
    if (seccion.hechoPor && !m.hechoPor) pares.push(["Hecho por", campos[`${claveChecklist(seccion.titulo)}__hechoPor`] ?? ""]);
    if (seccion.hechoPor && !m.fecha) pares.push(["Fecha", campos[`${claveChecklist(seccion.titulo)}__fecha`] ?? ""]);
    seccion.filas.forEach((f) => seccion.columnas.forEach((c) => {
      const clave = `${f.clave}__${c.clave}`;
      if (!m[clave]) pares.push([`${f.label} — ${c.label}`, valores[clave] ?? ""]);
    }));
    return pares;
  }
  return [];
};

// Exporta un InformeTecnico ya guardado a un .xlsx: cada campo con celda
// mapeada en MAPEOS se escribe directamente en su posición original de la
// plantilla (conserva 100% el formato/logo/merges/anchos/bordes/colores —
// se usa exceljs en vez de xlsx/SheetJS porque esta última, incluso sin
// tocar nada, no conserva el estilo de las celdas al releer y regrabar un
// archivo; exceljs sí preserva todo lo que no se toca explícitamente).
// Lo que no tiene celda conocida (o excede el número de líneas/fotos que la
// plantilla reserva) se anexa como bloque legible debajo del contenido
// original, para garantizar que nunca se pierda un dato capturado.
export async function exportarInformeTecnicoExcel(informe, ot) {
  const def = tipoInformePorValor(informe.tipo);
  if (!def) throw new Error("Tipo de informe desconocido");

  const res = await fetch(`/informes-templates/${encodeURIComponent(def.archivoExcel)}`);
  const buf = await res.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];

  // Algunas plantillas traen notas/comentarios de Excel (instrucciones
  // internas del equipo al armar el formato, ej. "COLOCAR ESTE CUADRO AL
  // DIGITALIZAR SIEMPRE") cuyo bloque de protección quedó nulo al guardarse
  // — exceljs revienta al regrabar el archivo si encuentra una nota así
  // (lee `protection.locked` sin chequear null). Simplemente borrar la nota
  // (`cell.note = undefined`) NO alcanza: el modelo interno de la celda ya
  // trae el comentario embebido desde la carga y lo conserva igual. La
  // única forma confiable de neutralizarla con la API pública es
  // reasignarla como texto plano — eso fuerza a exceljs a reconstruir la
  // nota con los valores de protección por defecto en vez del `null` roto.
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      const note = cell.note;
      if (note) {
        cell.note = Array.isArray(note.texts) ? note.texts.map((t) => t.text).join("") : String(note);
      }
    });
  });

  const campos = informe.campos || {};
  const mapa = MAPEOS[informe.tipo] || {};

  const escribir = (addr, valor) => {
    if (!addr || valor === undefined || valor === null || valor === "") return;
    (Array.isArray(addr) ? addr : [addr]).forEach((a) => { ws.getCell(a).value = String(valor); });
  };

  def.secciones.forEach((seccion) => {
    if (seccion.tipo === "campos") {
      seccion.campos.forEach((c) => escribir(mapa.campos?.[c.clave], campos[c.clave]));
    } else if (seccion.tipo === "checklist") {
      const m = mapa.checklist?.[seccion.titulo];
      if (!m) return;
      if (seccion.hechoPor) {
        escribir(m.hechoPor, campos[`${claveChecklist(seccion.titulo)}__hechoPor`]);
        escribir(m.fecha, campos[`${claveChecklist(seccion.titulo)}__fecha`]);
      }
      seccion.items.forEach((it) => escribir(m.items?.[it.clave], campos[it.clave]));
    } else if (seccion.tipo === "tabla") {
      const m = mapa.tabla?.[seccion.clave];
      if (!m) return;
      if (seccion.hechoPor) {
        escribir(m.hechoPor, campos[`${claveChecklist(seccion.titulo)}__hechoPor`]);
        escribir(m.fecha, campos[`${claveChecklist(seccion.titulo)}__fecha`]);
      }
      const valores = campos[seccion.clave] || {};
      seccion.filas.forEach((f) => seccion.columnas.forEach((c) => {
        const clave = `${f.clave}__${c.clave}`;
        escribir(m[clave], valores[clave]);
      }));
    } else if (seccion.tipo === "bullets") {
      const m = mapa.bullets?.[seccion.clave];
      if (!m) return;
      const lineas = (campos[seccion.clave] || []).filter(Boolean);
      lineas.slice(0, m.max).forEach((linea, i) => escribir(`${m.col}${m.fila + i}`, linea));
    } else if (seccion.tipo === "filas") {
      const m = mapa.filas?.[seccion.clave];
      if (!m) return;
      const [colUno, colDos] = seccion.columnas;
      const filas = (campos[seccion.clave] || []).filter((f) => f[colUno.clave] || f[colDos.clave]);
      filas.slice(0, m.max).forEach((f, i) => {
        escribir(`${m.colCantidad}${m.filaInicial + i}`, f[colUno.clave]);
        escribir(`${m.colDescripcion}${m.filaInicial + i}`, f[colDos.clave]);
      });
    } else if (seccion.tipo === "evidencias") {
      // Rótulos editables de cada recuadro (`campoTitulo` en el slot, ver
      // informesTecnicos.js) — viven en mapa.campos (misma celda que si
      // fueran una sección "campos" normal), no en mapa.evidencias. Cada
      // slot tiene su PROPIO campoTitulo (inputs siempre independientes en
      // el formulario, nunca comparten estado) — pero 2 slots "antes/
      // después" a veces mapean a la MISMA celda impresa (un solo rótulo
      // físico para las 2 fotos, ej. "CAMBIO DE COMPONENTES"). Se agrupa por
      // dirección de celda (no por nombre de campo) y, si ambos técnicos
      // llenaron su versión, se combinan con " / " — si solo uno lo llenó,
      // se usa ese; si ninguno, la celda no se toca y queda el texto impreso.
      const valoresPorCelda = new Map();
      (seccion.slotsFijos || []).forEach((slot) => {
        if (!slot.campoTitulo) return;
        const addr = mapa.campos?.[slot.campoTitulo];
        const valor = campos[slot.campoTitulo];
        if (!addr || !valor) return;
        if (!valoresPorCelda.has(addr)) valoresPorCelda.set(addr, []);
        valoresPorCelda.get(addr).push(valor);
      });
      valoresPorCelda.forEach((valores, addr) => escribir(addr, valores.join(" / ")));
      const slots = mapa.evidencias?.[seccion.clave];
      if (!slots) return;
      const grupos = campos[seccion.clave] || [];
      grupos.slice(0, slots.length).forEach((g, i) => escribir(slots[i], tituloGrupo(seccion, g)));
    }
  });

  const fechaFormateada = informe.fecha ? formatearFecha(informe.fecha) : "";
  escribir(mapa.footer?.hechoPor, informe.hechoPor);
  escribir(mapa.footer?.vB, informe.vB);
  escribir(mapa.footer?.fecha, fechaFormateada);

  // Bloque anexo: solo lo que NO tiene celda mapeada para este tipo, más el
  // excedente de líneas/fotos que ya no cupo en los espacios reservados.
  // Estas plantillas usan una grilla de columnas angostísimas (~18px cada
  // una, ancho ≈2.29) para armar los recuadros del formato original — un
  // texto normal escrito en una sola de esas celdas se ve cortado porque
  // Excel no hace "overflow" visual cuando la celda vecina no está
  // realmente vacía (trae borde/estilo heredado de la grilla). Por eso acá
  // se fusiona un rango ancho antes de escribir, en vez de una celda suelta.
  //
  // ws.rowCount refleja la dimensión declarada de la hoja (ej. 199 en estas
  // plantillas), no la última fila con contenido real (que puede ser mucho
  // más chica, ej. ~128) — usarlo tal cual dejaba un salto enorme de filas
  // vacías antes de este bloque. Se busca la última fila que de verdad
  // tiene algo escrito.
  let ultimaFilaConContenido = 0;
  ws.eachRow((_row, numeroFila) => { ultimaFilaConContenido = numeroFila; });
  let fila = ultimaFilaConContenido + 4;
  const escribirFila = (col, r, valor) => {
    const rango = `${col}${r}:AJ${r}`;
    try { ws.mergeCells(rango); } catch { /* ya fusionada, no pasa nada */ }
    ws.getCell(`${col}${r}`).value = String(valor);
  };

  const bloques = [];
  def.secciones.forEach((seccion) => {
    if (["campos", "checklist", "tabla"].includes(seccion.tipo)) {
      const faltan = elementosSinMapear(seccion, mapa, campos);
      if (faltan.length) bloques.push([seccion.titulo, faltan]);
      return;
    }
    if (seccion.tipo === "bullets") {
      const m = mapa.bullets?.[seccion.clave];
      const lineas = (campos[seccion.clave] || []).filter(Boolean);
      if (!m) {
        bloques.push([seccion.titulo, lineas.length ? lineas.map((l) => ["", l]) : [["(sin líneas)", ""]]]);
      } else if (lineas.length > m.max) {
        bloques.push([`${seccion.titulo} (líneas adicionales)`, lineas.slice(m.max).map((l) => ["", l])]);
      }
    } else if (seccion.tipo === "filas") {
      const m = mapa.filas?.[seccion.clave];
      const [colUno, colDos] = seccion.columnas;
      const filas = (campos[seccion.clave] || []).filter((f) => f[colUno.clave] || f[colDos.clave]);
      const par = (f) => [f[colUno.clave] || "—", f[colDos.clave] || ""];
      if (!m) {
        bloques.push([seccion.titulo, filas.length ? filas.map(par) : [["(sin filas)", ""]]]);
      } else if (filas.length > m.max) {
        bloques.push([`${seccion.titulo} (filas adicionales)`, filas.slice(m.max).map(par)]);
      }
    } else if (seccion.tipo === "evidencias") {
      const slots = mapa.evidencias?.[seccion.clave];
      const grupos = campos[seccion.clave] || [];
      if (!slots) {
        if (!SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA.has(informe.tipo)) {
          bloques.push([seccion.titulo, grupos.map((g) => [tituloGrupo(seccion, g) || "(sin título)", `${g.imagenes?.length || 0} foto(s)`])]);
        }
      } else if (grupos.length > slots.length) {
        bloques.push([`${seccion.titulo} (grupos adicionales)`, grupos.slice(slots.length).map((g) => [tituloGrupo(seccion, g) || "(sin título)", `${g.imagenes?.length || 0} foto(s)`])]);
      }
    }
  });

  // Firma: si la plantilla de este tipo no tiene un bloque de "Hecho por /
  // V.B. / Fecha" impreso (ninguna de las 13 plantillas nuevas lo trae), no
  // se pierde el dato — cae acá igual que cualquier otro campo sin celda
  // mapeada. SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA permite excluir un tipo de
  // este texto anexo puntualmente si algún tipo lo pidiera más adelante.
  if (!SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA.has(informe.tipo)) {
    const faltanFirma = [];
    if (!mapa.footer?.hechoPor) faltanFirma.push(["Hecho por", informe.hechoPor || ""]);
    if (!mapa.footer?.vB) faltanFirma.push(["V.B.", informe.vB || ""]);
    if (!mapa.footer?.fecha) faltanFirma.push(["Fecha", fechaFormateada]);
    if (faltanFirma.length) bloques.push(["Firma", faltanFirma]);
  }

  if (bloques.length) {
    escribirFila("B", fila, `DATOS ADICIONALES — ${def.label}`);
    fila += 2;
    bloques.forEach(([titulo, pares]) => {
      escribirFila("B", fila, titulo);
      fila += 1;
      pares.forEach(([label, valor]) => {
        escribirFila("C", fila, label ? `${label}: ${valor || "—"}` : (valor || "—"));
        fila += 1;
      });
      fila += 1;
    });
    fila += 2;
  }

  // Fotos: se insertan apiladas verticalmente 4 columnas a la derecha de la
  // última columna real de la plantilla, fuera del área impresa, en vez de en
  // la columna B como antes — el usuario las arrastra a su lugar final en
  // Excel. Se calcula en base a ws.dimensions.right (última columna con
  // contenido real) en vez de hardcodear "BC" porque cada plantilla tiene
  // un ancho distinto (ej. las de bobina de estator son mucho más angostas).
  // Cada foto se inserta con su tamaño real (dimensionesImagen), no
  // estirada a una celda ni a un tamaño fijo — así no queda distorsión,
  // aceptando que el usuario después la acomode/redimensione a mano si
  // queda más grande o chica de lo que entra a simple vista en la hoja.
  const numeroAColumna = (n) => {
    let s = "";
    for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const ULTIMA_COL_NUM = ws.dimensions?.right || 30;
  const COL_FOTOS_NUM = ULTIMA_COL_NUM + 4; // 4 columnas a la derecha de la última columna real
  const COL_FOTOS = numeroAColumna(COL_FOTOS_NUM);
  const COL_FOTOS_IDX0 = COL_FOTOS_NUM - 1; // 0-indexado, lo que espera el anchor de addImage
  const COL_FOTOS_FIN = numeroAColumna(COL_FOTOS_NUM + 3); // ancho aprox. de la imagen (260px ≈ 4 columnas)
  const escribirFilaDerecha = (r, valor) => {
    const rango = `${COL_FOTOS}${r}:${COL_FOTOS_FIN}${r}`;
    try { ws.mergeCells(rango); } catch { /* ya fusionada, no pasa nada */ }
    ws.getCell(`${COL_FOTOS}${r}`).value = String(valor);
  };

  const fotosAInsertar = [];
  def.secciones.forEach((seccion) => {
    if (seccion.tipo !== "evidencias") return;
    (campos[seccion.clave] || []).forEach((g) => {
      (g.imagenes || []).forEach((ruta) => fotosAInsertar.push({ titulo: g.titulo || seccion.titulo, ruta }));
    });
  });

  if (fotosAInsertar.length) {
    const slotsConfig = SLOTS_FOTOS[informe.tipo];
    const slotsPorNombre = slotsConfig && !Array.isArray(slotsConfig);
    const slotsPosicionales = Array.isArray(slotsConfig) ? slotsConfig.map(rangoAAnchor) : [];
    const nombresUsados = new Set();
    // Arranca en una fila fija (6), independiente de dónde haya terminado
    // el bloque de texto "DATOS ADICIONALES" — antes las fotos seguían
    // acumulándose después de ese bloque y terminaban muy abajo ("al final
    // de la hoja") cuando el informe tenía muchos datos sin celda mapeada.
    // Al estar en una columna bien a la derecha del contenido real (ver
    // COL_FOTOS arriba), la fila 6 siempre está libre ahí sin importar el
    // tipo de informe.
    let filaFotos = 6;
    let encabezadoGenericoEscrito = false;
    for (let i = 0; i < fotosAInsertar.length; i++) {
      const { titulo, ruta } = fotosAInsertar[i];
      const extension = EXTENSION_SOPORTADA(ruta);
      if (!extension) { console.warn("Formato de imagen no soportado para Excel:", ruta); continue; }
      try {
        const resImg = await fetchUpload(ruta);
        const bufferImgOriginal = await resImg.arrayBuffer();
        // Comprimida para ESTE Excel puntual — el archivo guardado en el
        // servidor no se toca (ver comprimirImagenParaExcel arriba). Si la
        // compresión falla, se usa el buffer original tal cual.
        const comprimida = await comprimirImagenParaExcel(bufferImgOriginal, extension);
        const bufferImg = comprimida?.buffer || bufferImgOriginal;
        const extensionFinal = comprimida?.extension || extension;
        const imageId = wb.addImage({ buffer: bufferImg, extension: extensionFinal });
        // Tamaño original (sin estirar a la celda) — pedido explícitamente
        // solo para INFORME DE SUMINISTRO. El resto de informes sigue
        // estirando la foto al recuadro completo de la plantilla (comportamiento
        // de siempre): si esto se generaliza a todos los tipos, cada foto se
        // pega con su tamaño real sin importar el recuadro, que es justo el bug
        // que se reportó (se había propagado a todos los informes por error).
        const esSuministro = informe.tipo === "suministro";
        let ext = { width: 260, height: 195 };
        if (esSuministro) {
          // Si no se puede decodificar la imagen (formato raro, buffer corrupto),
          // cae al tamaño fijo de antes en vez de insertarla con ext undefined.
          // Usa el buffer YA comprimido — el "tamaño real" ahora es el
          // reescalado (nunca más grande que MAX_LADO_FOTO_EXCEL), no el
          // tamaño original de la foto del celular.
          const dim = await dimensionesImagen(bufferImg, extensionFinal);
          ext = dim || ext;
        }
        let slot = null;
        if (slotsPorNombre) {
          if (slotsConfig[titulo] && !nombresUsados.has(titulo)) {
            slot = rangoAAnchor(slotsConfig[titulo]);
            nombresUsados.add(titulo);
          }
        } else {
          slot = slotsPosicionales[i];
        }
        if (slot && esSuministro) {
          // Posición conocida de la plantilla — se usa solo su esquina
          // superior-izquierda como ancla (no el rango completo B23:E34),
          // para que la foto entre a su tamaño real en vez de estirarse a
          // ese recuadro.
          ws.addImage(imageId, { tl: slot.tl, ext });
        } else if (slot) {
          // Resto de informes: se estira al recuadro completo de la plantilla
          // (tl + br), comportamiento original antes de agregar el tamaño real.
          ws.addImage(imageId, slot);
        } else {
          if (!encabezadoGenericoEscrito) {
            escribirFilaDerecha(filaFotos, "FOTOS ADJUNTAS (arrastrar a la posición final)");
            filaFotos += 2;
            encabezadoGenericoEscrito = true;
          }
          escribirFilaDerecha(filaFotos, titulo);
          ws.addImage(imageId, {
            tl: { col: COL_FOTOS_IDX0, row: filaFotos }, // filaFotos es 1-indexado pero el anchor espera 0-indexado
            ext,
          });
          filaFotos += 11;
        }
      } catch (err) {
        console.warn("No se pudo insertar la imagen en el Excel:", ruta, err.message);
      }
    }
  }

  // Nombre + N° de informe + N° de OT (nunca el _id de Mongo, pedido
  // explícito del usuario) — si la OT no tiene numeroOT cargado (campo
  // manual, no todas lo tienen), cae a su código interno en vez de omitirlo.
  const numeroOT = ot?.numeroOT || ot?.codigo || "";
  const nombreArchivo = `${def.label} - ${informe.codigo || "informe"}${numeroOT ? ` - OT ${numeroOT}` : ""}.xlsx`;
  const bufferSalidaSinMetadatos = await wb.xlsx.writeBuffer();
  const bufferSalida = await restaurarMetadatosDePagina(buf, bufferSalidaSinMetadatos);
  const blob = new Blob([bufferSalida], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
