import { useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const FORM_VACIO = { razonSocial: "", ruc: "", direccion: "", alias: "", plantas: [] };
const PLANTA_VACIA = { nombre: "", contactoNombre: "", contactoTelefono: "", contactoCorreo: "" };

export default function ModalEmpresa({ empresa, onClose, onGuardada }) {
  const [form, setForm] = useState(
    empresa
      ? {
          razonSocial: empresa.razonSocial,
          ruc: empresa.ruc,
          direccion: empresa.direccion || "",
          alias: empresa.alias || "",
          plantas: empresa.plantas || [],
        }
      : FORM_VACIO
  );
  const [plantaInput, setPlantaInput] = useState(PLANTA_VACIA);
  const [errorPlanta, setErrorPlanta] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePlantaInputChange = (e) =>
    setPlantaInput({ ...plantaInput, [e.target.name]: e.target.value });

  const agregarPlanta = () => {
    const datos = {
      nombre: plantaInput.nombre.trim(),
      contactoNombre: plantaInput.contactoNombre.trim(),
      contactoTelefono: plantaInput.contactoTelefono.trim(),
      contactoCorreo: plantaInput.contactoCorreo.trim(),
    };
    if (!datos.nombre || !datos.contactoNombre || !datos.contactoTelefono || !datos.contactoCorreo) {
      setErrorPlanta("Completa el nombre de la planta y su ficha de contacto completa.");
      return;
    }
    setErrorPlanta("");
    setForm((f) => ({ ...f, plantas: [...f.plantas, datos] }));
    setPlantaInput(PLANTA_VACIA);
  };

  const quitarPlanta = (idx) =>
    setForm((f) => ({ ...f, plantas: f.plantas.filter((_, i) => i !== idx) }));

  const guardar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const res = await fetchAuth(
        empresa ? `/empresas/${empresa._id}` : "/empresas",
        { method: empresa ? "PUT" : "POST", body: JSON.stringify(form) }
      );
      const data = await res.json();
      if (!res.ok) return setError(data.mensaje || "Error al guardar");
      onGuardada?.(data);
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4">
          {empresa ? "Editar empresa" : "Nueva empresa"}
        </h3>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={guardar} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Razón social</label>
            <input
              name="razonSocial"
              value={form.razonSocial}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">RUC</label>
            <input
              name="ruc"
              value={form.ruc}
              onChange={handleChange}
              required
              maxLength={11}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alias</label>
            <input
              name="alias"
              value={form.alias}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
            <input
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Plantas</label>
            <p className="text-xs text-gray-400 mb-2">
              Cada planta requiere su propia ficha de contacto (persona, teléfono y correo).
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                name="nombre"
                value={plantaInput.nombre}
                onChange={handlePlantaInputChange}
                placeholder="Nombre de la planta…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <input
                name="contactoNombre"
                value={plantaInput.contactoNombre}
                onChange={handlePlantaInputChange}
                placeholder="Persona de contacto…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <input
                name="contactoTelefono"
                value={plantaInput.contactoTelefono}
                onChange={handlePlantaInputChange}
                placeholder="Teléfono…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <input
                name="contactoCorreo"
                type="email"
                value={plantaInput.contactoCorreo}
                onChange={handlePlantaInputChange}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarPlanta(); } }}
                placeholder="Correo…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            {errorPlanta && <p className="text-xs text-red-500 mb-2">{errorPlanta}</p>}
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={agregarPlanta}
                className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
              >
                + Agregar
              </button>
            </div>
            {form.plantas.length > 0 && (
              <ul className="space-y-1">
                {form.plantas.map((p, idx) => (
                  <li key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-gray-700">
                      {p.nombre}
                      <span className="text-gray-400"> — {p.contactoNombre} · {p.contactoTelefono} · {p.contactoCorreo}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarPlanta(idx)}
                      className="text-gray-400 hover:text-red-500 transition text-base leading-none ml-2"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-50"
            >
              {cargando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
