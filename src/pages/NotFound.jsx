import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <span className="text-8xl font-bold text-gray-200">404</span>
      <p className="text-gray-400 text-sm">Página no encontrada</p>
      <Link
        to="/dashboard"
        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
