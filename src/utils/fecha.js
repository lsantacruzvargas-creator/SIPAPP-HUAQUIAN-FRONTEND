// Toda fecha/hora que se muestra en la UI debe leerse en hora de Perú
// (America/Lima, UTC-5, sin horario de verano) — sin esto, toLocaleDateString/
// toLocaleString usan el huso horario del sistema operativo del navegador, que
// puede no coincidir con Lima (ver Backend/src/utils/fechaEmisionLima.js, que
// ya resolvió el mismo problema del lado del servidor para comprobantes/guías).
const TZ = "America/Lima";

export const formatearFecha = (fecha, opts) =>
  new Date(fecha).toLocaleDateString("es-PE", { timeZone: TZ, ...opts });

export const formatearFechaHora = (fecha, opts) =>
  new Date(fecha).toLocaleString("es-PE", { timeZone: TZ, ...opts });
