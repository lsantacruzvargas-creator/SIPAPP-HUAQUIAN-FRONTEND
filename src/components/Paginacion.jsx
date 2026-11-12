// Números de página a mostrar: primera, última y la vecindad de la actual,
// con "…" en los huecos (1 … 4 5 6 … 12).
function paginasVisibles(actual, total) {
  const set = new Set([1, total, actual - 1, actual, actual + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const salida = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) salida.push(`gap-${n}`);
    salida.push(n);
  });
  return salida;
}

const BTN = "min-w-8 h-8 px-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed";

export default function Paginacion({ pagina, totalPaginas, setPagina, desde, hasta, total }) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-3 border-t border-gray-100 text-sm">
      <span className="text-gray-400 tabular-nums">
        {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setPagina(pagina - 1)} disabled={pagina <= 1}
          className={`${BTN} text-gray-500 hover:bg-gray-100 hover:text-gray-800`}>
          ← Anterior
        </button>
        {paginasVisibles(pagina, totalPaginas).map((n) =>
          typeof n === "string" ? (
            <span key={n} className="px-1 text-gray-300">…</span>
          ) : (
            <button key={n} type="button" onClick={() => setPagina(n)}
              className={`${BTN} tabular-nums ${n === pagina ? "bg-gray-900 text-white font-semibold" : "text-gray-600 hover:bg-gray-100"}`}>
              {n}
            </button>
          )
        )}
        <button type="button" onClick={() => setPagina(pagina + 1)} disabled={pagina >= totalPaginas}
          className={`${BTN} text-gray-500 hover:bg-gray-100 hover:text-gray-800`}>
          Siguiente →
        </button>
      </div>
    </div>
  );
}
