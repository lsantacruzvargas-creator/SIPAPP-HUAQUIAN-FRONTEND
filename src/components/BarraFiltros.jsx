// Misma geometría en todas las listas: filtros arriba con ancho fijo, búsqueda siempre
// abajo a la izquierda con el mismo ancho, y Ordenar/botones a su derecha. Así nada
// se desplaza al cambiar de lista ni al aparecer u ocultarse un filtro.
export const ANCHO_FILTRO = "w-56";
export const ANCHO_FECHA = "w-40";

export default function BarraFiltros({ busqueda, acciones, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-col gap-3 barra-filtros">
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-full md:w-[36rem] shrink-0">{busqueda}</div>
        {acciones}
      </div>
    </div>
  );
}
