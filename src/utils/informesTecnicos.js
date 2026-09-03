// Config-driven: cada tipo de informe técnico define sus secciones/campos
// acá (mismo principio que catalogoServicios.js) — FormInformeTecnico.jsx
// y VistaInformeTecnico.jsx son genéricos, leen esta estructura y no
// hardcodean nada por tipo. Los `clave` de cada campo son las llaves que
// se guardan en `InformeTecnico.campos` (Backend/src/models/InformeTecnico.js)
// y las que usa informeTecnicoExcel.js para mapear a celdas de la plantilla.
//
// Tipos de sección soportados por el renderer genérico:
//   campos     — inputs simples (texto/fecha), en grilla
//   checklist  — pares label+input (con "Hecho por"/"Fecha" opcional arriba)
//   bullets    — lista dinámica de líneas de texto ("+ agregar línea")
//   tabla      — grilla de lecturas numéricas (filas x columnas)
//   evidencias — grupos de fotos con leyenda propia (cámara o galería)

// Algunos títulos de checklist traen numeración con punto (ej. "2. Revisión
// mecánica") — MongoDB descarta en silencio cualquier clave de objeto que
// contenga un "." (se probó contra la base real: los ítems del checklist
// sin punto en el título se guardan bien, pero "hechoPor"/"fecha" del
// encabezado, que usan el título completo como parte de la clave, nunca
// llegaban a persistirse). Se usa esta función en vez del título crudo en
// todos los lugares que arman la clave de `campos` para ese par.
export const claveChecklist = (titulo) => titulo.replace(/\./g, "");

// Encabezado "INFORME DE SERVICIO" — común a las 13 plantillas nuevas
// (Frontend/public/informes-templates/). El campo "TIPO" del papel (C9) en
// varias plantillas ya trae un valor fijo impreso (ej. "VARIADORES",
// "PANEL") — se deja igual como `categoria` acá: si el técnico no lo toca,
// el exportador simplemente no sobrescribe esa celda (ver `escribir()` en
// informeTecnicoExcel.js, que ignora valores vacíos) y el texto impreso
// de la plantilla queda tal cual.
const CAMPOS_HEADER_SERVICIO = [
  { clave: "empresa", label: "Empresa / Cliente" },
  { clave: "contacto", label: "Contacto" },
  { clave: "ordenCompra", label: "Orden de Compra" },
  { clave: "cot", label: "COT" },
  { clave: "lineaArea", label: "Línea / Área" },
  { clave: "descripcion", label: "Descripción" },
  { clave: "categoria", label: "Tipo" },
  { clave: "cantidad", label: "Cantidad" },
  { clave: "fecha", label: "Fecha" },
];

// SERVICIO DE SOPORTE es la única plantilla con Fecha inicio/término en vez
// de una sola Fecha.
const CAMPOS_HEADER_SOPORTE = [
  ...CAMPOS_HEADER_SERVICIO.slice(0, -1),
  { clave: "fechaInicio", label: "Fecha inicio" },
  { clave: "fechaTermino", label: "Fecha término" },
];

// "DATOS DEL EQUIPO" — set base de 6 campos que se repite (con variaciones
// puntuales de 1-2 columnas) en casi todas las plantillas.
const CAMPOS_EQUIPO_ESTANDAR = [
  { clave: "equipoMarca", label: "Equipo / Marca" },
  { clave: "modelo", label: "Modelo" },
  { clave: "codigo", label: "Código" },
  { clave: "tag", label: "TAG" },
  { clave: "potencia", label: "Potencia" },
  { clave: "serie", label: "S/N" },
];

const CAMPOS_OPERARIO = [
  { clave: "operario", label: "Operario" },
  { clave: "observacionIngreso", label: "Observación de ingreso" },
];

const BULLETS_ESTANDAR = (clave, titulo, simbolo = "▫") => ({
  tipo: "bullets", titulo, clave, simbolo,
});

// Checklist "de una sola columna" (# | Descripción | OK/NOK) — el técnico
// escribe OK/NOK/NA en un solo input por ítem.
// `prefijoClave` opcional: por defecto los ítems se llaman "item1",
// "item2"... — funciona bien cuando el tipo de informe tiene un solo
// checklist de este tipo (el caso común). Un tipo con VARIAS secciones
// checklist independientes en el mismo form (ej. servomotor: inspección
// visual / desarmado / armado) DEBE pasar un prefijo distinto a cada una
// — si no, los 3 "item1" comparten la misma llave en `campos` y cambiar
// un selector de una sección pisa el valor de las otras 2 (bug real,
// reportado por el usuario). No se cambió el default sin prefijo para no
// alterar la clave de los tipos que ya tenían un solo checklist (evita
// romper informes ya guardados con esas claves).
const checklistSimple = (titulo, items, prefijoClave = "") => ({
  tipo: "checklist", titulo,
  items: items.map((label, i) => ({ clave: `${prefijoClave}item${i + 1}`, label })),
});

// Variante de `checklistSimple` con selector OK/NOK en vez de texto libre —
// mismo shape, solo agrega `opciones` (el renderer genérico la usa para
// decidir <select> vs <input>, ver SeccionChecklist en FormInformeTecnico.jsx).
const checklistOkNok = (titulo, items, prefijoClave) => ({ ...checklistSimple(titulo, items, prefijoClave), opciones: ["OK", "NOK"] });

// Checklist "de doble columna" (# | Descripción | OK/NOK Inicial | OK/NOK
// Final) — usa el tipo "tabla" del renderer genérico (grilla filas x
// columnas) porque "checklist" solo soporta un input por ítem.
const checklistDoble = (titulo, clave, items) => ({
  tipo: "tabla", titulo, clave,
  columnas: [{ clave: "inicial", label: "OK/NOK Inicial" }, { clave: "final", label: "OK/NOK Final" }],
  filas: items.map((label, i) => ({ clave: `item${i + 1}`, label })),
});

// Variante de `checklistDoble` con selector OK/NOK en ambas columnas en vez
// de texto libre — mismo shape, solo agrega `opciones` (el renderer
// genérico la usa para decidir <select> vs <input>, ver SeccionTabla en
// FormInformeTecnico.jsx).
const checklistDobleOkNok = (titulo, clave, items) => ({ ...checklistDoble(titulo, clave, items), opciones: ["OK", "NOK"] });

const EVIDENCIAS_ESTANDAR = { tipo: "evidencias", titulo: "Evidencias fotográficas", clave: "evidencias" };

