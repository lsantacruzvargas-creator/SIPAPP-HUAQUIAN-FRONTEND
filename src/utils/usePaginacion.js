import { useState } from "react";

export const FILAS_POR_PAGINA = 30;

// Paginación en el cliente: la tabla sigue recibiendo la lista completa ya
// filtrada (contadores, totales y Excel salen de ella), solo se renderizan las
// filas de la página actual. Vuelve a la página 1 cuando cambia el resultado
// (filtro u orden distinto); la firma usa el largo y el primer _id para no
// resetear en cada render del padre, que recalcula el array cada vez.
export function usePaginacion(items, porPagina = FILAS_POR_PAGINA) {
  const [pagina, setPagina] = useState(1);
  const firma = `${items.length}|${items[0]?._id ?? ""}`;
  const [firmaPrevia, setFirmaPrevia] = useState(firma);
  if (firma !== firmaPrevia) {
    setFirmaPrevia(firma);
    setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const actual = Math.min(pagina, totalPaginas);
  const inicio = (actual - 1) * porPagina;

  return {
    pagina: actual,
    totalPaginas,
    setPagina,
    total: items.length,
    desde: items.length ? inicio + 1 : 0,
    hasta: Math.min(inicio + porPagina, items.length),
    visibles: items.slice(inicio, inicio + porPagina),
  };
}
