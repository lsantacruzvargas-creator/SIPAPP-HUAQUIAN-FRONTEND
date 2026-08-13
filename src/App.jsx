import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import { SidebarProvider, useSidebar } from "./context/SidebarContext.jsx";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import ListaCotizaciones from "./pages/ListaCotizaciones";
import Cotizaciones from "./pages/Cotizaciones";
import ListaOrdenesTrabajo from "./pages/ListaOrdenesTrabajo";
import ListaFacturas from "./pages/ListaFacturas";
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
import NotFound from "./pages/NotFound";

function AppShell({ children }) {
  const { colapsado } = useSidebar();
  return (
    <>
      <Sidebar />
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
  if (["tecnico", "supervisor", "planner"].includes(usuario.rol)) return <Navigate to="/ordenes-trabajo" replace />;
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
          <ProtectedRoute roles={["admin", "asistente", "jefatura"]}>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/empresas"
        element={
          <ProtectedRoute roles={["admin", "asistente", "jefatura"]}>
            <Layout><Empresas /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizaciones"
        element={
          <ProtectedRoute roles={["admin", "asistente", "jefatura", "planner"]}>
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
          <ProtectedRoute roles={["admin", "tecnico", "asistente", "supervisor", "planner", "jefatura"]}>
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
        path="/ordenes-compra"
        element={
          <ProtectedRoute roles={["admin", "asistente", "jefatura"]}>
            <Layout><ListaOrdenesCompra /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ingresos-equipo"
        element={
          <ProtectedRoute roles={["admin", "tecnico", "asistente", "supervisor", "jefatura"]}>
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
          <ProtectedRoute roles={["admin", "asistente", "jefatura"]}>
            <Layout><CatalogoServicios /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/almacen"
        element={
          <ProtectedRoute roles={["admin", "almacenero", "asistente", "jefatura"]}>
            <Layout><Almacen /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/facturacion-electronica"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "jefatura"]}>
            <Layout><ListaComprobantes /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion-electronica/emitir"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "jefatura"]}>
            <Layout><EmitirComprobante /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion-electronica/guias"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "almacenero", "jefatura"]}>
            <Layout><ListaGuias /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion-electronica/guias/emitir"
        element={
          <ProtectedRoute roles={["admin", "asistente", "facturacion", "almacenero", "jefatura"]}>
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
          <ProtectedRoute roles={["admin", "almacenero", "tecnico", "planner", "jefatura"]}>
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

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
