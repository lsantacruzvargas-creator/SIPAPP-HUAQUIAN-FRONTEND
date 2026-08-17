import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUsuario, logout, fetchAuth } from "../utils/fetchAuth.js";
import { useSidebar } from "../context/SidebarContext.jsx";
import PanelNotificaciones from "./PanelNotificaciones";

// "asistente" es el valor de rol real (DB/JWT/permisos) — solo se renombra
// la etiqueta visible a "Administración", nunca el valor almacenado.
const ROL_LABEL = { admin: "Admin", tecnico: "Técnico", almacenero: "Almacenero", asistente: "Administración", supervisor: "Supervisor", jefatura: "Jefatura", facturacion: "Facturación", planner: "Planner" };

const TEMAS = [
  { id: "claro",  icon: "☀️", title: "Tema claro" },
  { id: "oscuro", icon: "🌙", title: "Tema oscuro" },
  { id: "sepia",  icon: "📜", title: "Tema sepia" },
];

// Íconos de línea, 20x20, mismo estilo que la campana/logout ya usados en el
// proyecto (stroke-2, currentColor) — sin agregar ninguna librería de íconos.
const IconHome = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
);
const IconClipboard = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
);
const IconDocument = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M9 8h1m4 13H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const IconCart = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.7 1.7c-.6.6-.2 1.7.7 1.7H17m-10 4a1 1 0 102 0 1 1 0 00-2 0zm10 0a1 1 0 102 0 1 1 0 00-2 0z" /></svg>
);
const IconReceipt = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6" /></svg>
);
const IconBolt = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
);
const IconBuilding = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 12h.01M9 15h.01" /></svg>
);
const IconTag = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5.586a1 1 0 01.707.293l6.414 6.414a1 1 0 010 1.414l-7.586 7.586a1 1 0 01-1.414 0l-6.414-6.414A1 1 0 014 11.586V7a4 4 0 013-4z" /></svg>
);
const IconArchive = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7M9 11h6M4 4h16v3H4z" /></svg>
);
const IconUsers = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3.5 3.5 0 10-1-6.87" /></svg>
);
const IconCheckCircle = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const IconTruck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16V6a1 1 0 011-1h9a1 1 0 011 1v10M3 16h11m0 0h2.5m-2.5 0V9h3.5L21 12.5V16h-2.5M7 19a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z" /></svg>
);
const IconExchange = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v13m0 0l-3-3m3 3l3-3m7-7V4m0 0l3 3m-3-3l-3 3" /></svg>
);
const IconBoxes = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
);
const IconClipboardList = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6" /></svg>
);
const IconPanelClose = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16m4-8l-2 2 2 2" /></svg>
);
const IconPanelOpen = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16m3-8l2-2-2-2" /></svg>
);

// El caller ya gatea el render con `colapsado &&` (solo se usa en modo
// colapsado, tooltip al hover) — componente de nivel de módulo, no definido
// dentro de Sidebar(), para no recrearlo en cada render.
const Tooltip = ({ children }) => (
  <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-gray-900 text-white text-xs px-2 py-1 opacity-0 scale-95 origin-left transition-all group-hover:opacity-100 group-hover:scale-100 z-50">
    {children}
  </span>
);

