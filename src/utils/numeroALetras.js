// Copia de Backend/src/utils/numeroALetras.js — el PDF de cotización se genera
// enteramente en el navegador (cotizacionPdf.js) y no tiene acceso al backend,
// así que la función pura se duplica acá igual que ya se hace con los
// catálogos SUNAT (catalogosSunat.js). Usada para la línea "SON: ..." del
// nuevo formato de cotización (NUEVO FORMATO DE COTIZACION.xlsx, fila 42) —
// se autocompleta desde el total, no es un input del formulario.
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DECENAS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS_DEC = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function _decenas(n) {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DECENAS[n - 10];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (n === 20) return 'VEINTE';
  if (d === 2) return `VEINTI${UNIDADES[u]}`;
  return u === 0 ? DECENAS_DEC[d] : `${DECENAS_DEC[d]} Y ${UNIDADES[u]}`;
}

function _centenas(n) {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const txtC = c > 0 ? CENTENAS[c] : '';
  const txtD = resto > 0 ? _decenas(resto) : '';
  return [txtC, txtD].filter(Boolean).join(' ');
}

function _miles(n) {
  if (n < 1000) return _centenas(n);
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const txtMiles = miles === 1 ? 'MIL' : `${_centenas(miles)} MIL`;
  const txtResto = resto > 0 ? _centenas(resto) : '';
  return [txtMiles, txtResto].filter(Boolean).join(' ');
}

function _millones(n) {
  if (n < 1000000) return _miles(n);
  const millones = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const txtMillones = millones === 1 ? 'UN MILLON' : `${_miles(millones)} MILLONES`;
  const txtResto = resto > 0 ? _miles(resto) : '';
  return [txtMillones, txtResto].filter(Boolean).join(' ');
}

export function numeroALetras(monto, moneda = 'PEN') {
  const nombreMoneda = { PEN: 'SOLES', USD: 'DOLARES AMERICANOS' }[moneda] || moneda;
  const entero = Math.floor(monto);
  const centimos = Math.round((monto - entero) * 100);
  const parteEntera = entero === 0 ? 'CERO' : _millones(entero);
  return `${parteEntera} CON ${String(centimos).padStart(2, '0')}/100 ${nombreMoneda}`;
}
