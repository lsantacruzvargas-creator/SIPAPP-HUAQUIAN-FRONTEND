import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import AlertaGlobal from "./components/AlertaGlobal";
import AlertaDiscoLleno from "./components/AlertaDiscoLleno";
import { SidebarProvider, useSidebar } from "./context/SidebarContext.jsx";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import ListaCotizaciones from "./pages/ListaCotizaciones";
import Cotizaciones from "./pages/Cotizaciones";
import ListaOrdenesTrabajo from "./pages/ListaOrdenesTrabajo";
import ListaFacturas from "./pages/ListaFacturas";
import Reportes from "./pages/Reportes";
import ListaOrdenesCompra from "./pages/ListaOrdenesCompra";
import IngresoEquipos from "./pages/IngresoEquipos";
import Usuarios from "./pages/Usuarios";
import CatalogoServicios from "./pages/CatalogoServicios";
import Almacen from "./pages/Almacen";
import ListaComprobantes from "./pages/ListaComprobantes";
import EmitirComprobante from "./pages/EmitirComprobante";
import ListaGuias from "./pages/ListaGuias";
import EmitirGuia from "./pages/EmitirGuia";
import AprobacionCotizaciones from "./pages/AprobacionCotizaciones";
import Inventario from "./pages/Inventario";
import Requerimientos from "./pages/Requerimientos";
import TipoCambio from "./pages/TipoCambio";
import Sistema from "./pages/Sistema";
import NotFound from "./pages/NotFound";

function AppShell({ children }) {
  const { colapsado } = useSidebar();
  return (
    <>
      <Sidebar />
      <AlertaGlobal />
      <AlertaDiscoLleno />
      <main className={`min-h-screen transition-[margin] duration-200 ${colapsado ? "md:ml-[72px]" : "md:ml-60"}`}>
        {children}
      </main>
    </>
  );
}

function Layout({ children }) {
  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}

function HomeRedirect() {
  const token = sessionStorage.getItem("token");
  const usuario = JSON.parse(sessionStorage.getItem("usuario") || "null");
  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (["tecnico", "tecnico_prueba", "tecnico_intervencion", "supervisor", "planner", "asistente", "coordinadora"].includes(usuario.rol)) return <Navigate to="/ordenes-trabajo" replace />;
  if (usuario.rol === "jefatura") return <Navigate to="/aprobaciones" replace />;
  if (usuario.rol === "facturacion") return <Navigate to="/facturas" replace />;
  if (usuario.rol === "almacenero") return <Navigate to="/almacen" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />



      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["admin", "jefatura", "planner", "coordinadora", "asistente"]}>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/empresas"
        element={
          <ProtectedRoute roles={["admin", "asistente", "jefatura", "almacenero", "planner", "coordinadora"]}>
            <Layout><Empresas /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizaciones"
        element={
          <ProtectedRoute roles={["admin", "asistente", "jefatura", "planner", "coordinadora"]}>
            <Layout><ListaCotizaciones /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizaciones/nueva"
        element={
          <ProtectedRoute roles={["admin", "asistente", "jefatura"]}>
            <Layout><Cotizaciones /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ordenes-trabajo"
        element={
          <ProtectedRoute roles={["admin", "tecnico", "tecnico_prueba", "tecnico_intervencion", "asistente", "supervisor", "planner", "jefatura", "coordinadora"]}>
            <Layout><ListaOrdenesTrabajo /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/facturas"
        element={
          <ProtectedRoute roles={["admin", "facturacion", "jefatura"]}>
            <Layout><ListaFacturas /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes"
        element={
          <ProtectedRoute roles={["admin", "facturacion", "jefatura"]}>
            <Layout><Reportes /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ordenes-compra"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "jefatura", "coordinadora"]}>
            <Layout><ListaOrdenesCompra /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ingresos-equipo"
        element={
          <ProtectedRoute roles={["admin", "tecnico", "tecnico_prueba", "tecnico_intervencion", "asistente", "supervisor", "jefatura"]}>
            <Layout><IngresoEquipos /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Layout><Usuarios /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalogo-servicios"
        element={
          <ProtectedRoute roles={["admin", "jefatura", "coordinadora"]}>
            <Layout><CatalogoServicios /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/almacen"
        element={
          <ProtectedRoute roles={["admin", "almacenero", "jefatura", "coordinadora"]}>
            <Layout><Almacen /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/facturacion-electronica"
        element={
          <ProtectedRoute roles={["admin", "facturacion", "jefatura"]}>
            <Layout><ListaComprobantes /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion-electronica/emitir"
        element={
          <ProtectedRoute roles={["admin", "facturacion", "jefatura"]}>
            <Layout><EmitirComprobante /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion-electronica/guias"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "almacenero", "jefatura", "planner", "coordinadora"]}>
            <Layout><ListaGuias /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion-electronica/guias/emitir"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "almacenero", "jefatura", "planner", "coordinadora"]}>
            <Layout><EmitirGuia /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/aprobaciones"
        element={
          <ProtectedRoute roles={["admin", "jefatura"]}>
            <Layout><AprobacionCotizaciones /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventario"
        element={
          <ProtectedRoute roles={["admin", "almacenero", "tecnico", "tecnico_prueba", "tecnico_intervencion", "planner", "jefatura", "coordinadora"]}>
            <Layout><Inventario /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/requerimientos"
        element={
          <ProtectedRoute roles={["admin", "almacenero", "jefatura"]}>
            <Layout><Requerimientos /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tipo-cambio"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "almacenero", "jefatura"]}>
            <Layout><TipoCambio /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sistema"
        element={
          <ProtectedRoute roles={["admin", "jefatura"]}>
            <Layout><Sistema /></Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
