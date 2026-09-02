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

// "YYYY-MM-DD" del día calendario ACTUAL en Lima — para precargar un
// <input type="date"> con el día correcto (`new Date().toISOString().slice(0,10)`
// usa UTC: entre las 19:00 y 23:59 hora Lima ya muestra el día siguiente, mismo
// bug que ya se documentó y resolvió en Backend/src/utils/fechaEmisionLima.js).
export const fechaHoyLima = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
