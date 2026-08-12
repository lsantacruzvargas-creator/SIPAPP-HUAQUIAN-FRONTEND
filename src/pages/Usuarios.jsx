import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const ROLES = ["admin", "tecnico", "almacenero", "asistente", "supervisor"];

const badgeRol = (rol) => {
  if (rol === "admin")      return "bg-red-50 text-red-700";
  if (rol === "tecnico")    return "bg-amber-50 text-amber-700";
  if (rol === "almacenero") return "bg-purple-50 text-purple-700";
  if (rol === "asistente")  return "bg-teal-50 text-teal-700";
  if (rol === "supervisor") return "bg-indigo-50 text-indigo-700";
  return "bg-gray-100 text-gray-500";
};

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 w-full";

// ── Modal Usuario ────────────────────────────────────────────────────────────
function ModalUsuario({ usuario, onClose, onGuardado }) {
  const esEdicion = !!usuario;
  const [form, setForm] = useState({
    nombre:   usuario?.nombre   ?? "",
    username: usuario?.username ?? "",
    password: "",
    rol:      usuario?.rol      ?? "tecnico",
    activo:   usuario?.activo   ?? true,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError]   = useState("");

  const handleChange = (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.username.trim()) {
      setError("Nombre y usuario son obligatorios.");
      return;
    }
    if (!esEdicion && !form.password) {
      setError("La contraseña es obligatoria para nuevos usuarios.");
      return;
    }
    setError("");
    setGuardando(true);
    const payload = { ...form };
    if (esEdicion && !payload.password) delete payload.password;

    const res = await fetchAuth(
      esEdicion ? `/usuarios/${usuario._id}` : "/usuarios",
      {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) {
      onGuardado(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.mensaje ?? "Error al guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            {esEdicion ? "Editar usuario" : "Nuevo usuario"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre completo</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} className={INP} placeholder="Ej. Juan Pérez" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Usuario (login)</label>
              <input name="username" value={form.username} onChange={handleChange} className={INP} placeholder="juanp" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Contraseña {esEdicion && <span className="text-gray-300">(dejar vacío = sin cambio)</span>}
              </label>
              <input type="password" name="password" value={form.password} onChange={handleChange} className={INP} placeholder="••••••••" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rol</label>
              <select name="rol" value={form.rol} onChange={handleChange} className={INP}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {esEdicion && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} className="accent-gray-800 w-4 h-4" />
                  Cuenta activa
                </label>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Personal ───────────────────────────────────────────────────────────
function ModalPersonal({ persona, onClose, onGuardado }) {
  const esEdicion = !!persona;
  const [form, setForm] = useState({
    nombre: persona?.nombre ?? "",
    cargo:  persona?.cargo  ?? "",
    activo: persona?.activo ?? true,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setError("");
    setGuardando(true);
    const res = await fetchAuth(
      esEdicion ? `/personal/${persona._id}` : "/personal",
      {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    if (res.ok) {
      onGuardado(await res.json());
    } else {
      setError("Error al guardar.");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            {esEdicion ? "Editar personal" : "Nuevo personal"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre completo</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} className={INP} placeholder="Ej. Carlos Quispe" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Cargo / especialidad</label>
            <input name="cargo" value={form.cargo} onChange={handleChange} className={INP} placeholder="Ej. Técnico de refrigeración" />
          </div>
          {esEdicion && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} className="accent-gray-800 w-4 h-4" />
              Activo (disponible para asignación)
            </label>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-amber-500 text-white px-5 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [modalUsr, setModalUsr] = useState(null);   // null | "nuevo" | objeto usuario
  const [modalPer, setModalPer] = useState(null);   // null | "nuevo" | objeto persona

  useEffect(() => {
    Promise.all([
      fetchAuth("/usuarios").then((r) => r.ok ? r.json() : []),
      fetchAuth("/personal").then((r) => r.ok ? r.json() : []),
    ]).then(([u, p]) => { setUsuarios(u); setPersonal(p); });
  }, []);

  const upsertUsuario = (u) => {
    setUsuarios((prev) => {
      const existe = prev.find((x) => x._id === u._id);
      return existe ? prev.map((x) => (x._id === u._id ? u : x)) : [u, ...prev];
    });
    setModalUsr(null);
  };

  const upsertPersonal = (p) => {
    setPersonal((prev) => {
      const existe = prev.find((x) => x._id === p._id);
      return existe ? prev.map((x) => (x._id === p._id ? p : x)) : [...prev, p];
    });
    setModalPer(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">

      {/* ── Usuarios del sistema ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Usuarios del sistema</h2>
            <p className="text-xs text-gray-400 mt-0.5 mb-2">Cuentas con acceso a la aplicación</p>
          </div>
          <button
            onClick={() => setModalUsr("nuevo")}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
          >
            + Nuevo usuario
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-500 text-white text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-center">Rol</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin usuarios registrados</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setModalUsr(u)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.codigo}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{u.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badgeRol(u.rol)}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${u.activo ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* ── Personal asignable ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Personal asignable</h2>
            <p className="text-xs text-gray-400 mt-0.5 mb-2">Personas disponibles para asignación en órdenes de trabajo</p>
          </div>
          <button
            onClick={() => setModalPer("nuevo")}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600 transition"
          >
            + Agregar personal
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-gray-500 text-white text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Cargo / especialidad</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {personal.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Sin personal registrado</td></tr>
              ) : personal.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setModalPer(p)}>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{p.cargo || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${p.activo ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* Modales */}
      {modalUsr && (
        <ModalUsuario
          usuario={modalUsr === "nuevo" ? null : modalUsr}
          onClose={() => setModalUsr(null)}
          onGuardado={upsertUsuario}
        />
      )}
      {modalPer && (
        <ModalPersonal
          persona={modalPer === "nuevo" ? null : modalPer}
          onClose={() => setModalPer(null)}
          onGuardado={upsertPersonal}
        />
      )}
    </div>
  );
}
