// Redondeo aritmético (medio hacia arriba, simétrico) como el de SUNAT y una
// calculadora. `Math.round(x * 100) / 100` falla cuando el número ya viene con
// ruido binario de una multiplicación: 3296.25 × 0.18 = 593.32499999999993 →
// daba 593.32 (IGV) y 3889.57 (total), mientras el portal de SUNAT da 593.33 y
// 3889.58. Se limpia el ruido a 10 decimales y se redondea sobre la
// representación decimal (notación exponencial), no sobre el binario.
// Copia exacta de Backend/src/utils/redondeo.js — cambiar uno obliga a cambiar el otro.
function redondear(n, decimales) {
  const x = Number(n) || 0;
  const abs = Number(`${Math.abs(x).toFixed(10)}e${decimales}`);
  return Math.sign(x) * Number(`${Math.round(abs)}e-${decimales}`);
}

export const r2 = (n) => redondear(n, 2);
// Soles enteros (depósito de la detracción, R.S. 178-2005/SUNAT).
export const r0 = (n) => redondear(n, 0);
