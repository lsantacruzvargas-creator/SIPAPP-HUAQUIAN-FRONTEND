import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUsuario, logout, fetchAuth } from "../utils/fetchAuth.js";
import PanelNotificaciones from "./PanelNotificaciones";

const ROL_LABEL = { admin: "Admin", tecnico: "Técnico", almacenero: "Almacenero", asistente: "Asistente", supervisor: "Supervisor" };

const TEMAS = [
  { id: "claro",  icon: "☀️", title: "Tema claro" },
  { id: "oscuro", icon: "🌙", title: "Tema oscuro" },
  { id: "sepia",  icon: "📜", title: "Tema sepia" },
];

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const usuario   = getUsuario();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tema, setTema] = useState(() => localStorage.getItem("tema") || "claro");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("tema", tema);
  }, [tema]);

  const handleLogout = () => { logout(); navigate("/login"); };

  const esActivo = (path) => location.pathname.startsWith(path);

  const linkCls = (path) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      esActivo(path)
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    }`;

  const linkMovil = (path) =>
    `block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      esActivo(path)
        ? "bg-blue-600 text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
    }`;

  const esTecnico    = usuario?.rol === "tecnico";
  const esAlmacenero = usuario?.rol === "almacenero";
  const esAdmin      = usuario?.rol === "admin";
  const esAsistente  = usuario?.rol === "asistente";
  const esSupervisor = usuario?.rol === "supervisor";
  const esComercial  = ["admin", "asistente"].includes(usuario?.rol);

  const ir = (path) => { navigate(path); setMenuOpen(false); };
  const inicial = usuario?.nombre?.charAt(0)?.toUpperCase() || "?";

  const [notificaciones, setNotificaciones] = useState([]);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [vistasHasta, setVistasHasta] = useState(() => Number(localStorage.getItem("notif_vistas_hasta")) || 0);

  useEffect(() => {
    if (!esComercial) return;
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
  }, [esComercial]);

  const sinVer = notificaciones.filter((n) => new Date(n.fecha).getTime() > vistasHasta).length;

  const togglePanel = () => {
    if (!panelAbierto) {
      const ahora = Date.now();
      localStorage.setItem("notif_vistas_hasta", String(ahora));
      setVistasHasta(ahora);
    }
    setPanelAbierto((v) => !v);
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">

        {/* Logo + links */}
        <div className="flex items-center gap-5">
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
            onClick={() => ir(esTecnico ? "/ordenes-trabajo" : esAlmacenero ? "/almacen" : "/dashboard")}
          >
            <img src={`${import.meta.env.BASE_URL}assets/logos/logo_recortado.jpg`} alt="Huaquian"
              className="w-9 h-9 rounded-xl object-contain shrink-0" />
            <span className="font-bold text-gray-800 text-base tracking-tight hidden sm:block">Huaquian</span>
          </div>

          {/* Links escritorio */}
          <div className="hidden md:flex items-center gap-1">
            {esComercial && (
              <button onClick={() => ir("/dashboard")} className={linkCls("/dashboard")}>Dashboard</button>
            )}
            {(esComercial || esTecnico || esSupervisor) && (
              <button onClick={() => ir("/ordenes-trabajo")} className={linkCls("/ordenes-trabajo")}>OTs</button>
            )}
            {esComercial && (<>
              <button onClick={() => ir("/cotizaciones")} className={linkCls("/cotizaciones")}>Ordenes de Trabajo</button>
              <button onClick={() => ir("/ordenes-compra")} className={linkCls("/ordenes-compra")}>Ordenes de Compra</button>
              <button onClick={() => ir("/facturas")} className={linkCls("/facturas")}>Facturas</button>
              <button onClick={() => ir("/facturacion-electronica")} className={linkCls("/facturacion-electronica")}>Fact. Electrónica</button>
              <button onClick={() => ir("/empresas")} className={linkCls("/empresas")}>Empresas</button>
              <button onClick={() => ir("/catalogo-servicios")} className={linkCls("/catalogo-servicios")}>Catálogo</button>
            </>)}
            {(esAdmin || esAlmacenero || esAsistente) && (
              <button onClick={() => ir("/almacen")} className={linkCls("/almacen")}>Almacén</button>
            )}
            {esAdmin && (
              <button onClick={() => ir("/usuarios")} className={linkCls("/usuarios")}>Usuarios</button>
            )}
          </div>
        </div>

        {/* Usuario + salir + hamburguesa */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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
          {esComercial && (
            <button
              onClick={togglePanel}
              title="Notificaciones"
              className="relative flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {sinVer > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {sinVer > 9 ? "9+" : sinVer}
                </span>
              )}
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700 leading-tight">{usuario?.nombre}</p>
              <p className="text-xs text-gray-400 leading-tight">{ROL_LABEL[usuario?.rol] ?? usuario?.rol}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {inicial}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-gray-500 hover:text-gray-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-3 px-4 space-y-1">
          <div className="flex items-center gap-3 px-1 pb-3 mb-2 border-b border-gray-100">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {inicial}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 leading-tight">{usuario?.nombre}</p>
              <p className="text-xs text-gray-400 leading-tight">{ROL_LABEL[usuario?.rol] ?? usuario?.rol}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-2 w-fit">
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
          {esComercial && (
            <button onClick={() => ir("/dashboard")} className={linkMovil("/dashboard")}>Dashboard</button>
          )}
          {(esComercial || esTecnico || esSupervisor) && (
            <button onClick={() => ir("/ordenes-trabajo")} className={linkMovil("/ordenes-trabajo")}>Órdenes de Trabajo</button>
          )}
          {esComercial && (<>
            <button onClick={() => ir("/cotizaciones")} className={linkMovil("/cotizaciones")}>Presupuesto</button>
            <button onClick={() => ir("/ordenes-compra")} className={linkMovil("/ordenes-compra")}>Órdenes de Compra</button>
            <button onClick={() => ir("/facturas")} className={linkMovil("/facturas")}>Facturas</button>
            <button onClick={() => ir("/facturacion-electronica")} className={linkMovil("/facturacion-electronica")}>Fact. Electrónica</button>
            <button onClick={() => ir("/empresas")} className={linkMovil("/empresas")}>Empresas</button>
            <button onClick={() => ir("/catalogo-servicios")} className={linkMovil("/catalogo-servicios")}>Catálogo</button>
          </>)}
          {(esAdmin || esAlmacenero || esAsistente) && (
            <button onClick={() => ir("/almacen")} className={linkMovil("/almacen")}>Almacén</button>
          )}
          {esAdmin && (
            <button onClick={() => ir("/usuarios")} className={linkMovil("/usuarios")}>Usuarios</button>
          )}
          <button onClick={handleLogout}
            className="block w-full text-left px-3 py-2 mt-1 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
            Cerrar sesión
          </button>
        </div>
      )}

      {panelAbierto && (
        <PanelNotificaciones notificaciones={notificaciones} onClose={() => setPanelAbierto(false)} />
      )}
    </nav>
  );
}
