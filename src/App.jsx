import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
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
import NotFound from "./pages/NotFound";

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function HomeRedirect() {
  const token = sessionStorage.getItem("token");
  const usuario = JSON.parse(sessionStorage.getItem("usuario") || "null");
  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (["tecnico", "supervisor"].includes(usuario.rol)) return <Navigate to="/ordenes-trabajo" replace />;
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
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/empresas"
        element={
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><Empresas /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizaciones"
        element={
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><ListaCotizaciones /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizaciones/nueva"
        element={
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><Cotizaciones /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ordenes-trabajo"
        element={
          <ProtectedRoute roles={["admin", "tecnico", "asistente", "supervisor"]}>
            <Layout><ListaOrdenesTrabajo /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/facturas"
        element={
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><ListaFacturas /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ordenes-compra"
        element={
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><ListaOrdenesCompra /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ingresos-equipo"
        element={
          <ProtectedRoute roles={["admin", "tecnico", "asistente", "supervisor"]}>
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
          <ProtectedRoute roles={["admin", "asistente"]}>
            <Layout><CatalogoServicios /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/almacen"
        element={
          <ProtectedRoute roles={["admin", "almacenero", "asistente"]}>
            <Layout><Almacen /></Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