export default function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const usuario   = getUsuario();
  const { colapsado, setColapsado } = useSidebar();
  const [abierto, setAbierto]   = useState(false); // drawer móvil
  const [tema, setTema] = useState(() => localStorage.getItem("tema") || "claro");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("tema", tema);
  }, [tema]);

  const handleLogout = () => { logout(); navigate("/login"); };

  const esActivo = (path) => location.pathname.startsWith(path);

  const esTecnico    = usuario?.rol === "tecnico";
  const esAlmacenero = usuario?.rol === "almacenero";
  const esAdmin      = usuario?.rol === "admin";
  const esSupervisor = usuario?.rol === "supervisor";
  const esJefatura   = usuario?.rol === "jefatura";
  const esFacturacion = usuario?.rol === "facturacion";
  const esPlanner    = usuario?.rol === "planner";
  const esComercial  = ["admin", "asistente"].includes(usuario?.rol);

  const ir = (path) => { navigate(path); setAbierto(false); };
  const inicial = usuario?.nombre?.charAt(0)?.toUpperCase() || "?";

  const [notificaciones, setNotificaciones] = useState([]);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [vistasHasta, setVistasHasta] = useState(() => Number(localStorage.getItem("notif_vistas_hasta")) || 0);

  useEffect(() => {
    const cargar = () => {
      fetchAuth("/notificaciones")
        .then((r) => r.ok && r.json())
        .then((data) => data && setNotificaciones(data));
    };
    cargar();
    const intervalo = setInterval(cargar, 60000);
    // Refresco inmediato: cualquier guardado exitoso en la app (Cotización,
    // OT, Informe, OC, Factura, Catálogo) dispara este evento desde fetchAuth.
    window.addEventListener("app:cambio-guardado", cargar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("app:cambio-guardado", cargar);
    };
  }, []);

  const sinVer = notificaciones.filter((n) => new Date(n.fecha).getTime() > vistasHasta).length;

  const togglePanel = () => {
    if (!panelAbierto) {
      const ahora = Date.now();
      localStorage.setItem("notif_vistas_hasta", String(ahora));
      setVistasHasta(ahora);
    }
    setPanelAbierto((v) => !v);
  };

  // Matriz de roles (confirmada explícitamente por el usuario):
  // - tecnico: solo OTs + Inventario.
  // - almacenero: Almacén, Inventario, Requerimientos, Tipo de Cambio, Guías.
  // - asistente: sin cambios (mantiene su acceso "comercial" ya existente).
  // - planner: solo OTs, Cotizaciones e Inventario.
  // - facturacion: solo Facturas, Fact. Electrónica, Guías y Tipo de Cambio.
  // - jefatura: todo excepto Usuarios.
  // - admin: todo, incluyendo Usuarios.
  const NAV_ITEMS = [
    { to: "/dashboard", label: "Dashboard", Icon: IconHome, show: esComercial || esJefatura },
    { to: "/ordenes-trabajo", label: "Orden de Trabajo", Icon: IconClipboard, show: esComercial || esTecnico || esSupervisor || esPlanner || esJefatura },
    { to: "/cotizaciones", label: "Cotizaciones", Icon: IconDocument, show: esComercial || esPlanner || esJefatura },
    { to: "/ordenes-compra", label: "Órdenes de Compra", Icon: IconCart, show: esAdmin || esFacturacion || esJefatura },
    { to: "/facturas", label: "Facturas", Icon: IconReceipt, show: esAdmin || esFacturacion || esJefatura },
    { to: "/facturacion-electronica", label: "Fact. Electrónica", Icon: IconBolt, show: esComercial || esFacturacion || esJefatura },
    { to: "/facturacion-electronica/guias", label: "Guías", Icon: IconTruck, show: esAdmin || esFacturacion || esAlmacenero || esJefatura },
    { to: "/tipo-cambio", label: "Tipo de Cambio", Icon: IconExchange, show: esAdmin || esFacturacion || esAlmacenero || esJefatura },
    { to: "/empresas", label: "Empresas", Icon: IconBuilding, show: esComercial || esJefatura || esAlmacenero || esPlanner },
    { to: "/catalogo-servicios", label: "Catálogo", Icon: IconTag, show: esAdmin || esJefatura },
    { to: "/almacen", label: "Almacén", Icon: IconArchive, show: esAdmin || esAlmacenero || esJefatura },
    { to: "/inventario", label: "Inventario", Icon: IconBoxes, show: esAdmin || esAlmacenero || esTecnico || esPlanner || esJefatura },
    { to: "/requerimientos", label: "Requerimientos", Icon: IconClipboardList, show: esAdmin || esAlmacenero || esJefatura },
    { to: "/aprobaciones", label: "Aprobaciones", Icon: IconCheckCircle, show: esAdmin || esJefatura },
    { to: "/usuarios", label: "Usuarios", Icon: IconUsers, show: esAdmin },
  ];

  const itemCls = (activo) =>
    `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      activo ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    }`;

  return (
    <>
      {/* Header móvil (<md): logo + hamburguesa. El sidebar completo se abre como drawer. */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => ir(esTecnico || esPlanner ? "/ordenes-trabajo" : esAlmacenero ? "/almacen" : esJefatura ? "/aprobaciones" : esFacturacion ? "/facturas" : "/dashboard")}>
          <img src={`${import.meta.env.BASE_URL}assets/logos/logo_huaquian.jpg`} alt="Huaquian"
            className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <span className="font-bold text-gray-800 text-base tracking-tight">Huaquian</span>
        </div>
        <button onClick={() => setAbierto(true)} className="p-2 text-gray-500 hover:text-gray-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Overlay del drawer móvil */}
      {abierto && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setAbierto(false)} />
      )}

      {/* Sidebar: drawer fijo en móvil, columna fija en desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${
        colapsado ? "w-60 md:w-[72px]" : "w-60"
      } ${abierto ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>

        {/* Botón flotante de colapso (solo desktop) */}
        <button
          onClick={() => setColapsado(!colapsado)}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="hidden md:flex absolute top-6 -right-3 w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm items-center justify-center text-gray-500 hover:text-blue-600 z-10"
        >
          {colapsado ? <IconPanelOpen className="w-3.5 h-3.5" /> : <IconPanelClose className="w-3.5 h-3.5" />}
        </button>

        {/* Bloque 1: logo */}
        <div
          onClick={() => ir(esTecnico || esPlanner ? "/ordenes-trabajo" : esAlmacenero ? "/almacen" : esJefatura ? "/aprobaciones" : esFacturacion ? "/facturas" : "/dashboard")}
          className={`h-16 shrink-0 flex items-center border-b border-gray-100 cursor-pointer gap-2.5 ${
            colapsado ? "px-4 md:px-0 md:justify-center" : "px-4"
          }`}
        >
          <img src={`${import.meta.env.BASE_URL}assets/logos/logo_huaquian.jpg`} alt="Huaquian"
            className="w-9 h-9 rounded-xl object-contain shrink-0" />
          <span className={`font-bold text-gray-800 text-base tracking-tight ${colapsado ? "md:hidden" : ""}`}>Huaquian</span>
        </div>

        {/* Bloque 2: navegación */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_ITEMS.filter((i) => i.show).map(({ to, label, Icon }) => (
            <button key={to} onClick={() => ir(to)} className={itemCls(esActivo(to))}>
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className={colapsado ? "md:hidden" : ""}>{label}</span>
              {colapsado && <span className="hidden md:contents"><Tooltip>{label}</Tooltip></span>}
            </button>
          ))}
        </nav>

        {/* Bloque 3: temas + notificaciones + usuario + salir */}
        <div className="shrink-0 border-t border-gray-100 p-3 space-y-2">
          <div className={`flex items-center gap-1 bg-gray-100 rounded-lg p-1 ${colapsado ? "md:flex-col md:w-fit md:mx-auto" : "w-fit"}`}>
            {TEMAS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTema(t.id)}
                title={t.title}
                className={`w-7 h-7 rounded-md text-sm flex items-center justify-center transition-colors ${
                  tema === t.id ? "bg-white shadow-sm" : "opacity-50 hover:opacity-80"
                }`}
              >
                {t.icon}
              </button>
            ))}
          </div>

          <button
            onClick={togglePanel}
            className={`group relative w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors ${colapsado ? "md:justify-center" : ""}`}
          >
            <span className="relative shrink-0">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {sinVer > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {sinVer > 9 ? "9+" : sinVer}
                </span>
              )}
            </span>
            <span className={colapsado ? "md:hidden" : ""}>Notificaciones</span>
            {colapsado && <span className="hidden md:contents"><Tooltip>Notificaciones</Tooltip></span>}
          </button>

          <div className={`flex items-center gap-2.5 px-1 pt-1 ${colapsado ? "md:justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
              {inicial}
            </div>
            <div className={colapsado ? "md:hidden" : ""}>
              <p className="text-sm font-semibold text-gray-700 leading-tight">{usuario?.nombre}</p>
              <p className="text-xs text-gray-400 leading-tight">{ROL_LABEL[usuario?.rol] ?? usuario?.rol}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className={`group relative w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors ${colapsado ? "md:justify-center" : ""}`}
          >
            <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={colapsado ? "md:hidden" : ""}>Cerrar sesión</span>
            {colapsado && <span className="hidden md:contents"><Tooltip>Cerrar sesión</Tooltip></span>}
          </button>
        </div>
      </aside>

      {panelAbierto && (
        <PanelNotificaciones notificaciones={notificaciones} onClose={() => setPanelAbierto(false)} />
      )}
    </>
  );
}
