import ExcelJS from "exceljs";
import JSZip from "jszip";
import { tipoInformePorValor, claveChecklist } from "./informesTecnicos";
import { fetchUpload } from "./fetchAuth";

// exceljs solo puede incrustar estos 3 formatos — si la foto subida es de
// otro tipo (ej. webp/heic) se omite del Excel (sigue disponible en la app).
const EXTENSION_SOPORTADA = (ruta) => {
  const ext = (ruta.split(".").pop() || "").toLowerCase();
  if (ext === "jpg") return "jpeg";
  if (["jpeg", "png", "gif"].includes(ext)) return ext;
  return null;
};

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
    // "Estado general" (carcasa/tarjeta/componentes/ventiladores), la
    // medición de diodos IGBT, piezas a reemplazar y sus observaciones no
    // quedaron con posición de celda confirmada sin abrir el archivo en
    // Excel — caen al bloque anexo (no se pierde el dato, solo no queda en
    // su celda "de papel").
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
    // "Estado general" y piezas a reemplazar: mismo caso que en
    // diagnostico_equipo, caen al anexo.
  },

  tarjetas: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
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

  adicional: {
    campos: {
      ...CAMPOS_ENCABEZADO_SERVICIO,
      componenteMarca: "A15", componenteModelo: "B15", componentePotencia: "C15", componenteCantidad: "D15",
      equipoMarca: "E15", equipoModelo: "F15", equipoPotencia: "G15", equipoCantidad: "H15",
    },
    checklist: {
      "Checklist de verificación técnica": {
        items: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`item${i + 1}`, `H${32 + i}`])),
      },
    },
    bullets: { recomendaciones: { col: "A", fila: 40, max: 4 } },
  },

  plc: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
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
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
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
    // Protocolo de prueba inicial/final y piezas a reemplazar: la zona de
    // celdas (filas 19-33) corresponde a un bloque combinado más complejo
    // que un input por fila — no se pudo confirmar la celda exacta de cada
    // valor sin abrir el archivo en Excel. Caen al anexo.
  },

  variador_reparacion: {
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
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
    campos: { ...CAMPOS_ENCABEZADO_SERVICIO, ...CAMPOS_EQUIPO_9COL },
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

// Para campos/checklist/tabla, una sección puede tener SOLO ALGUNOS de sus
// elementos mapeados (ej. un ítem de checklist sin celda propia en la
// plantilla real) — esta función devuelve nada más los pares [label, valor]
// de lo que efectivamente NO tiene celda, para no duplicar en el bloque
// anexo lo que ya se escribió con precisión.
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
    } else if (seccion.tipo === "evidencias") {
      const slots = mapa.evidencias?.[seccion.clave];
      if (!slots) return;
      const grupos = campos[seccion.clave] || [];
      grupos.slice(0, slots.length).forEach((g, i) => escribir(slots[i], g.titulo));
    }
  });

  const fechaFormateada = informe.fecha ? new Date(informe.fecha).toLocaleDateString("es-PE") : "";
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
    } else if (seccion.tipo === "evidencias") {
      const slots = mapa.evidencias?.[seccion.clave];
      const grupos = campos[seccion.clave] || [];
      if (!slots) {
        if (!SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA.has(informe.tipo)) {
          bloques.push([seccion.titulo, grupos.map((g) => [g.titulo || "(sin título)", `${g.imagenes?.length || 0} foto(s)`])]);
        }
      } else if (grupos.length > slots.length) {
        bloques.push([`${seccion.titulo} (grupos adicionales)`, grupos.slice(slots.length).map((g) => [g.titulo || "(sin título)", `${g.imagenes?.length || 0} foto(s)`])]);
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
  // El tamaño se fija (no se lee el ancho/alto real de cada foto) para no
  // tener que decodificar la imagen; queda una distorsión leve si la foto
  // no es 4:3, aceptable para este flujo de "colocar y luego acomodar".
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

  const gruposConFotos = [];
  def.secciones.forEach((seccion) => {
    if (seccion.tipo !== "evidencias") return;
    (campos[seccion.clave] || []).forEach((g) => {
      if (g.imagenes?.length) gruposConFotos.push({ titulo: g.titulo || seccion.titulo, imagenes: g.imagenes });
    });
  });

  if (gruposConFotos.length) {
    // Arranca en una fila fija (6), independiente de dónde haya terminado
    // el bloque de texto "DATOS ADICIONALES" — antes las fotos seguían
    // acumulándose después de ese bloque y terminaban muy abajo ("al final
    // de la hoja") cuando el informe tenía muchos datos sin celda mapeada.
    // Al estar en una columna bien a la derecha del contenido real (ver
    // COL_FOTOS arriba), la fila 6 siempre está libre ahí sin importar el
    // tipo de informe.
    let filaFotos = 6;
    escribirFilaDerecha(filaFotos, "FOTOS ADJUNTAS (arrastrar a la posición final)");
    filaFotos += 2;
    for (const grupo of gruposConFotos) {
      for (const ruta of grupo.imagenes) {
        const extension = EXTENSION_SOPORTADA(ruta);
        if (!extension) { console.warn("Formato de imagen no soportado para Excel:", ruta); continue; }
        try {
          const resImg = await fetchUpload(ruta);
          const bufferImg = await resImg.arrayBuffer();
          const imageId = wb.addImage({ buffer: bufferImg, extension });
          escribirFilaDerecha(filaFotos, grupo.titulo);
          ws.addImage(imageId, {
            tl: { col: COL_FOTOS_IDX0, row: filaFotos }, // filaFotos es 1-indexado pero el anchor espera 0-indexado
            ext: { width: 260, height: 195 },
          });
          filaFotos += 11;
        } catch (err) {
          console.warn("No se pudo insertar la imagen en el Excel:", ruta, err.message);
        }
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
