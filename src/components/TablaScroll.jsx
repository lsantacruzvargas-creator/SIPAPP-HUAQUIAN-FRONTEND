import { useEffect, useRef, useState } from "react";

// Duplica la barra de scroll horizontal de una tabla ancha arriba de ella,
// además de la de abajo (la única que da el navegador sobre el contenedor
// overflow-x-auto) — en tablas largas la de abajo queda fuera de vista sin
// bajar hasta el final. Las dos barras se sincronizan entre sí.
// `fija` (páginas de lista): alto máximo con scroll propio y cabecera pegada
// arriba (ver .tabla-fija en index.css).
export default function TablaScroll({ children, className = "", fija = false }) {
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const sincronizandoRef = useRef(false);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const medir = () => setAncho(bottomRef.current?.scrollWidth || 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  });

  const sincronizar = (origen, destino) => () => {
    if (sincronizandoRef.current) { sincronizandoRef.current = false; return; }
    sincronizandoRef.current = true;
    destino.current.scrollLeft = origen.current.scrollLeft;
  };

  return (
    <>
      <div ref={topRef} className="overflow-x-auto" style={{ height: 12 }} onScroll={sincronizar(topRef, bottomRef)}>
        <div style={{ width: ancho, height: 1 }} />
      </div>
      <div ref={bottomRef} className={`${className} ${fija ? "tabla-fija" : ""}`} onScroll={sincronizar(bottomRef, topRef)}>
        {children}
      </div>
    </>
  );
}
