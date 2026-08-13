import { useState } from "react";
import DetalleOrdenCompra from "./DetalleOrdenCompra";
import DetalleFactura from "./DetalleFactura";
import DetalleCotizacion from "./DetalleCotizacion";
import DetalleOrdenTrabajo from "./DetalleOrdenTrabajo";
import DetalleSubOT from "./DetalleSubOT";

// Router interno de detalle: al navegar entre documentos relacionados se
// reemplaza la vista actual (no se anidan modales).
export default function DetalleDocumento({
  tipo, data, extra, onClose,
  onGuardadaOC, onGuardadaFactura, onGuardadaCotizacion, onGuardadaOT,
}) {
  const [vista, setVista] = useState({ tipo, data, extra: extra || null });

  const navegar = ({ tipo, data, extra }) =>
    setVista({ tipo, data, extra: extra || null });

  const cerrarGuardando = (cb) => (actualizada) => { cb?.(actualizada); onClose(); };

  // `key` es necesario acá: cuando se navega entre dos documentos del MISMO
  // tipo (ej. OT padre -> sub-OT, el único caso hoy en la app donde una
  // tarjeta de Relaciones enlaza a otro documento de su propio tipo), React
  // reconcilia el mismo componente en la misma posición y NO lo vuelve a
  // montar solo porque cambió la prop `data` — cada Detalle* siembra su
  // estado interno (`useState(inicial)`) una sola vez al montar, así que sin
  // `key` el modal se queda mostrando el documento anterior aunque se haga
  // click en otra tarjeta. La `key` fuerza un remount real por documento.
  if (vista.tipo === "cotizacion") {
    return (
      <DetalleCotizacion
        key={vista.data._id}
        cotizacion={vista.data}
        onNavegar={navegar}
        onClose={onClose}
        onGuardada={cerrarGuardando(onGuardadaCotizacion)}
      />
    );
  }

  if (vista.tipo === "ot") {
    // Una sub-OT (tiene `ordenPadre`) usa su propio modal, más liviano —
    // ver comentario al tope de DetalleSubOT.jsx.
    const DetalleOT = vista.data.ordenPadre ? DetalleSubOT : DetalleOrdenTrabajo;
    return (
      <DetalleOT
        key={vista.data._id}
        orden={vista.data}
        onNavegar={navegar}
        onClose={onClose}
        onGuardada={cerrarGuardando(onGuardadaOT)}
      />
    );
  }

  if (vista.tipo === "oc") {
    return (
      <DetalleOrdenCompra
        key={vista.data._id}
        orden={vista.data}
        facturaVinculada={vista.extra}
        onNavegar={navegar}
        onClose={onClose}
        onGuardada={cerrarGuardando(onGuardadaOC)}
      />
    );
  }

  return (
    <DetalleFactura
      key={vista.data._id}
      factura={vista.data}
      onNavegar={navegar}
      onClose={onClose}
      onGuardada={cerrarGuardando(onGuardadaFactura)}
    />
  );
}
