import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { version as APP_VERSION } from "../../package.json";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.mensaje || "Error al iniciar sesión");
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("usuario", JSON.stringify(data.usuario));
      navigate("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={`${import.meta.env.BASE_URL}assets/logos/logo_recortado.jpg`} alt="Alcoinsac"
            className="w-9 h-9 rounded-xl object-contain" />
          <div>
            <p className="font-bold text-gray-800">
              SIP App <span className="text-xs font-normal text-gray-400">v{APP_VERSION}</span>
            </p>
            <p className="text-xs text-gray-400">Alcoinsac</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label">Nombre de usuario</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              autoFocus
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>
          <button type="submit" disabled={cargando} className="btn-primary w-full justify-center py-2.5">
            {cargando ? "Iniciando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
