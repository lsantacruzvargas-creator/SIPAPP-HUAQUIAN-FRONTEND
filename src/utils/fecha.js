// Toda fecha/hora que se muestra en la UI debe leerse en hora de Perú
// (America/Lima, UTC-5, sin horario de verano) — sin esto, toLocaleDateString/
// toLocaleString usan el huso horario del sistema operativo del navegador, que
// puede no coincidir con Lima (ver Backend/src/utils/fechaEmisionLima.js, que
// ya resolvió el mismo problema del lado del servidor para comprobantes/guías).
const TZ = "America/Lima";

// Los campos de solo fecha (<input type="date">) guardados antes de 2026-09-28
// quedaron a medianoche UTC ("2026-09-28T00:00:00.000Z"): leídos en hora Lima
// caen el día anterior. No se migraron, así que ese valor exacto se lee como
// día calendario en UTC; lo nuevo ya llega a medianoche Lima (T05:00Z) desde el
// backend. Un timestamp real a 00:00:00.000 UTC exacto es prácticamente imposible.
const zonaDe = (d) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
    ? "UTC" : TZ;

export const formatearFecha = (fecha, opts) => {
  const d = new Date(fecha);
  return d.toLocaleDateString("es-PE", { timeZone: zonaDe(d), ...opts });
};

export const formatearFechaHora = (fecha, opts) =>
  new Date(fecha).toLocaleString("es-PE", { timeZone: TZ, ...opts });

// "YYYY-MM-DD" del día calendario ACTUAL en Lima — para precargar un
// <input type="date"> con el día correcto (`new Date().toISOString().slice(0,10)`
// usa UTC: entre las 19:00 y 23:59 hora Lima ya muestra el día siguiente, mismo
// bug que ya se documentó y resolvió en Backend/src/utils/fechaEmisionLima.js).
export const fechaHoyLima = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// "YYYY-MM-DD" de una fecha guardada — para precargar un <input type="date">
// al editar (`toISOString().split("T")[0]` da el día UTC: un registro creado
// después de las 19:00 hora Lima aparecería con el día siguiente).
export const aInputFecha = (fecha) => {
  const d = new Date(fecha);
  return new Intl.DateTimeFormat("en-CA", { timeZone: zonaDe(d) }).format(d);
};

// Año y mes (1-12) en Lima, para los filtros por año/mes de las listas —
// getFullYear()/getMonth() usan el huso del sistema operativo del navegador.
export const anioLima = (fecha) => Number(aInputFecha(fecha).slice(0, 4));
export const mesLima = (fecha) => Number(aInputFecha(fecha).slice(5, 7));
