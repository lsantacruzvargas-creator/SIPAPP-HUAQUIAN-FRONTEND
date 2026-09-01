import { useState, useRef } from "react";
import { fetchAuth } from "../utils/fetchAuth";

const FORM_VACIO = { razonSocial: "", ruc: "", direccion: "", alias: "", requiereHes: false, requiereActaConformidad: false, plantas: [] };
const PLANTA_VACIA = { nombre: "", ubigeo: "", direccion: "", contactoNombre: "", contactoTelefono: "", contactoCorreo: "" };
const CONTACTO_VACIO = { nombre: "", telefono: "", correo: "" };

export default function ModalEmpresa({ empresa, onClose, onGuardada }) {
  const [form, setForm] = useState(
    empresa
      ? {
        razonSocial: empresa.razonSocial,
        ruc: empresa.ruc,
        direccion: empresa.direccion || "",
        alias: empresa.alias || "",
        requiereHes: empresa.requiereHes || false,
        requiereActaConformidad: empresa.requiereActaConformidad || false,
        plantas: empresa.plantas || [],
      }
      : FORM_VACIO
  );
  const [plantaInput, setPlantaInput] = useState(PLANTA_VACIA);
  const [errorPlanta, setErrorPlanta] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [buscandoRuc, setBuscandoRuc] = useState(false);
  // Contacto nuevo pendiente de agregar a una planta ya creada — solo una
  // planta a la vez tiene su mini-form de "+ agregar contacto" abierto.
  const [contactoNuevo, setContactoNuevo] = useState(CONTACTO_VACIO);
  const [plantaAgregandoContacto, setPlantaAgregandoContacto] = useState(null);
  // El input dispara la consulta tanto en Enter como en blur — sin este
  // guard, escribir el RUC y presionar Enter (y luego salir del campo)
  // consulta la API 2 veces por el mismo RUC (cada consulta ya cuesta 2
  // unidades de cuota en apiperu.dev: /ruc + /ruc-domicilio-fiscal).
  const ultimoRucConsultado = useRef("");
  // Clic en "Guardar" justo después de escribir el RUC dispara primero el
  // blur (arranca buscarDatosRuc, async) y recién después el submit — en ese
  // instante `buscandoRuc` (estado de React) todavía no se re-renderizó, así
  // que guardar() lo ve en `false` y sigue de largo con razonSocial aún
  // vacío, obligando a un segundo clic. Un ref sí queda actualizado de
  // inmediato (sin esperar un render), así que guardar() puede esperar la
  // consulta en curso en vez de solo chequear el flag.
  const consultaRucRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const buscarDatosRuc = (ruc) => {
    if (ruc.length !== 11 || ruc === ultimoRucConsultado.current) return;
    ultimoRucConsultado.current = ruc;
    setBuscandoRuc(true);
    consultaRucRef.current = (async () => {
      try {
        const res = await fetchAuth(`/sunat/ruc/${ruc}`);
        if (!res.ok) return;
        const data = await res.json();
        setForm((f) => ({
          ...f,
          razonSocial: data.razonSocial || f.razonSocial,
          direccion: data.direccion || f.direccion,
        }));
      } finally {
        setBuscandoRuc(false);
      }
    })();
  };

  const handlePlantaInputChange = (e) =>
    setPlantaInput({ ...plantaInput, [e.target.name]: e.target.value });

  // Cada planta nueva se crea junto con su primer contacto — los contactos
  // adicionales se agregan después, directo en la lista, con
  // "+ Agregar contacto" (ver agregarContacto).
  const agregarPlanta = () => {
    const nombre = plantaInput.nombre.trim();
    const ubigeo = plantaInput.ubigeo.trim();
    const direccion = plantaInput.direccion.trim();
    const contactoNombre = plantaInput.contactoNombre.trim();
    const contactoTelefono = plantaInput.contactoTelefono.trim();
    const contactoCorreo = plantaInput.contactoCorreo.trim();
    if (!nombre || !contactoNombre || !contactoTelefono) {
      setErrorPlanta("Completa el nombre de la planta y su primer contacto (nombre y teléfono).");
      return;
    }
    setErrorPlanta("");
    setForm((f) => ({
      ...f,
      plantas: [...f.plantas, { nombre, ubigeo, direccion, contactos: [{ nombre: contactoNombre, telefono: contactoTelefono, correo: contactoCorreo }] }],
    }));
    setPlantaInput(PLANTA_VACIA);
  };

  const quitarPlanta = (idx) =>
    setForm((f) => ({ ...f, plantas: f.plantas.filter((_, i) => i !== idx) }));

  const abrirAgregarContacto = (idx) => {
    setPlantaAgregandoContacto(idx);
    setContactoNuevo(CONTACTO_VACIO);
    setErrorPlanta("");
  };

  const agregarContacto = (idx) => {
    const nombre = contactoNuevo.nombre.trim();
    const telefono = contactoNuevo.telefono.trim();
    const correo = contactoNuevo.correo.trim();
    if (!nombre || !telefono) {
      setErrorPlanta("Completa nombre y teléfono del contacto.");
      return;
    }
    setErrorPlanta("");
    setForm((f) => ({
      ...f,
      plantas: f.plantas.map((p, i) =>
        i === idx ? { ...p, contactos: [...(p.contactos || []), { nombre, telefono, correo }] } : p
      ),
    }));
    setContactoNuevo(CONTACTO_VACIO);
    setPlantaAgregandoContacto(null);
  };

  const quitarContacto = (idxPlanta, idxContacto) =>
    setForm((f) => ({
      ...f,
      plantas: f.plantas.map((p, i) =>
        i === idxPlanta ? { ...p, contactos: p.contactos.filter((_, ci) => ci !== idxContacto) } : p
      ),
    }));

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      // Si el clic en "Guardar" llegó justo después de escribir el RUC, el
      // blur recién disparó la consulta a SUNAT — esperarla acá evita el
      // error falso de "no se pudo obtener la razón social" y el reintento
      // manual del usuario.
      if (consultaRucRef.current) await consultaRucRef.current;
      if (!form.razonSocial.trim()) {
        setError("No se pudo obtener la razón social para este RUC. Verifica que el RUC sea correcto.");
        return;
      }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-800 mb-4">
          {empresa ? "Editar empresa" : "Nueva empresa"}
        </h3>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={guardar} className="grid grid-cols-2 gap-4">
          <div className="col-span-2" >
            <label className="block text-xs font-medium text-gray-600 mb-1">Razón social</label>
            <input
              disabled
              name="razonSocial"
              value={form.razonSocial}
              onChange={handleChange}
    
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              RUC{buscandoRuc && <span className="text-gray-400 font-normal"> — Consultando…</span>}
            </label>
            <input
              name="ruc"
              value={form.ruc}
              onChange={handleChange}
              onBlur={(e) => buscarDatosRuc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarDatosRuc(e.target.value); } }}
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
              disabled
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="requiereHes"
                checked={form.requiereHes}
                onChange={handleChange}
                className="w-4 h-4"
              />
              Exige confirmar HES antes de facturar
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="requiereActaConformidad"
                checked={form.requiereActaConformidad}
                onChange={handleChange}
                className="w-4 h-4"
              />
              Exige confirmar Acta de Conformidad antes de facturar
            </label>
            <p className="col-span-2 text-xs text-gray-400">
              Cada uno es independiente — si está activo, las Órdenes de Compra de esta empresa mostrarán ese checkbox y deberá marcarse antes de poder generar la factura.
            </p>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Plantas</label>
            <p className="text-xs text-gray-400 mb-2">
              Cada planta requiere al menos un contacto (nombre y teléfono) — se pueden agregar más después.
              Ubigeo y dirección son opcionales, pero se usan para autocompletar el punto de llegada al emitir una guía hacia esta planta.
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
                name="ubigeo"
                value={plantaInput.ubigeo}
                onChange={handlePlantaInputChange}
                maxLength={6}
                placeholder="Ubigeo (6 dígitos)…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <input
                name="direccion"
                value={plantaInput.direccion}
                onChange={handlePlantaInputChange}
                placeholder="Dirección de la planta…"
                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
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
              <ul className="space-y-2">
                {form.plantas.map((p, idx) => (
                  <li key={idx} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{p.nombre}</span>
                      <button
                        type="button"
                        onClick={() => quitarPlanta(idx)}
                        className="text-gray-400 hover:text-red-500 transition text-base leading-none ml-2"
                      >
                        ✕
                      </button>
                    </div>
                    {(p.ubigeo || p.direccion) && (
                      <p className="text-xs text-gray-400 pl-1">
                        {p.ubigeo && <span className="font-mono">{p.ubigeo}</span>}{p.ubigeo && p.direccion ? " — " : ""}{p.direccion}
                      </p>
                    )}
                    {(p.contactos || []).length > 0 && (
                      <ul className="space-y-1">
                        {p.contactos.map((c, ci) => (
                          <li key={ci} className="flex items-center justify-between text-xs text-gray-500 pl-1">
                            <span>{c.nombre} · {c.telefono}{c.correo ? ` · ${c.correo}` : ""}</span>
                            <button
                              type="button"
                              onClick={() => quitarContacto(idx, ci)}
                              className="text-gray-300 hover:text-red-500 transition"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {plantaAgregandoContacto === idx ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <input
                          value={contactoNuevo.nombre}
                          onChange={(e) => setContactoNuevo((c) => ({ ...c, nombre: e.target.value }))}
                          placeholder="Nombre"
                          className="flex-1 min-w-[100px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                        <input
                          value={contactoNuevo.telefono}
                          onChange={(e) => setContactoNuevo((c) => ({ ...c, telefono: e.target.value }))}
                          placeholder="Teléfono"
                          className="flex-1 min-w-[90px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                        <input
                          value={contactoNuevo.correo}
                          onChange={(e) => setContactoNuevo((c) => ({ ...c, correo: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarContacto(idx); } }}
                          placeholder="Correo (opcional)"
                          className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                        <button type="button" onClick={() => agregarContacto(idx)}
                          className="text-xs bg-gray-900 text-white px-2.5 rounded-lg hover:bg-gray-700 transition shrink-0">
                          Agregar
                        </button>
                        <button type="button" onClick={() => setPlantaAgregandoContacto(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition shrink-0">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirAgregarContacto(idx)}
                        className="text-xs text-blue-500 hover:text-blue-700 transition"
                      >
                        + Agregar contacto
                      </button>
                    )}
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
              disabled={cargando || buscandoRuc}
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
