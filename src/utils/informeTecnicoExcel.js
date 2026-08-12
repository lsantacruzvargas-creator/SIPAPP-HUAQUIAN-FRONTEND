import ExcelJS from "exceljs";
import JSZip from "jszip";
import { tipoInformePorValor, claveChecklist } from "./informesTecnicos";
import { imgUrl } from "./fetchAuth";

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

// Direcciones de celda mapeadas celda-por-celda contra las plantillas reales
// (dumps exhaustivos con la librería xlsx sobre los archivos de
// Frontend/informes/, cruzando la versión rellenada de ejemplo con la
// versión en blanco para separar etiqueta de valor). "bombas" y
// "protocolo_jaula_ardilla" están verificados contra un caso real relleno
// (alta confianza). "bobina_estator_mtto"/"bobina_estator_rebo" se derivan
// de los merges de la plantilla en blanco (alta confianza en encabezado y
// tablas; los 6 valores de "megadoBobina" son mejor esfuerzo porque esa
// zona es un gráfico de megado, no una celda simple). "tecnico_mantenimiento"
// usa la plantilla construida desde cero en esta sesión, así que es exacta
// por diseño. Un campo/ítem/celda que no aparece acá simplemente no tiene
// posición conocida en la plantilla — su valor igual se garantiza en el
// bloque "DATOS CAPTURADOS" que se anexa más abajo.
const MAPEOS = {
  bombas: {
    // Remapeado el 2026-07-22 (segunda vez): la plantilla recibió otro
    // ajuste de encabezado/pie que eliminó la columna decorativa de
    // numeración (antes B) — todo el contenido real corrió 1 columna a la
    // izquierda, MISMA fila (verificado celda por celda contra los merges
    // actuales). La sección de evidencias además corrió +1 fila.
    campos: {
      cliente: "F12", equipo: "F13", referencia: "AH12", ot: "AW12", nGuia: "AG13",
      oc: "AS13", indicacionesCliente: "L14", recepcion: "AT14",
      marca: "G18", modelo: "G19", hp: "G20", nSerie: "G21", rpm: "G22", peso: "G23",
    },
    checklist: {
      "2. Revisión mecánica": {
        hechoPor: "I26", fecha: "X26",
        items: {
          tapasLT: "G30", tapasLOT: "O30", guarda: "G31", impulsor: "G32", acople: "G33",
          contratapaLT: "I34", contratapaLOT: "P34", selloMecanico: "I35",
          rodamientosLT: "I36", rodamientosLOT: "R36",
          soportesEjeLT: "J37", soportesEjeLOT: "R37",
          anilloLT: "H38", anilloLOT: "M38",
          vRingLT: "G39", vRingLOT: "M39",
          retenLT: "G40", retenLOT: "M40",
        },
      },
    },
    bullets: {
      observaciones: { col: "E", fila: 43, max: 20 },
      resumenTrabajo: { col: "E", fila: 65, max: 10 },
      recomendaciones: { col: "E", fila: 76, max: 3 },
    },
    evidencias: {
      evidencias: ["D94", "U94", "AL94", "D115", "U115", "AL115", "D136", "U136", "AL136"],
    },
    footer: { hechoPor: "G79", vB: "AB79", fecha: "AY79" },
  },

  protocolo_jaula_ardilla: {
    // Los encabezados de las páginas de evidencias (G77/G150, AI77/AI150,
    // etc.) son fórmulas ="=G4" etc. en la propia plantilla — se actualizan
    // solas al escribir la celda principal, no hace falta repetirlas acá.
    //
    // Remapeado el 2026-07-21: la plantilla real recibió un encabezado
    // nuevo que corrió +8 filas la mayor parte del bloque de datos/
    // checklist/tablas/bullets/footer (verificado celda por celda contra
    // los merges reales de Frontend/public/informes-templates/).
    //
    // Actualizado el 2026-07-22: el resto de la plantilla no volvió a
    // moverse (mismas celdas que el remapeo anterior), pero el usuario
    // reemplazó en la plantilla real el bloque "Datos de bobina
    // (recepción)" por "Evaluación de núcleo magnético" (mismo lugar,
    // filas 31-35, columnas E-AB) — el formulario en informesTecnicos.js
    // se actualizó para reflejar los campos nuevos. Las evidencias también
    // se reacomodaron: recepción +1 fila, salida +2 filas respecto al
    // remapeo anterior.
    campos: {
      cliente: "G12", equipo: "G13",
      referencia: "AI12", ot: "AX12",
      nGuia: "AH13", oc: "AT13",
      indicacionesCliente: "M18", recepcion: "AU18",
      marca: "G14", nSerie: "G15", codigo: "G16",
      ip: "AA14", potenciaKw: "AD15", tensionV: "AC16", corrienteA: "AO14", cosphi: "AX14",
      frecuenciaHz: "AP15", nSalidas: "AZ15", rpm: "AL16", conexion: "AZ16",
      bornera: "AH17", cajaBornes: "W17", conexIngreso: "AX17",
      tiempoPrueba: "K32", comentarios: "R33", voltajeInducido: "K33",
      areaCalentamiento: "L34", kGauss: "H35",
      conclusionRecepcion: "J29", conclusionVibracionRecepcion: "J42",
      vNom: "G54", iNom: "Q54", conexionSal: "Z54",
      rpmSalida: "G59", ivIn: "Y59",
    },
    checklist: {
      "4. Revisión mecánica": {
        hechoPor: "AJ21", fecha: "AY21",
        items: {
          canalizacionMediante: "AM23",
          posicionTrabajo: "AK25",
          tapasLT: "AH26", tapasLOT: "AP26", fundaLOT: "AH27",
          contratapaLT: "AS27", contratapaLOT: "AY27",
          soportesEjeLT: "AJ28", soportesEjeLOT: "AP28",
          ventiladorLOT: "AJ29", chaveta1: "AQ29",
          cargaLT: "AH30", chaveta2: "AT30",
          rodamientosLT: "AJ31", rodamientosLOT: "AS31",
          anilloLanLT: "AH32", anilloLanLOT: "AN32",
          vRingLT: "AH33", vRingLOT: "AN33",
          retenLT: "AH34", retenLOT: "AN34",
        },
      },
    },
    tabla: {
      aislamientoRecepcion: {
        hechoPor: "J21", fecha: "Y21",
        bornes1m__aMasa: "K25", bornes1m__entreFases: "T25",
        bornes2m__aMasa: "N25", bornes2m__entreFases: "W25",
        bornes3m__aMasa: "Q25", bornes3m__entreFases: "Z25",
      },
      resistenciaRecepcion: {
        resistencia__c14: "K28", resistencia__c25: "Q28", resistencia__c36: "W28",
      },
      vibracionRecepcion: {
        horizontal__lt: "L39", horizontal__lot: "R39",
        vertical__lt: "L40", vertical__lot: "R40",
        axial__lt: "L41", axial__lot: "R41",
      },
      aislamientoSalida: {
        hechoPor: "J45", fecha: "Y45",
        bornes1m__aMasa: "K49", bornes1m__entreFases: "T49",
        bornes2m__aMasa: "N49", bornes2m__entreFases: "W49",
        bornes3m__aMasa: "Q49", bornes3m__entreFases: "Z49",
      },
      resistenciaSalida: {
        resistencia__c14: "K52", resistencia__c25: "Q52", resistencia__c36: "W52",
      },
      pruebaMotorTabla: {
        tension__c12: "K57", tension__c23: "Q57", tension__c31: "W57",
        amperaje__c12: "K58", amperaje__c23: "Q58", amperaje__c31: "W58",
      },
    },
    bullets: {
      resumenTrabajo: { col: "F", fila: 63, max: 11 },
      recomendaciones: { col: "F", fila: 76, max: 3 },
    },
    evidencias: {
      evidenciasRecepcion: ["E94", "V94", "AM94", "E115", "V115", "AM115", "E136", "V136", "AM136"],
      evidenciasSalida: ["E172", "V172", "AM172", "E193", "V193", "AM193", "E214", "V214", "AM214"],
    },
    footer: { hechoPor: "H79", vB: "AC79", fecha: "AZ79" },
  },

  bobina_estator_mtto: {
    // Remapeado el 2026-07-22: la plantilla real recibió un encabezado que
    // corrió +1 fila (y en varios casos +2 columnas, ej. E→G) todo el
    // bloque de datos/tabla/bullets (verificado celda por celda contra los
    // merges reales de Frontend/public/informes-templates/).
    campos: {
      cliente: ["G12", "G76"], equipo: ["G11", "G75"], planta: ["V11", "V75"],
      tecnico: ["V12", "V76"], ot: ["AI12", "AI76"],
      marca: "G18", potencia: "G19", rpm: "G20", modelo: "G21", nEquipo: "G22",
    },
    tabla: {
      // Zona de gráfico de megado en la plantilla real (no una grilla de
      // celdas simple) — se ubica el valor capturado justo debajo de cada
      // rótulo de fase como mejor esfuerzo. Remapeado el 2026-07-22: los
      // rótulos de fase se corrieron +8 filas (95→103, 111→119, 127→135),
      // así que estas posiciones "debajo del rótulo" también +8.
      megadoBobina: {
        fase1Tierra__valor: "B105", fase2Tierra__valor: "S105",
        fase3Tierra__valor: "B121", fase12__valor: "S121",
        fase23__valor: "B137", fase13__valor: "S137",
      },
    },
    bullets: {
      resumen: { col: "C", fila: 49, max: 7 },
      recomendaciones: { col: "C", fila: 62, max: 3 },
    },
    // Esta plantilla no tiene ningún bloque "Hecho por/V.B./Fecha" impreso
    // (confirmado revisando las 199 filas de la hoja) — la firma queda en
    // el bloque anexo en vez de escribirse sobre celdas sin etiqueta.
  },

  bobina_estator_rebo: {
    // Remapeado el 2026-07-22: mismo tipo de ajuste que en
    // bobina_estator_mtto (encabezado nuevo, +1 fila en la mayoría de
    // campos, columnas ligeramente distintas por cambios de ancho de
    // etiqueta) — verificado celda por celda contra los merges reales.
    //
    // cliente/equipo/planta/tecnico/ot: solo la posición de la 1ra página
    // (antes también escribía en una 2da posición, pensada como el
    // encabezado repetido de la página 2 — pero esa zona quedó pegada al
    // banner "MEGADO DE BOBINA" en la plantilla real y el dato se veía
    // metido ahí; pedido explícito del usuario para que el encabezado solo
    // aparezca en la primera hoja).
    campos: {
      cliente: "G12", equipo: "G11", planta: "V11",
      tecnico: "V12", ot: "AI12",
      marca: "H18", potencia: "H19", rpm: "H20", modelo: "H21", nEquipo: "H22",
      pase: "F43", nSalidas: "P43", alambre: "G44", kgAlambre: "Q44",
      vueltas: "G45", papelNomex: "Q45", conexion: "H46",
      gruposBobinas: "K47", bobinasGrupo: "K48",
    },
    tabla: {
      pruebasResistencia: { l14__valor: "I29", l36__valor: "O29", l25__valor: "I30", tierra__valor: "O30" },
      aislamientoIngreso: {
        fase12__valor: "I33", f1Tierra__valor: "O33",
        fase23__valor: "I34", f2Tierra__valor: "O34",
        fase31__valor: "I35", f3Tierra__valor: "O35",
      },
      aislamientoSalida: {
        fase12__valor: "I38", f1Tierra__valor: "O38",
        fase23__valor: "I39", f2Tierra__valor: "O39",
        fase31__valor: "I40", f3Tierra__valor: "O40",
      },
    },
    bullets: {
      diagnostico: { col: "U", fila: 37, max: 5 },
      conclusiones: { col: "U", fila: 43, max: 5 },
    },
    // Igual que en bobina_estator_mtto: no existe bloque de firma impreso
    // en esta plantilla — queda en el bloque anexo.
  },

  // Plantilla real "CAJA REDUCTORA EN MTTO.xlsx" (encontrada por el usuario
  // en Frontend/informes/) — reemplaza la plantilla que se había armado
  // desde cero a partir del PDF. Mapeada celda por celda contra el XML
  // crudo (estilo de cada celda), no contra un ejemplo relleno.
  //
  // Remapeado el 2026-07-21: igual que "bombas", esta plantilla recibió un
  // encabezado nuevo que corrió +6 filas todo el bloque de datos/checklist/
  // bullets/footer (verificado celda por celda, incluyendo merges, contra
  // el dump de la plantilla actual en Frontend/public/informes-templates/).
  tecnico_mantenimiento: {
    campos: {
      cliente: "G11", equipo: "G12", referencia: "AE11", ot: "AY11",
      nGuia: "AE12", oc: "AU12", indicacionesCliente: "O15",
      placa: "I18", marca: "I19", nSerie: "I20", tipoEquipo: "I21",
    },
    checklist: {
      "Revisión mecánica": {
        hechoPor: "I24", fecha: "X24",
        items: {
          engranaje: "K25", ejeSinFin: "K26", tapasRodajes: "K27", rodamientos: "K28",
          canalChavetero: "K29", chaveta: "K30", retenes: "K31", tapaCiega: "K32",
        },
      },
    },
    bullets: {
      observaciones: { col: "F", fila: 35, max: 3 },
      procesoTrabajo: { col: "F", fila: 72, max: 3 },
      recomendaciones: { col: "F", fila: 77, max: 1 },
    },
    // El bloque "HECHO POR / V.B. / FECHA" se repite idéntico al final de
    // cada una de las 4 páginas de la plantilla (80/160/240/320), pero acá
    // NO son fórmulas que copian la fila 80 (a diferencia de "bombas" y
    // "protocolo_jaula_ardilla", que sí usan "=H79") — son celdas sueltas e
    // independientes, hay que escribir el mismo valor en las 4.
    footer: {
      hechoPor: ["I80", "I160", "I240", "I320"],
      vB: ["AD80", "AD160", "AD240", "AD320"],
      fecha: ["AZ80", "AZ160", "AZ240", "AZ320"],
    },
  },
};

// Tipos donde el bloque anexo "DATOS ADICIONALES" no debe mostrar el
// listado de fotos sin título ("Evidencia de los trabajos") ni la "Firma"
// — pedido explícito del usuario para que en el Excel de bobina de estator
// solo queden las imágenes, sin texto sobrante debajo. Las fotos en sí se
// siguen insertando igual (esa inserción no depende de este bloque).
const SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA = new Set(["bobina_estator_mtto", "bobina_estator_rebo"]);

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
  // V.B. / Fecha" (ej. bobina_estator_mtto/rebo no lo traen), no se pierde
  // el dato — cae acá igual que cualquier otro campo sin celda mapeada.
  // Excepción: bobina_estator_mtto/rebo la omiten a propósito (ver
  // SIN_TEXTO_ANEXO_EVIDENCIAS_FIRMA).
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
  // última columna real de la plantilla (ej. en "bombas" la última es BC,
  // así que las fotos anclan en BG), fuera del área impresa, en vez de en
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
          const resImg = await fetch(imgUrl(ruta));
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
