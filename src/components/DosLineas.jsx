// Cabecera de tabla en dos renglones parejos: el corte va en el espacio que deja la línea más
// larga lo más corta posible, así las columnas de datos cortos (fechas, N°, estados) quedan
// angostas y el ancho sobrante se lo llevan Empresa, Título o Descripción.
export default function DosLineas({ children }) {
  const palabras = String(children).trim().split(/\s+/);
  if (palabras.length < 2) return children;
  let mejor = 1, ancho = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const largo = Math.max(palabras.slice(0, i).join(" ").length, palabras.slice(i).join(" ").length);
    if (largo < ancho) { ancho = largo; mejor = i; }
  }
  return (
    <span className="inline-block">
      {palabras.slice(0, mejor).join(" ")}<br />{palabras.slice(mejor).join(" ")}
    </span>
  );
}
