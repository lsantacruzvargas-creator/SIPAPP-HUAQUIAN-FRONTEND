import { Fragment, useState } from "react";

/* ─── Iconos SVG (stroke, currentColor) ─────────────────────────── */
const svg = "w-5 h-5";
export const IconCotizacion = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 9h1M9 13h6M9 17h6" />
  </svg>
);
export const IconOT = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18v3h3l6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2.3-.3-.3-2.3z" />
  </svg>
);
export const IconInforme = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" />
  </svg>
);
export const IconOC = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
  </svg>
);
export const IconFactura = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" /><path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);
export const IconCheck = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const IconGRE = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 16V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v10M3 16h11m0 0h2.5m-2.5 0V9h3.5L21 12.5V16h-2.5M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);

/* ─── Paletas por entidad ───────────────────────────────────────── */
export const TEMAS = {
  cotizacion: { icon: IconCotizacion, ring: "ring-sky-200",     dot: "bg-sky-500",     soft: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-100",     label: "Cotización" },
  ot:         { icon: IconOT,         ring: "ring-indigo-200",  dot: "bg-indigo-500",  soft: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-100",  label: "Orden de Trabajo" },
  informe:    { icon: IconInforme,    ring: "ring-violet-200",  dot: "bg-violet-500",  soft: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-100",  label: "Informe" },
  oc:         { icon: IconOC,         ring: "ring-blue-200",    dot: "bg-blue-500",    soft: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-100",    label: "Orden de Compra" },
  factura:    { icon: IconFactura,    ring: "ring-emerald-200", dot: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", label: "Factura" },
  gre:        { icon: IconGRE,        ring: "ring-purple-200",  dot: "bg-purple-500",  soft: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-100",  label: "Guía de Remisión" },
};

/* ─── Stepper del flujo de negocio ──────────────────────────────── */
export function FlujoNegocio({ pasos }) {
  return (
    <div className="flex items-start w-full">
      {pasos.map((p, i) => {
        const t = TEMAS[p.tipo];
        const Icon = t.icon;
        const activo = p.activo;
        return (
          <Fragment key={p.tipo}>
            <div className="flex flex-col items-center text-center shrink-0 w-24">
              <div className={`relative w-11 h-11 rounded-full flex items-center justify-center transition
                ${activo ? `${t.soft} ${t.text} ring-4 ${t.ring}` : "bg-gray-100 text-gray-300 ring-4 ring-gray-50"}`}>
                <Icon />
                {activo && (
                  <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${t.dot} text-white flex items-center justify-center border-2 border-white`}>
                    <IconCheck />
                  </span>
                )}
              </div>
              <span className={`mt-2 text-[11px] font-semibold ${activo ? "text-gray-700" : "text-gray-400"}`}>{t.label}</span>
              <span className={`text-[11px] font-mono ${activo ? t.text : "text-gray-300"}`}>{p.codigo || "—"}</span>
            </div>
            {i < pasos.length - 1 && (
              <div className={`flex-1 h-0.5 mt-[22px] rounded-full ${pasos[i + 1].activo && activo ? t.dot : "bg-gray-200"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/* ─── Tarjeta de relación ───────────────────────────────────────── */
export function TarjetaRelacion({ tipo, codigo, numero, children, vacio, actual, onClick, cargando, onCrear, crearLabel }) {
  const t = TEMAS[tipo];
  const Icon = t.icon;
  if (actual) {
    return (
      <div className="relative border border-gray-200 bg-gray-50 rounded-2xl p-5 min-h-[112px] opacity-80">
        <span className="absolute top-4 right-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Actual</span>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
            <Icon />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t.label}</p>
            <p className="font-mono text-sm font-bold text-gray-500 truncate">{codigo || "—"}</p>
          </div>
        </div>
        {numero && (
          <p className="inline-block font-mono text-base font-extrabold text-gray-500 bg-gray-100 rounded-lg px-2.5 py-1 mb-1 tracking-wide">
            {numero}
          </p>
        )}
        <div className="space-y-1">{children}</div>
      </div>
    );
  }
  if (vacio) {
    return (
      <div className="border border-dashed border-gray-200 rounded-2xl p-5 flex items-center gap-3 min-h-[112px] opacity-70">
        <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-300 flex items-center justify-center shrink-0">
          <Icon />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.label}</p>
          {onCrear ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCrear(); }}
              className="text-xs text-blue-600 hover:text-blue-800 underline mt-0.5"
            >
              + Crear {crearLabel || t.label}
            </button>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">No vinculada</p>
          )}
        </div>
      </div>
    );
  }
  const clickable = typeof onClick === "function";
  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") onClick(e); } : undefined}
      className={`tarjeta-relacion-color relative border ${t.border} ${t.soft} rounded-2xl p-5 min-h-[112px] hover:shadow-md hover:-translate-y-0.5 transition
        ${clickable ? "cursor-pointer" : ""} ${cargando ? "opacity-60 pointer-events-none" : ""}`}>
      {clickable && (
        <span className="absolute top-4 right-4 text-gray-300">→</span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white ${t.text} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon />
        </div>
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold ${t.text} uppercase tracking-wide`}>{t.label}</p>
          <p className="font-mono text-sm font-bold text-gray-800 truncate">{codigo || "—"}</p>
        </div>
      </div>
      {numero && (
        <p className={`inline-block font-mono text-base font-extrabold ${t.text} bg-white rounded-lg px-2.5 py-1 mb-1 shadow-sm tracking-wide`}>
          {numero}
        </p>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/* ─── Chip de estado genérico ───────────────────────────────────── */
export function Chip({ children, className }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${className}`}>
      {children}
    </span>
  );
}

/* Chip con punto de color a la izquierda (para tablas) */
export function DotChip({ children, chip, dot }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

/* Barra de progreso de pago */
export function BarraPago({ pagado, total, color = "bg-emerald-500" }) {
  const pct = total > 0 ? Math.min(100, Math.round((Number(pagado) / total) * 100)) : 0;
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const badgePago = (e) => {
  if (e === "pagado")       return "bg-green-100 text-green-700";
  if (e === "pago parcial") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
};
export const badgeOT = (e) => {
  if (e === "entregado")   return "bg-teal-100 text-teal-700";
  if (e === "completado")  return "bg-green-100 text-green-700";
  if (e === "en progreso") return "bg-blue-100 text-blue-700";
  if (e === "pendiente")   return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-500";
};
export const dotPago = (e) => {
  if (e === "pagado")       return "bg-green-500";
  if (e === "pago parcial") return "bg-amber-500";
  if (e === "sin pago")     return "bg-red-500";
  return "bg-gray-400";
};
export const dotOT = (e) => {
  if (e === "entregado")   return "bg-teal-500";
  if (e === "completado")  return "bg-green-500";
  if (e === "en progreso") return "bg-blue-500";
  if (e === "pendiente")   return "bg-amber-500";
  return "bg-gray-300";
};

// Estado agregado de Informes Técnicos de una OT (ver
// Backend/src/utils/recalcularInformesAprobados.js) — independiente del
// estado de la OT (`badgeOT`/`dotOT`).
export const badgeInformes = (e) => {
  if (e === "aprobado")                return "bg-teal-100 text-teal-700";
  if (e === "en espera de aprobación") return "bg-amber-100 text-amber-700";
  if (e === "en progreso")             return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-500"; // pendiente
};
export const dotInformes = (e) => {
  if (e === "aprobado")                return "bg-teal-500";
  if (e === "en espera de aprobación") return "bg-amber-500";
  if (e === "en progreso")             return "bg-blue-500";
  return "bg-gray-300"; // pendiente
};

// Una vez que la cadena de un documento se cierra (factura pagada), el
// documento entero queda de solo lectura para todos los roles salvo
// Jefatura — mismo criterio que el backend (utils/bloqueadoPorCadena.js).
export const bloqueadoPorCadenaCerrada = (estadoCadena, rolActual) =>
  estadoCadena === "cerrado" && rolActual !== "jefatura";

export const money = (v, moneda = "PEN") =>
  (moneda === "USD" ? "US$ " : "S/ ") + Number(v ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 });

/* ─── Anulación de documentos ────────────────────────────────────── */
export function BotonAnular({ onAnular }) {
  const [abierto, setAbierto]   = useState(false);
  const [motivo, setMotivo]     = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
        className="text-xs text-white/70 hover:text-white underline transition">
        Anular documento
      </button>
    );
  }

  const confirmar = async () => {
    if (!motivo.trim()) return;
    setEnviando(true);
    await onAnular(motivo.trim());
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h4 className="font-semibold text-gray-800">Anular documento</h4>
        <p className="text-sm text-gray-500">
          Esta acción es permanente y no se puede deshacer. Indica el motivo:
        </p>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} autoFocus
          placeholder="Motivo de la anulación…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
        <div className="flex gap-3 justify-end">
          <button onClick={() => { setAbierto(false); setMotivo(""); }} disabled={enviando}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={!motivo.trim() || enviando}
            className="text-sm bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium">
            {enviando ? "Anulando…" : "Confirmar anulación"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BannerAnulado({ motivo, por, fecha }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <span className="text-red-500 text-lg leading-none">⚠</span>
      <div>
        <p className="text-sm font-semibold text-red-700">Documento anulado</p>
        {motivo && <p className="text-xs text-red-600 mt-0.5">{motivo}</p>}
        <p className="text-xs text-red-400 mt-1">
          {por && `Por ${por}`}{fecha && ` · ${new Date(fecha).toLocaleString("es-PE")}`}
        </p>
      </div>
    </div>
  );
}
