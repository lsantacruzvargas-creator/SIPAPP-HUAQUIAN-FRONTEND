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
const CAMPOS_PROTOCOLO_SERVOMOTOR = {
  protoInicialEncendido: "B19", protoInicialTemperatura: "B20", protoInicialVentilador: "B21", protoInicialTiempoPrueba: "B22",
  protoInicialTensionAc: "B23", protoInicialVelocidadRpm: "B24", protoInicialVibracion: "B25", protoInicialCorrienteFases: "B26",
  protoInicialCorrienteLu: "B28", protoInicialCorrienteLv: "B29", protoInicialCorrienteLw: "B30", protoInicialMedicionPolos: "B31",
  protoInicialObservacion: "A33",
  protoFinalEncendido: "G19", protoFinalTemperatura: "G20", protoFinalVentilador: "G21", protoFinalTiempoPrueba: "G22",
  protoFinalTensionAc: "G23", protoFinalVelocidadRpm: "G24", protoFinalVibracion: "G25", protoFinalCorrienteFases: "G26",
  protoFinalCorrienteLu: "G28", protoFinalCorrienteLv: "G29", protoFinalCorrienteLw: "G30", protoFinalMedicionPolos: "G31",
  protoFinalObservacion: "F33",
};

const MAPEOS = {
  suministro: {
    campos: {
      ...CAMPOS_ENCABEZADO_SERVICIO,
      equipoMarca: "A15", modelo: "C15", potenciaComponente: "E15", cantidadComponente: "F15",
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: {
          item1: "F47", item2: "F48", item3: "F49", item4: "F50", item5: "F51", item6: "F52", item7: "F53",
        },
      },
    },
    bullets: { recomendaciones: { col: "A", fila: 55, max: 2 } },
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

  diagnostico_equipo: {
    campos: {
      ...CAMPOS_ENCABEZADO_SERVICIO,
      equipoMarca: "C15", modelo: "D15", codigo: "E15", tag: "F15", potencia: "G15", serie: "H15",
      observacionIngreso: "G16",
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`item${i + 1}`, `H${58 + i}`])),
      },
    },
    bullets: {
      observacionFallas: { col: "A", fila: 71, max: 3 },
      recomendacion: { col: "A", fila: 75, max: 4 },
    },
    // "Estado general" ya no es texto libre — se migró a 8 slots de foto
    // fijos, ver SLOTS_FOTOS.diagnostico_equipo. La medición de diodos IGBT
    // y piezas a reemplazar (con sus observaciones) siguen sin celda
    // confirmada — caen al bloque anexo (no se pierde el dato, solo no
    // queda en su celda "de papel").
  },

  diagnostico_servomotor: {
    campos: {
      ...CAMPOS_ENCABEZADO_SERVICIO,
      equipoMarca: "C15", modelo: "D15", codigo: "E15", tag: "F15", potencia: "G15", serie: "H15",
      observacionIngreso: "G16",
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`item${i + 1}`, `H${52 + i}`])),
      },
    },
    bullets: {
      observacionFallas: { col: "A", fila: 66, max: 3 },
      actividadesARealizar: { col: "A", fila: 70, max: 4 },
    },
    // "Estado general" ya no es texto libre — se migró a 8 slots de foto
    // fijos, ver SLOTS_FOTOS.diagnostico_servomotor. Piezas a reemplazar
    // sigue sin celda confirmada, cae al anexo.
  },

  tarjetas: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 43, max: 4 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i, 49 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      conclusiones: { col: "A", fila: 58, max: 2 },
      recomendaciones: { col: "A", fila: 61, max: 2 },
    },
  },

  pc: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 64, max: 4 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [i, 70 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      conclusiones: { col: "A", fila: 80, max: 2 },
      recomendaciones: { col: "A", fila: 83, max: 2 },
    },
  },

  panel: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 64, max: 4 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i, 70 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observaciones: { col: "A", fila: 79, max: 1 },
      conclusiones: { col: "A", fila: 81, max: 2 },
      recomendaciones: { col: "A", fila: 84, max: 2 },
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
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`item${i + 1}`, `H${24 + i}`])),
      },
    },
    bullets: { recomendaciones: { col: "A", fila: 32, max: 5 } },
  },

  plc: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 64, max: 4 },
    },
    tabla: {
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [i, 70 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observaciones: { col: "A", fila: 79, max: 1 },
      conclusiones: { col: "A", fila: 81, max: 2 },
      recomendaciones: { col: "A", fila: 84, max: 2 },
    },
  },

  arrancador: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL, ...CAMPOS_PROTOCOLO_ESTANDAR },
    filas: {
      piezasAReemplazar: { colCantidad: "F", colDescripcion: "G", filaInicial: 101, max: 3 },
    },
    tabla: {
      medicionScr: {
        scr1__gateAnode: "B101", scr1__gateCathode: "C101",
        scr2__gateAnode: "B102", scr2__gateCathode: "C102",
        scr3__gateAnode: "B103", scr3__gateCathode: "C103",
      },
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 13 }, (_, i) => [i, 108 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observacionesScr: { col: "A", fila: 105, max: 1 },
      observaciones: { col: "A", fila: 122, max: 1 },
      conclusiones: { col: "A", fila: 124, max: 3 },
      recomendaciones: { col: "A", fila: 128, max: 2 },
    },
  },

  variador_reparacion: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL, ...CAMPOS_PROTOCOLO_ESTANDAR },
    filas: {
      piezasAReemplazar: { colCantidad: "F", colDescripcion: "G", filaInicial: 101, max: 7 },
    },
    tabla: {
      medicionIgbtIngreso: { l1__dcMenos: "B101", l1__dcMas: "C101", l2__dcMenos: "B102", l2__dcMas: "C102", l3__dcMenos: "B103", l3__dcMas: "C103" },
      medicionIgbtSalida: { u__dcMenos: "B105", u__dcMas: "C105", v__dcMenos: "B106", v__dcMas: "C106", w__dcMenos: "B107", w__dcMas: "C107" },
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i, 112 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observacionesIgbt: { col: "A", fila: 109, max: 1 },
      observaciones: { col: "A", fila: 125, max: 1 },
      conclusiones: { col: "A", fila: 127, max: 3 },
      recomendaciones: { col: "A", fila: 131, max: 2 },
    },
  },

  ups: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL, ...CAMPOS_PROTOCOLO_ESTANDAR },
    tabla: {
      medicionBaterias: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [i, 101 + i]).flatMap(([i, fila]) => [
          [`bateria${i + 1}__nominal`, `B${fila}`], [`bateria${i + 1}__real`, `C${fila}`],
        ])
      ),
      checklistTecnico: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i, 114 + i]).flatMap(([i, fila]) => [
          [`item${i + 1}__inicial`, `H${fila}`], [`item${i + 1}__final`, `I${fila}`],
        ])
      ),
    },
    bullets: {
      observaciones: { col: "A", fila: 127, max: 1 },
      conclusiones: { col: "A", fila: 129, max: 3 },
      recomendaciones: { col: "A", fila: 133, max: 2 },
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
  servomotor: {
    campos: {
      ...CAMPOS_ENCABEZADO_SERVICIO,
      equipoMarca: "C15", modelo: "D15", tag: "E15", potencia: "F15", voltaje: "G15", rpm: "H15", serie: "I15",
      ...CAMPOS_PROTOCOLO_SERVOMOTOR,
      // "MARCA"/"MODELO"/"VOLTAJE" ya vienen impresos en G186/G187/G188 —
      // solo hace falta el valor, en la celda merge H186:I186 etc.
      placaMarca: "H186", placaModelo: "H187", placaVoltaje: "H188",
    },
    filas: {
      piezasAReemplazar: { colCantidad: "A", colDescripcion: "B", filaInicial: 37, max: 4 },
    },
    // Los 3 checklists confirmados celda por celda contra la plantilla
    // real: etiqueta fusionada A:H, valor en la columna I (única celda sin
    // fusionar de la fila) — mismo layout en los 3, sólo cambia la fila
    // inicial. Las claves (`insp_item1`...) deben coincidir con el
    // prefijo pasado a `checklistOkNok` en informesTecnicos.js.
    checklist: {
      "Checklist — Inspección visual y medición básica": {
        items: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`insp_item${i + 1}`, `I${43 + i}`])),
      },
      "Checklist del proceso desarmado": {
        items: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`desarme_item${i + 1}`, `I${66 + i}`])),
      },
      "Checklist del proceso de armado": {
        items: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`armado_item${i + 1}`, `I${88 + i}`])),
      },
    },
    // "Operario"/"Observación de ingreso" (fila 16) no tienen una celda de
    // input distinguible del rótulo en esta plantilla (D16:I16 es todo el
    // rótulo "OBSERVACION" fusionado, sin una celda en blanco aparte) —
    // caen al anexo, igual que el resto del formulario de este tipo.
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
  suministro: ["B23:E34"],
  soporte: { A: "A23:B37", B: "C23:D37", C: "E23:F37", D: "G23:H37" },
  diagnostico_equipo: {
    vistaFrontal: "A18:B29", placa: "C18:D29", estadoInterno1: "E18:F29", estadoInterno2: "G18:H29",
    estadoCarcasa: "A31:B42", estadoTarjeta: "C31:D42", componentesMalEstado: "E31:F42", estadoVentiladores: "G31:H42",
  },
  diagnostico_servomotor: {
    vistaFrontal: "A18:B29", placa: "C18:D29", estadoCarcasa: "E18:F29", estadoEncoder: "G18:H29",
    estadoInterno: "A31:B42", conectores: "C31:D42", estadoRodamientos: "E31:F42", pruebaEquipo: "G31:H42",
  },
  tarjetas: { imagenA: "A19:C38", imagenB: "D19:F38", imagenC: "G19:I38" },
  pc: {
    vistaFrontal: "A19:C38", placaEquipo: "D19:F38", carcasaContaminada: "G19:I38",
    carcasaDescontaminada: "A40:C59", limpiezaTarjetaInicial: "D40:F49", limpiezaTarjetaFinal: "D50:F59",
    cambioVentilador: "G40:I59",
  },
  panel: {
    vistaFrontal: "A19:C38", placaEquipo: "D19:F38",
    carcasaContaminada: "G19:I28", carcasaDescontaminada: "G29:I38",
    limpiezaTarjetaInicial: "A40:C49", limpiezaTarjetaFinal: "A50:C59",
    cambioLcdInicial: "D40:F49", cambioLcdFinal: "D50:F59",
    cambioTouchInicial: "G40:I49", cambioTouchFinal: "G50:I59",
  },
  // Recuadro subió con el resto del contenido (ver comentario en MAPEOS.adicional)
  // — inferido por el hueco entre la fila 8 (spacer) y el rótulo "VISTA FRONTAL..."
  // en la fila 21 (ahora DEBAJO del recuadro, no encima como en las demás
  // plantillas); no confirmado visualmente con una foto real insertada.
  adicional: { vistaFrontalComponente: "A9:D20", vistaFrontalEquipo: "E9:H20" },
  plc: {
    vistaFrontal: "A19:C38", placaEquipo: "D19:F38", carcasaContaminada: "G19:I38",
    carcasaDescontaminada: "A40:C59", limpiezaTarjetaInicial: "D40:F49", limpiezaTarjetaFinal: "D50:F59",
    cambioComponentes: "G40:I59",
  },
  arrancador: {
    vistaFrontal: "A35:C54", placaEquipo: "D35:F54", carcasaContaminada: "G35:I54",
    carcasaDescontaminada: "A56:C75", limpiezaContaminada: "D56:F65", limpiezaDescontaminada: "D66:F75",
    pastaTermicaSeca: "G56:I65", pastaTermicaNueva: "G66:I75",
    cambioVentilador: "A77:C96", cambioComponentesInicial: "D77:F86", cambioComponentesFinal: "D87:F96",
    medicionScrInicial: "G77:I86", medicionScrFinal: "G87:I96",
    ...RANGOS_PRUEBA_EQUIPO,
  },
  variador_reparacion: {
    vistaFrontal: "A35:C54", placaEquipo: "D35:F54", carcasaContaminada: "G35:I54",
    carcasaDescontaminada: "A56:C75", tarjetaContaminada: "D56:F65", tarjetaDescontaminada: "D66:F75",
    pastaTermicaSeca: "G56:I65", pastaTermicaNueva: "G66:I75",
    cambioVentilador: "A77:C96", cambioComponentesInicial: "D77:F86", cambioComponentesFinal: "D87:F96",
    medicionIgbtFotoInicial: "G77:I86", medicionIgbtFotoFinal: "G87:I96",
    ...RANGOS_PRUEBA_EQUIPO,
  },
  ups: { ...RANGOS_PRUEBA_EQUIPO },
  servomotor: {
    estadoEjeRotor: "A128:B139", asientoRodamientoDelantero: "C128:D139", estadoNucleoRotor: "E128:G139", asientoTrasero: "H128:I139",
    estadoChaveteroChaveta: "A141:B154", rodamientoDelantero: "C141:D154", fotoOriginalRotor: "E141:G154", rodamientoTrasero: "H141:I154",
    evidenciaA: "A156:B167", evidenciaB: "C156:D167", evidenciaC: "E156:G167", evidenciaD: "H156:I167",
    vistaFrontalEquipo: "A169:C188", placaEquipoFoto: "D169:F188", fotoEncoder: "G169:I185",
    cambioRodamientosFoto: "A190:C209", estadoInternoEquipoInicial: "D190:F209", estadoInternoEquipoFinal: "G190:I209",
    ...RANGOS_PRUEBA_EQUIPO,
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
        const bufferImg = await resImg.arrayBuffer();
        const imageId = wb.addImage({ buffer: bufferImg, extension });
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
          const dim = await dimensionesImagen(bufferImg, extension);
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

  const nombreArchivo = `${def.label} - ${ot?.codigo || informe.codigo || "informe"}.xlsx`;
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