// "Protocolo de prueba inicial / final" (arrancador, variador_reparacion,
// ups, servomotor): la plantilla real trae 2 tablas independientes lado a
// lado, cada una con sus propios valores — nunca un solo set compartido.
// Antes esto era UNA sola sección con un input por etiqueta (sin distinguir
// inicial de final), por eso nunca tuvo celda mapeada en el Excel: no había
// forma de saber a cuál de las 2 tablas iba cada valor. `PROTOCOLO_PRUEBA`
// genera una sección independiente por variante ("inicial"/"final"), con
// clave prefijada para que cada una tenga su propio dato en `campos`.
const PROTOCOLO_ITEMS_ESTANDAR = [
  ["Encendido", "Encendido"], ["Backup", "Backup"], ["Temperatura", "Temperatura (°C)"],
  ["Ventilador", "Ventilador"], ["TiempoPrueba", "Tiempo de prueba (min)"], ["CorrienteSalida", "Corriente de salida"],
  ["CorrienteSoftware", "Corriente de software"], ["VoltajeSalida", "Voltaje salida"], ["VoltajeSoftware", "Voltaje de software"],
  ["MedicionBusDc", "Medición Bus DC"], ["MedicionLineaTierra", "Medición línea tierra"],
  ["ProtocoloComunicacion", "Protocolo de comunicación"], ["IdProtocolo", "ID de protocolo"],
];
const PROTOCOLO_ITEMS_SERVOMOTOR = [
  ["Encendido", "Encendido"], ["Temperatura", "Temperatura (°C)"], ["Ventilador", "Ventilador"],
  ["TiempoPrueba", "Tiempo de prueba (min)"], ["TensionAc", "Tensión AC"], ["VelocidadRpm", "Velocidad RPM"],
  ["Vibracion", "Vibración"], ["CorrienteFases", "Corriente de medida de fases"],
  ["CorrienteLu", "Corriente Lu"], ["CorrienteLv", "Corriente Lv"], ["CorrienteLw", "Corriente Lw"],
  ["MedicionPolos", "Medición de polos"],
];
const PROTOCOLO_PRUEBA = (items, variante, prefijo) => ({
  tipo: "campos", titulo: `Protocolo de prueba ${variante}`,
  campos: [
    ...items.map(([sufijo, label]) => ({ clave: `${prefijo}${sufijo}`, label })),
    { clave: `${prefijo}Observacion`, label: "Observación" },
  ],
});

// El cuadro "PRUEBA DE EQUIPO INICIAL/FINAL" de la plantilla (junto al
// protocolo) es un recuadro de foto, no texto libre — un slotFijo por
// variante, ver SLOTS_FOTOS.<tipo> en informeTecnicoExcel.js (rango
// C19:D31 inicial / H19:I31 final en las 4 plantillas que usan
// PROTOCOLO_PRUEBA).
// Un slot por variante (no una sola sección combinada) para poder
// intercalar cada foto justo debajo de SU card de protocolo — no las dos
// juntas al final, lejos de sus datos correspondientes.
const EVIDENCIA_PRUEBA_EQUIPO = (variante, prefijo) => ({
  tipo: "evidencias", titulo: `Foto — Prueba de equipo ${variante}`,
  clave: `evidenciaPruebaEquipo${variante === "inicial" ? "Inicial" : "Final"}`,
  slotsFijos: [{ clave: `${prefijo}Prueba`, label: `Prueba de equipo ${variante}` }],
});

// `slotsFijos` — recuadros de foto fijos e impresos en la plantilla (no se
// pueden agregar/quitar, a diferencia de EVIDENCIAS_ESTANDAR en modo libre).
// Cada slot es { clave, label }: `clave` identifica el grupo (se guarda como
// su `titulo` interno y es la llave que usa SLOTS_FOTOS en
// informeTecnicoExcel.js para ubicar la foto en su celda exacta), `label` es
// el texto que ve el técnico en el formulario.
const SLOTS_FIJOS_LETRAS = ["A", "B", "C", "D"].map((letra) => ({ clave: letra, label: `Foto ${letra}` }));

const PIEZAS_A_REEMPLAZAR = BULLETS_ESTANDAR("piezasAReemplazar", "Piezas a reemplazar", "🔩");

// Variante de "Piezas a reemplazar" en filas de 2 columnas (Cantidad /
// Descripción) en vez de una sola línea de texto libre — usa el tipo
// "filas" del renderer genérico (lista dinámica de objetos, "+ agregar
// fila" como en bullets, pero cada fila tiene 2 campos en vez de 1).
const PIEZAS_A_REEMPLAZAR_TABLA = {
  tipo: "filas", titulo: "Piezas a reemplazar", clave: "piezasAReemplazar",
  columnas: [{ clave: "cantidad", label: "Cantidad" }, { clave: "descripcion", label: "Descripción" }],
};

