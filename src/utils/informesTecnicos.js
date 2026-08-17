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
const checklistSimple = (titulo, items) => ({
  tipo: "checklist", titulo,
  items: items.map((label, i) => ({ clave: `item${i + 1}`, label })),
});

// Checklist "de doble columna" (# | Descripción | OK/NOK Inicial | OK/NOK
// Final) — usa el tipo "tabla" del renderer genérico (grilla filas x
// columnas) porque "checklist" solo soporta un input por ítem.
const checklistDoble = (titulo, clave, items) => ({
  tipo: "tabla", titulo, clave,
  columnas: [{ clave: "inicial", label: "OK/NOK Inicial" }, { clave: "final", label: "OK/NOK Final" }],
  filas: items.map((label, i) => ({ clave: `item${i + 1}`, label })),
});

const EVIDENCIAS_ESTANDAR = { tipo: "evidencias", titulo: "Evidencias fotográficas", clave: "evidencias" };

const PIEZAS_A_REEMPLAZAR = BULLETS_ESTANDAR("piezasAReemplazar", "Piezas a reemplazar", "🔩");

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
      checklistSimple("Checklist de verificación técnica", [
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
      { ...EVIDENCIAS_ESTANDAR, titulo: "Fotos del soporte" },
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
      EVIDENCIAS_ESTANDAR,
      {
        tipo: "campos", titulo: "Estado general",
        campos: [
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
      checklistSimple("Checklist de verificación técnica", [
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
      EVIDENCIAS_ESTANDAR,
      {
        tipo: "campos", titulo: "Estado general",
        campos: [
          { clave: "estadoCarcasa", label: "Estado de la carcasa del equipo" },
          { clave: "conectores", label: "Conectores" },
          { clave: "estadoRodamientos", label: "Estado de los rodamientos" },
          { clave: "pruebaEquipo", label: "Prueba del equipo" },
        ],
      },
      PIEZAS_A_REEMPLAZAR,
      checklistSimple("Checklist de verificación técnica", [
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
      EVIDENCIAS_ESTANDAR,
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      EVIDENCIAS_ESTANDAR,
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      EVIDENCIAS_ESTANDAR,
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      EVIDENCIAS_ESTANDAR,
      checklistSimple("Checklist de verificación técnica", [
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
      EVIDENCIAS_ESTANDAR,
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      {
        tipo: "campos", titulo: "Protocolo de prueba inicial / final",
        campos: [
          { clave: "protoEncendido", label: "Encendido" }, { clave: "protoBackup", label: "Backup" },
          { clave: "protoTemperatura", label: "Temperatura (°C)" }, { clave: "protoVentilador", label: "Ventilador" },
          { clave: "protoTiempoPrueba", label: "Tiempo de prueba (min)" }, { clave: "protoCorrienteSalida", label: "Corriente de salida" },
          { clave: "protoCorrienteSoftware", label: "Corriente de software" }, { clave: "protoVoltajeSalida", label: "Voltaje salida" },
          { clave: "protoVoltajeSoftware", label: "Voltaje de software" }, { clave: "protoMedicionBusDc", label: "Medición Bus DC" },
          { clave: "protoMedicionLineaTierra", label: "Medición línea tierra" }, { clave: "protoProtocoloComunicacion", label: "Protocolo de comunicación" },
          { clave: "protoIdProtocolo", label: "ID de protocolo" }, { clave: "protoObservacion", label: "Observación" },
        ],
      },
      EVIDENCIAS_ESTANDAR,
      {
        tipo: "tabla", titulo: "Medición de SCR", clave: "medicionScr",
        columnas: [{ clave: "gateAnode", label: "Gate-Anode (Ω)" }, { clave: "gateCathode", label: "Gate-Cathode (Ω)" }],
        filas: [{ clave: "scr1", label: "SCR 1" }, { clave: "scr2", label: "SCR 2" }, { clave: "scr3", label: "SCR 3" }],
      },
      BULLETS_ESTANDAR("observacionesScr", "Observaciones de la medición"),
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      {
        tipo: "campos", titulo: "Protocolo de prueba inicial / final",
        campos: [
          { clave: "protoEncendido", label: "Encendido" }, { clave: "protoBackup", label: "Backup" },
          { clave: "protoTemperatura", label: "Temperatura (°C)" }, { clave: "protoVentilador", label: "Ventilador" },
          { clave: "protoTiempoPrueba", label: "Tiempo de prueba (min)" }, { clave: "protoCorrienteSalida", label: "Corriente de salida" },
          { clave: "protoCorrienteSoftware", label: "Corriente de software" }, { clave: "protoVoltajeSalida", label: "Voltaje salida" },
          { clave: "protoVoltajeSoftware", label: "Voltaje de software" }, { clave: "protoMedicionBusDc", label: "Medición Bus DC" },
          { clave: "protoMedicionLineaTierra", label: "Medición línea tierra" }, { clave: "protoProtocoloComunicacion", label: "Protocolo de comunicación" },
          { clave: "protoIdProtocolo", label: "ID de protocolo" }, { clave: "protoObservacion", label: "Observación" },
        ],
      },
      EVIDENCIAS_ESTANDAR,
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
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      {
        tipo: "campos", titulo: "Protocolo de prueba inicial / final",
        campos: [
          { clave: "protoEncendido", label: "Encendido" }, { clave: "protoBackup", label: "Backup" },
          { clave: "protoTemperatura", label: "Temperatura (°C)" }, { clave: "protoVentilador", label: "Ventilador" },
          { clave: "protoTiempoPrueba", label: "Tiempo de prueba (min)" }, { clave: "protoCorrienteSalida", label: "Corriente de salida" },
          { clave: "protoCorrienteSoftware", label: "Corriente de software" }, { clave: "protoVoltajeSalida", label: "Voltaje salida" },
          { clave: "protoVoltajeSoftware", label: "Voltaje de software" }, { clave: "protoMedicionBusDc", label: "Medición Bus DC" },
          { clave: "protoMedicionLineaTierra", label: "Medición línea tierra" }, { clave: "protoProtocoloComunicacion", label: "Protocolo de comunicación" },
          { clave: "protoIdProtocolo", label: "ID de protocolo" }, { clave: "protoObservacion", label: "Observación" },
        ],
      },
      EVIDENCIAS_ESTANDAR,
      {
        tipo: "tabla", titulo: "Medición de baterías", clave: "medicionBaterias",
        columnas: [{ clave: "nominal", label: "Nominal (V)" }, { clave: "real", label: "Real (V)" }],
        filas: Array.from({ length: 10 }, (_, i) => ({ clave: `bateria${i + 1}`, label: `Batería ${i + 1}` })),
      },
      PIEZAS_A_REEMPLAZAR,
      checklistDoble("Checklist de verificación técnica", "checklistTecnico", [
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
      {
        tipo: "campos", titulo: "Protocolo de prueba inicial / final",
        campos: [
          { clave: "protoEncendido", label: "Encendido" }, { clave: "protoTemperatura", label: "Temperatura (°C)" },
          { clave: "protoVentilador", label: "Ventilador" }, { clave: "protoTiempoPrueba", label: "Tiempo de prueba (min)" },
          { clave: "protoTensionAc", label: "Tensión AC" }, { clave: "protoVelocidadRpm", label: "Velocidad RPM" },
          { clave: "protoVibracion", label: "Vibración" }, { clave: "protoCorrienteFases", label: "Corriente de medida de fases" },
          { clave: "protoCorrienteLu", label: "Corriente Lu" }, { clave: "protoCorrienteLv", label: "Corriente Lv" },
          { clave: "protoCorrienteLw", label: "Corriente Lw" }, { clave: "protoMedicionPolos", label: "Medición de polos" },
          { clave: "protoObservacion", label: "Observación" },
        ],
      },
      PIEZAS_A_REEMPLAZAR,
      checklistSimple("Checklist — Inspección visual y medición básica", [
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
      ]),
      checklistSimple("Checklist del proceso desarmado", [
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
      ]),
      checklistSimple("Checklist del proceso de armado", [
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
      ]),
      BULLETS_ESTANDAR("observacionesArmado", "Observaciones del proceso de armado"),
      {
        tipo: "campos", titulo: "Pruebas eléctricas estáticas (equipo desenergizado)",
        campos: [
          { clave: "medicionSensorEstator", label: "Medición de sensor del estator" },
          { clave: "termistorValor", label: "Termistor — Valor (Ω)" },
          { clave: "termistorSituacion", label: "Termistor — Situación" },
          { clave: "termistorEstado", label: "Termistor — Estado" },
          { clave: "aislamientoCondiciones", label: "Resistencia de aislamiento — Condiciones" },
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
        tipo: "campos", titulo: "Deflexión del eje de acople",
        campos: [
          { clave: "deflexionSeccion", label: "Sección (mm)" }, { clave: "deflexionDiametro", label: "Diámetro" },
          { clave: "deflexionValor", label: "Deflexión" }, { clave: "deflexionEstado", label: "Estado" },
          { clave: "deflexionToleranciaDesde", label: "Tolerancia AR100 — Desde" }, { clave: "deflexionToleranciaHasta", label: "Tolerancia AR100 — Hasta" },
        ],
      },
      BULLETS_ESTANDAR("herramientasMateriales", "Herramientas y materiales utilizados", "🔧"),
      { ...EVIDENCIAS_ESTANDAR, titulo: "Evidencias de mantenimiento" },
      {
        tipo: "campos", titulo: "Placa del equipo",
        campos: [
          { clave: "placaMarca", label: "Marca" }, { clave: "placaModelo", label: "Modelo" }, { clave: "placaVoltaje", label: "Voltaje" },
        ],
      },
      BULLETS_ESTANDAR("cambioRodamientos", "Cambio de rodamientos"),
      BULLETS_ESTANDAR("observaciones", "Observaciones"),
      BULLETS_ESTANDAR("conclusiones", "Conclusiones"),
      BULLETS_ESTANDAR("recomendaciones", "Recomendaciones"),
    ],
  },
];

export const tipoInformePorValor = (valor) => TIPOS_INFORME.find((t) => t.valor === valor) || null;
