import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, roles }) {
  const token = sessionStorage.getItem("token");
  const usuario = JSON.parse(sessionStorage.getItem("usuario") || "null");

  if (!token || !usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return children;
}