export const TIPOS_INFORME = [
  {
    valor: "suministro",
    label: "Informe de Suministro",
    archivoExcel: "INFORME SUMINISTRO.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      {
        tipo: "campos", titulo: "Datos del componente",
        campos: [
          { clave: "equipoMarca", label: "Equipo / Marca" }, { clave: "modelo", label: "Modelo" },
          { clave: "potenciaComponente", label: "Potencia" }, { clave: "cantidadComponente", label: "Cantidad" },
        ],
      },
      EVIDENCIAS_ESTANDAR,
      checklistOkNok("Checklist de verificación técnica", [
        "Estado visual del componente",
        "Verificación visual de tarjetas y conectores",
        "Estado de la comunicación o encendido del componente del equipo",
        "Estado y medición de capacitores de tarjeta electrónica",
        "Prueba de temperatura (no superar 50 °C en zonas críticas)",
        "Ajuste de torque de bornes, barras y pernería",
        "Revisión de estado físico final",
      ]),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "soporte",
    label: "Servicio de Soporte",
    archivoExcel: "SERVICIO DE SOPORTE.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SOPORTE },
      {
        tipo: "campos", titulo: "Datos del equipo",
        campos: [
          { clave: "tablero", label: "Tablero" }, { clave: "marca", label: "Marca" },
          { clave: "modelo", label: "Modelo" }, { clave: "serie", label: "N° Serie" },
          { clave: "codigo", label: "Código" }, { clave: "potencia", label: "Potencia" },
          { clave: "entrada", label: "Entrada" }, { clave: "salida", label: "Salida" },
        ],
      },
      // 4 recuadros fijos impresos en la plantilla (A/B/C/D) — ver
      // SLOTS_FOTOS.soporte en informeTecnicoExcel.js, que ubica cada foto
      // por la clave del slot (la letra), no por orden de subida.
      { ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del soporte", slotsFijos: SLOTS_FIJOS_LETRAS },
      BULLETS_ESTANDAR("observacion", "Observación"),
      BULLETS_ESTANDAR("conclusion", "Conclusión"),
      BULLETS_ESTANDAR("recomendacion", "Recomendación"),
    ],
  },
  {
    valor: "diagnostico_equipo",
    label: "Informe de Diagnóstico de Equipo",
    archivoExcel: "INFORME DIAGNOSTICO DE EQUIPO .xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      // 8 recuadros fijos impresos en la plantilla — ver SLOTS_FOTOS.diagnostico_equipo
      // en informeTecnicoExcel.js, que ubica cada foto por la clave del slot,
      // no por orden de subida.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del diagnóstico",
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo" },
          { clave: "placa", label: "Placa" },
          { clave: "estadoInterno1", label: "Estado interno del equipo (1)" },
          { clave: "estadoInterno2", label: "Estado interno del equipo (2)" },
          { clave: "estadoCarcasa", label: "Estado de la carcasa del equipo" },
          { clave: "estadoTarjeta", label: "Estado de la tarjeta electrónica" },
          { clave: "componentesMalEstado", label: "Componentes en mal estado" },
          { clave: "estadoVentiladores", label: "Estado de los ventiladores" },
        ],
      },
      {
        tipo: "tabla", titulo: "Medición de diodos de IGBT", clave: "medicionDiodosIgbt",
        columnas: [{ clave: "dcMenos", label: "DC-" }, { clave: "dcMas", label: "DC+" }],
        filas: [
          { clave: "l1", label: "L1" }, { clave: "l2", label: "L2" }, { clave: "l3", label: "L3" },
          { clave: "u", label: "U (salida)" }, { clave: "v", label: "V (salida)" }, { clave: "w", label: "W (salida)" },
        ],
      },
      BULLETS_ESTANDAR("observacionesIgbt", "Observaciones de la medición"),
      PIEZAS_A_REEMPLAZAR,
      checklistOkNok("Checklist de verificación técnica", [
        "Estado general del gabinete y carcasa",
        "Estado visual de tarjetas y conectores",
        "Estado conexiones de potencia y control",
        "Estado de tierra y posibles cortocircuitos",
        "Estado de ventilador",
        "Estado de medición de salida de voltaje",
        "Estado y medición de capacitores de control y potencia",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
        "Estado de ajuste de torque de bornes, barras y pernería",
        "Estado de toda la pernería",
      ]),
      BULLETS_ESTANDAR("observacionFallas", "Observación del equipo o causas de posibles fallas"),
      BULLETS_ESTANDAR("recomendacion", "Recomendación"),
    ],
  },
  {
    valor: "diagnostico_servomotor",
    label: "Informe de Diagnóstico de Servomotor",
    archivoExcel: "INFORME DE DIAGNOSTICO SERVOMOTOR.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      {
        tipo: "campos", titulo: "Datos del equipo",
        campos: [
          { clave: "equipoMarca", label: "Equipo / Marca" }, { clave: "modelo", label: "Modelo" },
          { clave: "codigo", label: "Código" }, { clave: "tag", label: "TAG" },
          { clave: "potencia", label: "Potencia" }, { clave: "serie", label: "S/N" },
          ...CAMPOS_OPERARIO,
        ],
      },
      // 8 recuadros fijos impresos en la plantilla — ver
      // SLOTS_FOTOS.diagnostico_servomotor en informeTecnicoExcel.js, que
      // ubica cada foto por la clave del slot, no por orden de subida. Los
      // rótulos impresos sobre cada recuadro son editables desde el propio
      // card de cada foto (`campoTitulo`, ver SeccionEvidencias en
      // FormInformeTecnico.jsx) — si el técnico no los toca, escribir() en
      // informeTecnicoExcel.js no sobrescribe la celda y queda el texto
      // impreso. A diferencia de arrancador/plc, acá cada recuadro tiene su
      // propio rótulo (ninguno compartido).
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del diagnóstico",
        // 3 columnas, miniatura grande y 1 sola foto por cuadro (pedido
        // explícito del usuario) — ver SeccionEvidencias en
        // FormInformeTecnico.jsx.
        columnas: 3, miniaturaGrande: true, maxImagenes: 1,
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo", campoTitulo: "tituloVistaFrontal" },
          { clave: "placa", label: "Placa", campoTitulo: "tituloPlaca" },
          { clave: "estadoCarcasa", label: "Estado de la carcasa del equipo", campoTitulo: "tituloEstadoCarcasa" },
          { clave: "estadoEncoder", label: "Estado del encoder", campoTitulo: "tituloEstadoEncoder" },
          { clave: "estadoInterno", label: "Estado interno del equipo", campoTitulo: "tituloEstadoInterno" },
          { clave: "conectores", label: "Conectores", campoTitulo: "tituloConectores" },
          { clave: "estadoRodamientos", label: "Estado de los rodamientos", campoTitulo: "tituloEstadoRodamientos" },
          { clave: "pruebaEquipo", label: "Prueba del equipo", campoTitulo: "tituloPruebaEquipo" },
        ],
      },
      // La plantilla real ahora trae una tabla propia Cantidad/Descripción
      // para "Piezas a reemplazar" (antes era texto libre sin celda, caía
      // al anexo) — mismo tipo "filas" que arrancador/plc, habilita el botón
      // "Traer de requerimientos" (ver SeccionFilas en FormInformeTecnico.jsx).
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistOkNok("Checklist de verificación técnica", [
        "Revisión de estado general del gabinete y carcasa",
        "Verificación visual de conectores",
        "Revisión de conexiones de potencia",
        "Verificación de tierra y posibles cortocircuitos",
        "Estado de ventilador",
        "Estado de los rodamientos",
        "Estado del encoder",
        "Estado interno del equipo",
        "Estado de la pintura del equipo",
        "Vibración del equipo",
        "Ajuste de torque de bornes, barras y pernería",
        "Revisión de marcado de toda la pernería",
        "Revisión de estado físico final",
      ]),
      BULLETS_ESTANDAR("observacionFallas", "Observaciones del equipo o causas de posibles fallas"),
      BULLETS_ESTANDAR("actividadesARealizar", "Actividades a realizar"),
    ],
  },
  {
    valor: "tarjetas",
    label: "Informe de Tarjetas Electrónicas",
    archivoExcel: "INFORME TARJETAS.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      {
        tipo: "campos", titulo: "Datos del equipo",
        campos: [
          { clave: "equipoMarca", label: "Equipo / Marca" }, { clave: "modelo", label: "Modelo" },
          { clave: "codigo", label: "Código" }, { clave: "tag", label: "TAG" },
          { clave: "potencia", label: "Potencia" }, { clave: "serie", label: "S/N" },
          ...CAMPOS_OPERARIO,
        ],
      },
      // 3 recuadros fijos impresos en la plantilla — ver
      // SLOTS_FOTOS.tarjetas en informeTecnicoExcel.js, que ubica cada foto
      // por la clave del slot, no por orden de subida.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Imágenes",
        slotsFijos: [
          { clave: "imagenA", label: "VISTA INICIAL DE TARJETA" },
          { clave: "imagenB", label: "CAMBIO DE COMPONENTES" },
          { clave: "imagenC", label: "ESTADO FINAL DE TARJETA" },
        ],
      },
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado de conectores",
        "Estado conexiones de potencia y control",
        "Estado de tierra y posibles cortocircuitos",
        "Estado de medición de salida de voltaje",
        "Estado y medición de capacitores",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
      ]),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "pc",
    label: "Informe de Mantenimiento de PC",
    archivoExcel: "INFORME DE PC.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      // 7 recuadros fijos impresos en la plantilla — ver SLOTS_FOTOS.pc en
      // informeTecnicoExcel.js, que ubica cada foto por la clave del slot,
      // no por orden de subida. Los rótulos impresos sobre cada recuadro son
      // editables desde el propio card de cada foto (`campoTitulo`, ver
      // SeccionEvidencias en FormInformeTecnico.jsx) — "Limpieza de tarjeta
      // inicial/final" comparte 1 solo rótulo entre sus 2 recuadros.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del mantenimiento",
        // 3 columnas, miniatura grande y 1 sola foto por cuadro (pedido
        // explícito del usuario) — ver SeccionEvidencias en
        // FormInformeTecnico.jsx.
        columnas: 3, miniaturaGrande: true, maxImagenes: 1,
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo", campoTitulo: "tituloVistaFrontal" },
          { clave: "placaEquipo", label: "Placa Equipo", campoTitulo: "tituloPlacaEquipo" },
          { clave: "carcasaContaminada", label: "Carcasa contaminada", campoTitulo: "tituloCarcasaContaminada" },
          { clave: "carcasaDescontaminada", label: "Carcasa descontaminada", campoTitulo: "tituloCarcasaDescontaminada" },
          { clave: "limpiezaTarjetaInicial", label: "Limpieza de tarjeta inicial", campoTitulo: "tituloLimpiezaTarjeta" },
          { clave: "limpiezaTarjetaFinal", label: "Limpieza de tarjeta final", campoTitulo: "tituloLimpiezaTarjeta" },
          { clave: "cambioVentilador", label: "Cambio de ventilador", campoTitulo: "tituloCambioVentilador" },
        ],
      },
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado de conectores",
        "Estado conexiones de potencia y control",
        "Estado de fuente de alimentación",
        "Estado de procesador",
        "Estado de memoria RAM",
        "Estado de ventilador",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
      ]),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "panel",
    label: "Informe de Mantenimiento de Panel",
    archivoExcel: "INFORME DE PANEL.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      // 10 recuadros fijos impresos en la plantilla — ver SLOTS_FOTOS.panel
      // en informeTecnicoExcel.js, que ubica cada foto por la clave del
      // slot, no por orden de subida. "Cambio de LCD" está repetido a
      // propósito (antes/después, mismo patrón que "Cambio de Touch"). Los
      // rótulos impresos sobre cada recuadro son editables desde el propio
      // card de cada foto (`campoTitulo`, ver SeccionEvidencias en
      // FormInformeTecnico.jsx) — "Carcasa contaminada/descontaminada",
      // "Limpieza de tarjeta inicial/final", "Cambio de LCD" y "Cambio de
      // Touch" comparten 1 solo rótulo entre sus 2 recuadros.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del mantenimiento",
        // 3 columnas, miniatura grande y 1 sola foto por cuadro (pedido
        // explícito del usuario) — ver SeccionEvidencias en
        // FormInformeTecnico.jsx.
        columnas: 3, miniaturaGrande: true, maxImagenes: 1,
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo", campoTitulo: "tituloVistaFrontal" },
          { clave: "placaEquipo", label: "Placa Equipo", campoTitulo: "tituloPlacaEquipo" },
          { clave: "carcasaContaminada", label: "Carcasa contaminada", campoTitulo: "tituloCarcasaContaminadaDescontaminada" },
          { clave: "carcasaDescontaminada", label: "Carcasa descontaminada", campoTitulo: "tituloCarcasaContaminadaDescontaminada" },
          { clave: "limpiezaTarjetaInicial", label: "Limpieza de tarjeta inicial", campoTitulo: "tituloLimpiezaTarjeta" },
          { clave: "limpiezaTarjetaFinal", label: "Limpieza de tarjeta Final", campoTitulo: "tituloLimpiezaTarjeta" },
          { clave: "cambioLcdInicial", label: "Cambio de LCD", campoTitulo: "tituloCambioLcd" },
          { clave: "cambioLcdFinal", label: "Cambio de LCD", campoTitulo: "tituloCambioLcd" },
          { clave: "cambioTouchInicial", label: "Cambio de Touch", campoTitulo: "tituloCambioTouch" },
          { clave: "cambioTouchFinal", label: "Cambio de Touch", campoTitulo: "tituloCambioTouch" },
        ],
      },
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado de conectores",
        "Estado conexiones de potencia y control",
        "Estado de LCD",
        "Estado de TOUCH",
        "Estado y medición de capacitores",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
      ]),
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "adicional",
    label: "Informe Adicional",
    archivoExcel: "INFORME ADICIONAL  .xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      {
        tipo: "campos", titulo: "Datos del componente / equipo",
        campos: [
          { clave: "componenteMarca", label: "Componente — Equipo/Marca" }, { clave: "componenteModelo", label: "Componente — Modelo" },
          { clave: "componentePotencia", label: "Componente — Potencia" }, { clave: "componenteCantidad", label: "Componente — Cantidad" },
          { clave: "equipoMarca", label: "Equipo — Equipo/Marca" }, { clave: "equipoModelo", label: "Equipo — Modelo" },
          { clave: "equipoPotencia", label: "Equipo — Potencia" }, { clave: "equipoCantidad", label: "Equipo — Cantidad" },
        ],
      },
      // 2 recuadros fijos impresos en la plantilla — ver SLOTS_FOTOS.adicional
      // en informeTecnicoExcel.js, que ubica cada foto por la clave del
      // slot, no por orden de subida. Los rótulos impresos en A21/E21
      // ("VISTA FRONTAL COMPONENTE"/"VISTA FRONTAL EQUIPO") son editables
      // desde el propio card de cada foto (`campoTitulo`, ver
      // SeccionEvidencias en FormInformeTecnico.jsx) — si el técnico no los
      // toca, escribir() en informeTecnicoExcel.js no sobrescribe la celda y
      // queda el texto impreso original.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del componente y del equipo",
        slotsFijos: [
          { clave: "vistaFrontalComponente", label: "Vista frontal del componente", campoTitulo: "tituloVistaComponente" },
          { clave: "vistaFrontalEquipo", label: "Vista frontal del equipo", campoTitulo: "tituloVistaEquipo" },
        ],
        // Solo 2 slots — se ven mejor uno al lado del otro que apilados, con
        // miniatura más grande y 1 sola foto por cuadro (pedido explícito
        // para este tipo, ver SeccionEvidencias en FormInformeTecnico.jsx).
        columnas: 2,
        miniaturaGrande: true,
        maxImagenes: 1,
      },
      checklistOkNok("Checklist de verificación técnica", [
        "Estado visual del componente",
        "Verificación visual de tarjetas y conectores",
        "Estado de la comunicación o encendido del componente del equipo",
        "Estado y medición de capacitores de tarjeta electrónica",
        "Prueba de temperatura (no superar 50 °C en zonas críticas)",
        "Ajuste de torque de bornes, barras y pernería",
        "Revisión de estado físico final",
      ]),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "plc",
    label: "Informe de PLC",
    archivoExcel: "INFORME DE DE PLC.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      // 7 recuadros fijos impresos en la plantilla — ver SLOTS_FOTOS.plc en
      // informeTecnicoExcel.js, que ubica cada foto por la clave del slot,
      // no por orden de subida. Los rótulos impresos sobre cada recuadro son
      // editables desde el propio card de cada foto (`campoTitulo`, ver
      // SeccionEvidencias en FormInformeTecnico.jsx) — si el técnico no los
      // toca, escribir() en informeTecnicoExcel.js no sobrescribe la celda y
      // queda el texto impreso. "Limpieza de tarjeta inicial/final" comparte
      // 1 solo rótulo para sus 2 recuadros — no hay 2 celdas separadas.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del mantenimiento",
        // 3 columnas, miniatura grande y 1 sola foto por cuadro (pedido
        // explícito del usuario) — ver SeccionEvidencias en
        // FormInformeTecnico.jsx.
        columnas: 3, miniaturaGrande: true, maxImagenes: 1,
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo", campoTitulo: "tituloVistaFrontal" },
          { clave: "placaEquipo", label: "Placa Equipo", campoTitulo: "tituloPlacaEquipo" },
          { clave: "carcasaContaminada", label: "Carcasa contaminada", campoTitulo: "tituloCarcasaContaminada" },
          { clave: "carcasaDescontaminada", label: "Carcasa descontaminada", campoTitulo: "tituloCarcasaDescontaminada" },
          { clave: "limpiezaTarjetaInicial", label: "Limpieza de tarjeta inicial", campoTitulo: "tituloLimpiezaTarjeta" },
          { clave: "limpiezaTarjetaFinal", label: "Limpieza de tarjeta Final", campoTitulo: "tituloLimpiezaTarjeta" },
          { clave: "cambioComponentes", label: "Cambio de componentes", campoTitulo: "tituloCambioComponentes" },
        ],
      },
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado de conectores",
        "Estado conexiones de potencia y control",
        "Estado de tierra y posibles cortocircuitos",
        "Estado de medición de salida de voltaje",
        "Estado y medición de capacitores",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
      ]),
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "arrancador",
    label: "Informe de Arrancador",
    archivoExcel: "INFORME ARRANCADOR .xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      // `parPosicion` — solo para este tipo (pedido explícito del usuario):
      // rompe el apilado lineal por defecto y pone la card de foto a la
      // derecha de su card de protocolo correspondiente, en vez de debajo
      // (ver el agrupamiento por parPosicion en FormInformeTecnico.jsx).
      { ...PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_ESTANDAR, "inicial", "protoInicial"), parPosicion: "izquierda" },
      { ...EVIDENCIA_PRUEBA_EQUIPO("inicial", "protoInicial"), parPosicion: "derecha", miniaturaGrande: true, maxImagenes: 1 },
      { ...PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_ESTANDAR, "final", "protoFinal"), parPosicion: "izquierda" },
      { ...EVIDENCIA_PRUEBA_EQUIPO("final", "protoFinal"), parPosicion: "derecha", miniaturaGrande: true, maxImagenes: 1 },
      // 13 recuadros fijos impresos en la plantilla — ver
      // SLOTS_FOTOS.arrancador en informeTecnicoExcel.js, que ubica cada
      // foto por la clave del slot, no por orden de subida. "Cambio de
      // componentes" y "Medición de SCR" están repetidos a propósito
      // (antes/después de la intervención), mismo patrón que otros tipos.
      // Los rótulos impresos sobre cada recuadro son editables desde el
      // propio card de cada foto (`campoTitulo`, ver SeccionEvidencias en
      // FormInformeTecnico.jsx) — si el técnico no los toca, escribir() en
      // informeTecnicoExcel.js no sobrescribe la celda y queda el texto
      // impreso. "Cambio de componentes"/"Medición de SCR"/"Tarjeta.../
      // Pasta térmica..." comparten 1 solo rótulo entre sus 2 recuadros
      // (antes/después) — no hay 2 celdas separadas en la plantilla.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del mantenimiento",
        // 3 columnas, miniatura grande y 1 sola foto por cuadro (pedido
        // explícito del usuario) — ver SeccionEvidencias en
        // FormInformeTecnico.jsx.
        columnas: 3, miniaturaGrande: true, maxImagenes: 1,
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo", campoTitulo: "tituloVistaFrontal" },
          { clave: "placaEquipo", label: "Placa Equipo", campoTitulo: "tituloPlacaEquipo" },
          { clave: "carcasaContaminada", label: "Carcasa contaminada", campoTitulo: "tituloCarcasaContaminada" },
          { clave: "carcasaDescontaminada", label: "Carcasa descontaminada", campoTitulo: "tituloCarcasaDescontaminada" },
          { clave: "limpiezaContaminada", label: "Limpieza Contaminada", campoTitulo: "tituloTarjeta" },
          { clave: "limpiezaDescontaminada", label: "Limpieza Descontaminada", campoTitulo: "tituloTarjeta" },
          { clave: "pastaTermicaSeca", label: "Pasta térmica seca", campoTitulo: "tituloPastaTermica" },
          { clave: "pastaTermicaNueva", label: "Pasta térmica nueva", campoTitulo: "tituloPastaTermica" },
          { clave: "cambioVentilador", label: "Cambio ventilador", campoTitulo: "tituloCambioVentilador" },
          { clave: "cambioComponentesInicial", label: "Cambio de componentes", campoTitulo: "tituloCambioComponentes" },
          { clave: "cambioComponentesFinal", label: "Cambio de componentes", campoTitulo: "tituloCambioComponentes" },
          { clave: "medicionScrInicial", label: "Medición de SCR", campoTitulo: "tituloMedicionScr" },
          { clave: "medicionScrFinal", label: "Medición de SCR", campoTitulo: "tituloMedicionScr" },
        ],
      },
      {
        tipo: "tabla", titulo: "Medición de SCR", clave: "medicionScr",
        columnas: [{ clave: "gateAnode", label: "Gate-Anode (Ω)" }, { clave: "gateCathode", label: "Gate-Cathode (Ω)" }],
        filas: [{ clave: "scr1", label: "SCR 1" }, { clave: "scr2", label: "SCR 2" }, { clave: "scr3", label: "SCR 3" }],
      },
      BULLETS_ESTANDAR("observacionesScr", "Observaciones de la medición"),
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado general del gabinete y carcasa",
        "Estado visual de tarjetas y conectores",
        "Estado conexiones de potencia y control",
        "Estado de tierra y posibles cortocircuitos",
        "Estado de ventilador",
        "Estado de SCR",
        "Estado de tarjeta de control",
        "Estado y medición de capacitores de control y potencia",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
        "Estado de ajuste de torque de bornes, barras y pernería",
        "Estado de toda la pernería",
      ]),
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "variador_reparacion",
    label: "Informe de Reparación de Variador",
    archivoExcel: "INFORME VARIADOR REPARACION.xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_ESTANDAR, "inicial", "protoInicial"),
      EVIDENCIA_PRUEBA_EQUIPO("inicial", "protoInicial"),
      PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_ESTANDAR, "final", "protoFinal"),
      EVIDENCIA_PRUEBA_EQUIPO("final", "protoFinal"),
      // 13 recuadros fijos impresos en la plantilla — ver
      // SLOTS_FOTOS.variador_reparacion en informeTecnicoExcel.js, que
      // ubica cada foto por la clave del slot, no por orden de subida.
      // "Cambio de componentes" y "Medición de IGBT" están repetidos a
      // propósito (antes/después de la intervención). El rótulo impreso de
      // este último dice "MEDICION DE IGBT" (no "SCR" — ese componente es
      // de arrancador, no de variador), corregido acá aunque el usuario
      // pidió "Medición de SCR" copiando el texto del informe anterior.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del mantenimiento",
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo" },
          { clave: "placaEquipo", label: "Placa Equipo" },
          { clave: "carcasaContaminada", label: "Carcasa contaminada" },
          { clave: "carcasaDescontaminada", label: "Carcasa descontaminada" },
          { clave: "tarjetaContaminada", label: "Tarjeta Contaminada" },
          { clave: "tarjetaDescontaminada", label: "Tarjeta Descontaminada" },
          { clave: "pastaTermicaSeca", label: "Pasta térmica seca" },
          { clave: "pastaTermicaNueva", label: "Pasta térmica nueva" },
          { clave: "cambioVentilador", label: "Cambio ventilador" },
          { clave: "cambioComponentesInicial", label: "Cambio de componentes" },
          { clave: "cambioComponentesFinal", label: "Cambio de componentes" },
          { clave: "medicionIgbtFotoInicial", label: "Medición de IGBT" },
          { clave: "medicionIgbtFotoFinal", label: "Medición de IGBT" },
        ],
      },
      {
        tipo: "tabla", titulo: "Medición de diodos de IGBT — ingreso", clave: "medicionIgbtIngreso",
        columnas: [{ clave: "dcMenos", label: "DC-" }, { clave: "dcMas", label: "DC+" }],
        filas: [{ clave: "l1", label: "L1" }, { clave: "l2", label: "L2" }, { clave: "l3", label: "L3" }],
      },
      {
        tipo: "tabla", titulo: "Medición de diodos de IGBT — salida", clave: "medicionIgbtSalida",
        columnas: [{ clave: "dcMenos", label: "DC-" }, { clave: "dcMas", label: "DC+" }],
        filas: [{ clave: "u", label: "U" }, { clave: "v", label: "V" }, { clave: "w", label: "W" }],
      },
      BULLETS_ESTANDAR("observacionesIgbt", "Observaciones de la medición"),
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado general del gabinete y carcasa",
        "Estado visual de tarjetas y conectores",
        "Estado conexiones de potencia y control",
        "Estado de tierra y posibles cortocircuitos",
        "Estado de ventilador",
        "Estado de medición de salida de voltaje",
        "Estado y medición de capacitores de control y potencia",
        "Estado de componentes de tarjeta electrónica (Mosfet, Chips integrados)",
        "Estado de componentes pasivos de tarjeta electrónica (resistencias, Diodos, Optoacopladores)",
        "Estado mecánico del equipo (Piezas de soporte, o base de tarjetas)",
        "Estado de ajuste de torque de bornes, barras y pernería",
        "Estado de toda la pernería",
      ]),
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "ups",
    label: "Informe de Mantenimiento de UPS",
    archivoExcel: "INFORME DE UPS .xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      { tipo: "campos", titulo: "Datos del equipo", campos: [...CAMPOS_EQUIPO_ESTANDAR, ...CAMPOS_OPERARIO] },
      // `parPosicion` — solo para este tipo (pedido explícito del usuario,
      // mismo patrón que arrancador): rompe el apilado lineal por defecto y
      // pone la card de foto a la derecha de su card de protocolo
      // correspondiente (ver el agrupamiento por parPosicion en
      // FormInformeTecnico.jsx).
      { ...PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_ESTANDAR, "inicial", "protoInicial"), parPosicion: "izquierda" },
      { ...EVIDENCIA_PRUEBA_EQUIPO("inicial", "protoInicial"), parPosicion: "derecha", miniaturaGrande: true, maxImagenes: 1 },
      { ...PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_ESTANDAR, "final", "protoFinal"), parPosicion: "izquierda" },
      { ...EVIDENCIA_PRUEBA_EQUIPO("final", "protoFinal"), parPosicion: "derecha", miniaturaGrande: true, maxImagenes: 1 },
      // 9 recuadros fijos impresos en la plantilla (13 slots contando
      // antes/después) — ver SLOTS_FOTOS.ups en informeTecnicoExcel.js, que
      // ubica cada foto por la clave del slot, no por orden de subida. Los
      // rótulos impresos sobre cada recuadro son editables desde el propio
      // card de cada foto (`campoTitulo`, ver SeccionEvidencias en
      // FormInformeTecnico.jsx) — "Tarjeta contaminada/descontaminada",
      // "Baterías contaminadas/descontaminadas", "Cambio de componentes" y
      // "Medición de baterías" comparten 1 solo rótulo entre sus 2 recuadros.
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del mantenimiento",
        columnas: 3, miniaturaGrande: true, maxImagenes: 1,
        slotsFijos: [
          { clave: "vistaFrontal", label: "Vista frontal del equipo", campoTitulo: "tituloVistaFrontal" },
          { clave: "placaEquipo", label: "Placa Equipo", campoTitulo: "tituloPlacaEquipo" },
          { clave: "carcasaContaminada", label: "Carcasa contaminada", campoTitulo: "tituloCarcasaContaminada" },
          { clave: "carcasaDescontaminada", label: "Carcasa descontaminada", campoTitulo: "tituloCarcasaDescontaminada" },
          { clave: "tarjetaContaminada", label: "Tarjeta contaminada", campoTitulo: "tituloTarjeta" },
          { clave: "tarjetaDescontaminada", label: "Tarjeta descontaminada", campoTitulo: "tituloTarjeta" },
          { clave: "bateriasContaminadas", label: "Baterías contaminadas", campoTitulo: "tituloBaterias" },
          { clave: "bateriasDescontaminadas", label: "Baterías descontaminadas", campoTitulo: "tituloBaterias" },
          { clave: "cambioVentilador", label: "Cambio ventilador", campoTitulo: "tituloCambioVentilador" },
          { clave: "cambioComponentesInicial", label: "Cambio de componentes", campoTitulo: "tituloCambioComponentes" },
          { clave: "cambioComponentesFinal", label: "Cambio de componentes", campoTitulo: "tituloCambioComponentes" },
          { clave: "medicionBateriasInicial", label: "Medición de baterías", campoTitulo: "tituloMedicionBaterias" },
          { clave: "medicionBateriasFinal", label: "Medición de baterías", campoTitulo: "tituloMedicionBaterias" },
        ],
      },
      {
        tipo: "tabla", titulo: "Medición de baterías", clave: "medicionBaterias",
        columnas: [{ clave: "nominal", label: "Nominal (V)" }, { clave: "real", label: "Real (V)" }],
        filas: Array.from({ length: 10 }, (_, i) => ({ clave: `bateria${i + 1}`, label: `Batería ${i + 1}` })),
      },
      // La plantilla real ahora trae una tabla propia Cantidad/Descripción
      // (10 filas, al lado de "Medición de baterías") — antes era texto
      // libre sin celda propia. Mismo tipo "filas" que arrancador/plc,
      // habilita el botón "Traer de requerimientos".
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistDobleOkNok("Checklist de verificación técnica", "checklistTecnico", [
        "Estado general del gabinete y carcasa",
        "Estado visual de tarjetas y conectores",
        "Estado revisión de conexiones de potencia y control",
        "Estado de tierra y posibles cortocircuitos",
        "Estado de ventilador",
        "Estado de baterías",
        "Estado de ventilador después del cambio (control y potencia)",
        "Estado y medición de capacitores de control y potencia",
        "Estado de temperatura (no superar 50 °C en zonas críticas)",
        "Estado de torque de bornes, barras y pernería",
        "Estado revisión de marcado de toda la pernería",
        "Revisión de estado físico final",
      ]),
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
  {
    valor: "servomotor",
    label: "Informe de Reparación de Servomotor",
    archivoExcel: "INFORME SEVOMOTOR .xlsx",
    secciones: [
      { tipo: "campos", titulo: "Datos generales", campos: CAMPOS_HEADER_SERVICIO },
      {
        tipo: "campos", titulo: "Datos del equipo",
        campos: [
          { clave: "equipoMarca", label: "Equipo / Marca" }, { clave: "modelo", label: "Modelo" },
          { clave: "tag", label: "TAG" }, { clave: "potencia", label: "Potencia" },
          { clave: "voltaje", label: "Voltaje" }, { clave: "rpm", label: "RPM" }, { clave: "serie", label: "S/N" },
          ...CAMPOS_OPERARIO,
        ],
      },
      PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_SERVOMOTOR, "inicial", "protoInicial"),
      EVIDENCIA_PRUEBA_EQUIPO("inicial", "protoInicial"),
      PROTOCOLO_PRUEBA(PROTOCOLO_ITEMS_SERVOMOTOR, "final", "protoFinal"),
      EVIDENCIA_PRUEBA_EQUIPO("final", "protoFinal"),
      PIEZAS_A_REEMPLAZAR_TABLA,
      checklistOkNok("Checklist — Inspección visual y medición básica", [
        "Pernos completos",
        "Revisión de pernos dañados / barridos",
        "Estado del servomotor (rupturas o soporte en mal estado, oxidación)",
        "Estado del conector de alimentación",
        "Estado del conector de encoder/resolver",
        "Estado de chaveta",
        "Estado del chavetero",
        "Estado de la placa de motor",
        "Estado del acople del servomotor",
        "Estado del eje del servomotor",
        "Estado del ventilador de refrigeración",
        "Bornera de alimentación",
        "Estado de bracke",
        "Prueba de torque máximo y mínimo de bracke",
        "Estado del TAG del servomotor",
        "Estado del encoder",
        "Estado del resolver",
        "Medida de bobinas del resolver (Ω)",
        "Medida del sensor de temperatura",
        "Medida de la resistencia de la bobina",
        "Medida de las fases con tierra",
        "Medida de la deflexión del eje del rotor",
      ], "insp_"),
      checklistOkNok("Checklist del proceso desarmado", [
        "Marcas de referencias para el desarmado",
        "Estado de la resistencia de aislamiento de la bobina de servomotor",
        "Estado de la resistencia de la bobina",
        "Estado de la inductancia de la bobina",
        "Estado de los imanes del rotor servomotor",
        "Estado del asiento de rodamiento delantero",
        "Estado del asiento de rodamiento trasero",
        "Estado del alojamiento de rodamiento delantero",
        "Estado del alojamiento de rodamiento trasero",
        "Estado de muelle (arandelas onduladas)",
        "Estado del eje del rotor",
        "Estado de la deflexión del eje del rotor",
        "Estado de alineamiento del encoder",
        "Si rotor viene con acople en parte de encoder",
        "Estado de balanceo del rotor",
        "Estado de ventilador de refrigeración",
        "Estado de la resistencia de aislamiento de la bobina del ventilador",
        "Estado de la resistencia bobina del ventilador",
        "Estado de los alojamientos de rodamiento del ventilador",
        "Estado de los asientos de rodamiento del ventilador",
        "Estado del funcionamiento mecánico del brake",
      ], "desarme_"),
      checklistOkNok("Checklist del proceso de armado", [
        "Sincronización del resolver",
        "Torque de pernos del resolver/encoder",
        "Ajuste de perno a la tapa del servomotor",
        "Ajuste de perno al eje del servomotor",
        "Torque de perno de los conectores de potencia servomotor",
        "Torque de perno de los conectores de encoder/resolver servomotor",
        "Estado de eje del servomotor",
        "Estado del chavetero y chaveta del servomotor",
        "Estado del torque del brake",
        "Estado del ventilador de refrigeración",
        "Sentido de giro del ventilador",
        "Sincronización del encoder",
        "Estado de alineamiento del encoder/resolver",
        "Medida de la corriente de las fases",
        "Medida de vibración",
      ], "armado_"),
      BULLETS_ESTANDAR("observacionesArmado", "Observaciones del proceso de armado"),
      {
        // "Medición de sensor del estator" y "Resistencia de aislamiento —
        // Condiciones" son títulos de grupo impresos en la plantilla real
        // (fila 105/106), no campos con su propio dato — los campos reales
        // de cada grupo (Termistor.../Resistencia de aislamiento...) ya
        // llevan el contexto en su propia etiqueta compuesta.
        tipo: "campos", titulo: "Pruebas eléctricas estáticas (equipo desenergizado)",
        campos: [
          { clave: "termistorValor", label: "Termistor — Valor (Ω)" },
          { clave: "termistorSituacion", label: "Termistor — Situación" },
          { clave: "termistorEstado", label: "Termistor — Estado" },
          { clave: "aislamientoTempAmbiente", label: "Resistencia de aislamiento — Temperatura ambiente (°C)" },
          { clave: "aislamientoTensionPrueba", label: "Resistencia de aislamiento — Tensión de prueba" },
          { clave: "aislamientoTiempoPrueba", label: "Resistencia de aislamiento — Tiempo de prueba (min)" },
          { clave: "aislamientoEstado", label: "Resistencia de aislamiento — Estado" },
        ],
      },
      {
        tipo: "tabla", titulo: "Medición de resistencia de la bobina del estator", clave: "medicionBobinaEstator",
        columnas: [{ clave: "resistencia", label: "Resistencia (Ω)" }, { clave: "inductancia", label: "Inductancia (mH)" }],
        filas: [
          { clave: "faseUV", label: "Fase U-V" }, { clave: "faseVW", label: "Fase V-W" }, { clave: "faseUW", label: "Fase U-W" },
        ],
      },
      {
        tipo: "tabla", titulo: "Mediciones mecánicas — delanteras", clave: "medicionesMecanicasDelanteras",
        columnas: [{ clave: "diametro", label: "Diámetro (mm)" }, { clave: "estado", label: "Estado" }],
        filas: [{ clave: "alojamiento", label: "Alojamiento" }, { clave: "asiento", label: "Asiento" }],
      },
      {
        tipo: "campos", titulo: "Rodamiento delantero",
        campos: [
          { clave: "modeloRodamientoDelantero", label: "Modelo de rodamiento" },
          { clave: "toleranciaDelanteroDesde", label: "Tolerancia norma EASA AR100 — Desde" },
          { clave: "toleranciaDelanteroHasta", label: "Tolerancia norma EASA AR100 — Hasta" },
        ],
      },
      {
        tipo: "tabla", titulo: "Mediciones mecánicas — traseras", clave: "medicionesMecanicasTraseras",
        columnas: [{ clave: "diametro", label: "Diámetro (mm)" }, { clave: "estado", label: "Estado" }],
        filas: [{ clave: "alojamiento", label: "Alojamiento" }, { clave: "asiento", label: "Asiento" }],
      },
      {
        tipo: "campos", titulo: "Rodamiento trasero",
        campos: [
          { clave: "modeloRodamientoTrasero", label: "Modelo de rodamiento" },
          { clave: "toleranciaTraseroDesde", label: "Tolerancia norma EASA AR100 — Desde" },
          { clave: "toleranciaTraseroHasta", label: "Tolerancia norma EASA AR100 — Hasta" },
        ],
      },
      {
        // "Sección (mm)" es el rótulo de columna de la mini-tabla impresa
        // (fila 113) — la única fila de esa tabla ya trae su "sección"
        // fija impresa ("EJE DE ACOPLE", fila 114), no es un dato a
        // ingresar.
        tipo: "campos", titulo: "Deflexión del eje de acople",
        campos: [
          { clave: "deflexionDiametro", label: "Diámetro" },
          { clave: "deflexionValor", label: "Deflexión" }, { clave: "deflexionEstado", label: "Estado" },
          { clave: "deflexionToleranciaDesde", label: "Tolerancia AR100 — Desde" }, { clave: "deflexionToleranciaHasta", label: "Tolerancia AR100 — Hasta" },
        ],
      },
      BULLETS_ESTANDAR("herramientasMateriales", "Herramientas y materiales utilizados", "🔧"),
      // 14 recuadros fijos impresos en la plantilla, en 4 bandas (filas
      // 128-139, 141-154, 169-188, 190-209) — ver SLOTS_FOTOS.servomotor en
      // informeTecnicoExcel.js, que ubica cada foto por la clave del slot,
      // no por orden de subida. "EVIDENCIAS DE MANTENIMIENTO" (impreso en
      // la fila 168) es el título de esta sección completa, no una
      // etiqueta de foto — confirmado con el usuario tras encontrar un
      // posible malentendido (los rótulos de fila 128-154 SÍ son
      // específicos: eje del rotor, rodamientos, chavetero/chaveta, etc.,
      // no genéricos A/B/C/D).
      {
        ...EVIDENCIAS_ESTANDAR, titulo: "Evidencias de mantenimiento",
        slotsFijos: [
          { clave: "estadoEjeRotor", label: "Estado del eje del rotor" },
          { clave: "asientoRodamientoDelantero", label: "Asiento de rodamiento delantero" },
          { clave: "estadoNucleoRotor", label: "Estado del núcleo del rotor" },
          { clave: "asientoTrasero", label: "Asiento trasero" },
          { clave: "estadoChaveteroChaveta", label: "Estado de chavetero/chaveta" },
          { clave: "rodamientoDelantero", label: "Rodamiento delantero" },
          { clave: "fotoOriginalRotor", label: "Foto original del rotor" },
          { clave: "rodamientoTrasero", label: "Rodamiento trasero" },
          // 4 recuadros genéricos A/B/C/D, captionados en la plantilla real
          // por el título "EVIDENCIAS DE MANTENIMIENTO" (fila 168) — a
          // diferencia de las bandas anteriores, esta sí usa letras
          // genéricas en vez de rótulos específicos.
          { clave: "evidenciaA", label: "A", separador: "Evidencias del mantenimiento" },
          { clave: "evidenciaB", label: "B" },
          { clave: "evidenciaC", label: "C" },
          { clave: "evidenciaD", label: "D" },
          { clave: "vistaFrontalEquipo", label: "Vista frontal del equipo" },
          { clave: "placaEquipoFoto", label: "Placa del equipo" },
          { clave: "fotoEncoder", label: "Foto encoder" },
          { clave: "cambioRodamientosFoto", label: "Cambio de rodamientos" },
          { clave: "estadoInternoEquipoInicial", label: "Estado interno del equipo inicial" },
          { clave: "estadoInternoEquipoFinal", label: "Estado interno del equipo final" },
        ],
      },
      {
        tipo: "campos", titulo: "Placa del equipo",
        campos: [
          { clave: "placaMarca", label: "Marca" }, { clave: "placaModelo", label: "Modelo" }, { clave: "placaVoltaje", label: "Voltaje" },
        ],
      },
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
];

export const tipoInformePorValor = (valor) => TIPOS_INFORME.find((t) => t.valor === valor) || null;
