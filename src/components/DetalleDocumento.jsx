import { useState } from "react";
import DetalleOrdenCompra from "./DetalleOrdenCompra";
import DetalleFactura from "./DetalleFactura";
import DetalleCotizacion from "./DetalleCotizacion";
import DetalleOrdenTrabajo from "./DetalleOrdenTrabajo";

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

  if (vista.tipo === "cotizacion") {
    return (
      <DetalleCotizacion
        cotizacion={vista.data}
        onNavegar={navegar}
        onClose={onClose}
        onGuardada={cerrarGuardando(onGuardadaCotizacion)}
      />
    );
  }

  if (vista.tipo === "ot") {
    return (
      <DetalleOrdenTrabajo
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
      factura={vista.data}
      onNavegar={navegar}
      onClose={onClose}
      onGuardada={cerrarGuardando(onGuardadaFactura)}
    />
  );
}
