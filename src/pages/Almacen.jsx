import { useState, useEffect, useCallback } from "react";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import ModalImportarExcel, { COLS_MATERIALES } from "../components/ModalImportarExcel";

const INP =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white";

const UNIDADES = ["und", "kg", "g", "L", "mL", "m", "cm", "m²", "caja", "rollo", "par", "juego", "bolsa"];

// ─── Sección Ubicaciones ────────────────────────────────────────────────────

function SeccionUbicaciones() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nombre: "", descripcion: "" });
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetchAuth("/ubicaciones");
    if (r.ok) setLista(await r.json());
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const iniciarEdicion = (u) => {
    setEditando(u._id);
    setForm({ nombre: u.nombre, descripcion: u.descripcion });
  };

  const cancelar = () => {
    setEditando(null);
    setForm({ nombre: "", descripcion: "" });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setGuardando(true);
    const metodo = editando ? "PUT" : "POST";
    const url = editando ? `/ubicaciones/${editando}` : "/ubicaciones";
    const r = await fetchAuth(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      await cargar();
      cancelar();
    }
    setGuardando(false);
  };

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {editando ? "Editar ubicación" : "Nueva ubicación"}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange}
              className={`w-full ${INP}`} placeholder="Ej: Estante A, Bodega principal" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
            <input name="descripcion" value={form.descripcion} onChange={handleChange}
              className={`w-full ${INP}`} placeholder="Opcional" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {editando && (
            <button onClick={cancelar}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              Cancelar
            </button>
          )}
          <button onClick={guardar} disabled={guardando || !form.nombre.trim()}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : editando ? "Actualizar" : "Crear ubicación"}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Descripción</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lista.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-300 text-sm">Sin ubicaciones registradas</td></tr>
            )}
            {lista.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50/50 transition">
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{u.codigo}</td>
                <td className="px-5 py-3 font-medium text-gray-800">{u.nombre}</td>
                <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{u.descripcion || "—"}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => iniciarEdicion(u)}
                    className="text-xs text-blue-500 hover:text-blue-700 transition">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sección Materiales ─────────────────────────────────────────────────────

const FORM_MATERIAL_VACIO = {
  tipoComponente: "", categoria: "", codigo: "", nombre: "", descripcion: "",
  unidad: "und", stockMinimo: 0, ubicacion: "", tipoMaterial: "",
};

function SeccionMateriales() {
  const [lista, setLista] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [tiposComponente, setTiposComponente] = useState([]);
  const [categoriasComponente, setCategoriasComponente] = useState([]);
  const [form, setForm] = useState(FORM_MATERIAL_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState("");
  const [importarOpen, setImportarOpen] = useState(false);

  const cargar = useCallback(async () => {
    const [rm, ru, rt, rc] = await Promise.all([
      fetchAuth("/materiales?todas=true"),
      fetchAuth("/ubicaciones"),
      fetchAuth("/tipos-componente"),
      fetchAuth("/categorias-componente"),
    ]);
    if (rm.ok) setLista(await rm.json());
    if (ru.ok) setUbicaciones(await ru.json());
    if (rt.ok) setTiposComponente(await rt.json());
    if (rc.ok) setCategoriasComponente(await rc.json());
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Cambiar el Tipo Componente invalida la Categoría elegida (es hija del
    // tipo anterior) — se resetea para no dejar una combinación inconsistente.
    if (name === "tipoComponente") {
      setForm({ ...form, tipoComponente: value, categoria: "" });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const categoriasDelTipo = categoriasComponente.filter(
    (c) => (c.tipoComponente?._id || c.tipoComponente) === form.tipoComponente
  );

  // Un SKU es inmutable una vez creado (ver PUT /materiales/:id en backend) —
  // lo único que se puede cambiar después es `activo`, con este toggle.
  const cambiarActivo = async (m, activo) => {
    const r = await fetchAuth(`/materiales/${m._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    if (r.ok) await cargar();
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    if (!form.tipoMaterial) { setError("Selecciona si es Repuesto o Consumible."); return; }
    setError("");
    setGuardando(true);
    const r = await fetchAuth("/materiales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      await cargar();
      setForm(FORM_MATERIAL_VACIO);
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.mensaje || "Error al guardar el material.");
    }
    setGuardando(false);
  };

  const filtrados = lista
    .filter((m) => mostrarInactivos || m.activo)
    .filter((m) =>
      m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.sku?.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const badgeStock = (m) => {
    if (m.stock <= 0) return "bg-red-100 text-red-700";
    if (m.stock <= m.stockMinimo) return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
  };

  return (
    <div className="space-y-6">
      {/* Formulario — solo creación: un SKU ya creado es inmutable, la única
          acción posterior es activarlo/desactivarlo desde la tabla. */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Nuevo material (SKU)
          </p>
          {getUsuario()?.rol === "admin" && (
            <button type="button" onClick={() => setImportarOpen(true)}
              className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium">
              ↑ Importar inventario (Excel)
            </button>
          )}
        </div>
        {/* Orden del formulario: Tipo Componente → Categoría → Código → Título/Descripción */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Tipo Componente</label>
            <select name="tipoComponente" value={form.tipoComponente} onChange={handleChange} className={`w-full ${INP}`}>
              <option value="">Sin clasificar</option>
              {tiposComponente.map((t) => <option key={t._id} value={t._id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Categoría</label>
            <select name="categoria" value={form.categoria} onChange={handleChange} disabled={!form.tipoComponente} className={`w-full ${INP}`}>
              <option value="">{form.tipoComponente ? "Sin clasificar" : "Elige un Tipo Componente primero"}</option>
              {categoriasDelTipo.map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Código</label>
            <input name="codigo" value={form.codigo} onChange={handleChange}
              className={`w-full ${INP}`} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Título *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange}
              className={`w-full ${INP}`} placeholder="Ej: Válvula de expansión 3/8" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
            <input name="descripcion" value={form.descripcion} onChange={handleChange}
              className={`w-full ${INP}`} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Unidad de medida</label>
            <select name="unidad" value={form.unidad} onChange={handleChange} className={`w-full ${INP}`}>
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Stock mínimo</label>
            <input type="number" name="stockMinimo" value={form.stockMinimo} onChange={handleChange}
              min={0} className={`w-full ${INP}`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ubicación</label>
            <select name="ubicacion" value={form.ubicacion} onChange={handleChange} className={`w-full ${INP}`}>
              <option value="">Sin ubicación</option>
              {ubicaciones.map((u) => <option key={u._id} value={u._id}>{u.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Centro de costo *</label>
            <select name="tipoMaterial" value={form.tipoMaterial} onChange={handleChange} className={`w-full ${INP}`}>
              <option value="">Seleccionar…</option>
              <option value="repuesto">Repuesto</option>
              <option value="consumible">Consumible</option>
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={guardar} disabled={guardando || !form.nombre.trim() || !form.tipoMaterial}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : "Crear material"}
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-4">
        <input
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          className={`flex-1 ${INP}`} placeholder="Buscar por SKU, título o descripción…" />
        <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      {/* Tabla — ancha al 80vw (se sale del contenedor max-w-6xl de la página) */}
      <div className="relative left-1/2 -ml-[40vw] w-[80vw] max-w-[80vw] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Título</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo Componente</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ubicación</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-300 text-sm">Sin materiales</td></tr>
            )}
            {filtrados.map((m) => (
              <tr key={m._id} className={`hover:bg-gray-50/50 transition ${!m.activo ? "opacity-50" : ""}`}>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{m.sku}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{m.codigo || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 font-medium text-gray-800">{m.nombre}</td>
                <td className="px-5 py-3 text-gray-500">{m.descripcion || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 text-gray-500">{m.tipoComponente?.nombre || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 text-gray-500">{m.categoria?.nombre || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeStock(m)}`}>
                      {m.stock} {m.unidad}
                    </span>
                    {m.stock <= m.stockMinimo && (
                      <span className="text-xs text-amber-600 font-medium">
                        ⚠ mín: {m.stockMinimo}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{m.ubicacion?.nombre || "—"}</td>
                <td className="px-5 py-3 text-center">
                  <input type="checkbox" checked={m.activo}
                    onChange={(e) => cambiarActivo(m, e.target.checked)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {importarOpen && (
        <ModalImportarExcel
          tipo="Materiales"
          columnas={COLS_MATERIALES}
          endpoint="/materiales/importar"
          color="blue"
          nombreColeccion="todos los Materiales (SKU) y sus movimientos de almacén"
          instrucciones={
            <>1. Descarga la plantilla, rellena tus datos y súbela. El <strong>SKU</strong> lo
            genera el sistema automáticamente — no va en el Excel. <strong>Tipo Componente</strong>,{" "}
            <strong>Categoría</strong> y <strong>Ubicación</strong> se crean solos si no existen todavía.</>
          }
          onClose={() => setImportarOpen(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}

// ─── Sección Categorías de Material ─────────────────────────────────────────

const TIPOS_CAMPO = [
  { id: "texto", label: "Texto" },
  { id: "numero", label: "Número" },
  { id: "select", label: "Lista de opciones" },
];

const slug = (s) => s.trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const CAMPO_VACIO = { nombre: "", clave: "", tipo: "texto", opciones: "", requerido: false };

function SeccionCategorias() {
  const [lista, setLista] = useState([]);
  const [nombre, setNombre] = useState("");
  const [campos, setCampos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const r = await fetchAuth("/categorias-material");
    if (r.ok) setLista(await r.json());
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cancelar = () => { setEditando(null); setNombre(""); setCampos([]); setError(""); };

  const iniciarEdicion = (c) => {
    setEditando(c._id);
    setNombre(c.nombre);
    setCampos(c.campos.map((cp) => ({ ...cp, opciones: (cp.opciones || []).join(", ") })));
  };

  const agregarCampo = () => setCampos((prev) => [...prev, { ...CAMPO_VACIO }]);
  const quitarCampo = (i) => setCampos((prev) => prev.filter((_, idx) => idx !== i));
  const cambiarCampo = (i, patch) => setCampos((prev) => prev.map((c, idx) => idx === i
    ? { ...c, ...patch, ...(patch.nombre !== undefined && !c.clave ? { clave: slug(patch.nombre) } : {}) }
    : c));

  const guardar = async () => {
    if (!nombre.trim()) { setError("El nombre de la categoría es obligatorio."); return; }
    for (const c of campos) {
      if (!c.nombre.trim() || !c.clave.trim()) { setError("Todos los campos necesitan nombre."); return; }
    }
    setGuardando(true);
    setError("");
    const body = {
      nombre: nombre.trim(),
      campos: campos.map((c) => ({
        nombre: c.nombre.trim(),
        clave: c.clave.trim(),
        tipo: c.tipo,
        requerido: !!c.requerido,
        opciones: c.tipo === "select" ? c.opciones.split(",").map((s) => s.trim()).filter(Boolean) : [],
      })),
    };
    const metodo = editando ? "PUT" : "POST";
    const url = editando ? `/categorias-material/${editando}` : "/categorias-material";
    const r = await fetchAuth(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      await cargar();
      cancelar();
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al guardar la categoría");
    }
    setGuardando(false);
  };

  const eliminar = async (c) => {
    if (!window.confirm(`¿Desactivar la categoría "${c.nombre}"?`)) return;
    const r = await fetchAuth(`/categorias-material/${c._id}`, { method: "DELETE" });
    if (r.ok) await cargar();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {editando ? "Editar categoría" : "Nueva categoría de material"}
        </p>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)}
            className={`w-full max-w-sm ${INP}`} placeholder="Ej: Repuestos eléctricos" />
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-500">Campos del formulario de solicitud de compra</p>
          {campos.map((c, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr_auto_auto] gap-2 items-center bg-gray-50 rounded-lg p-2">
              <input value={c.nombre} onChange={(e) => cambiarCampo(i, { nombre: e.target.value })}
                className={INP} placeholder="Nombre del campo" />
              <select value={c.tipo} onChange={(e) => cambiarCampo(i, { tipo: e.target.value })} className={INP}>
                {TIPOS_CAMPO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {c.tipo === "select" ? (
                <input value={c.opciones} onChange={(e) => cambiarCampo(i, { opciones: e.target.value })}
                  className={INP} placeholder="Opciones separadas por coma" />
              ) : <span />}
              <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                <input type="checkbox" checked={c.requerido} onChange={(e) => cambiarCampo(i, { requerido: e.target.checked })} />
                Requerido
              </label>
              <button onClick={() => quitarCampo(i)} className="text-gray-300 hover:text-red-500 transition">✕</button>
            </div>
          ))}
          <button onClick={agregarCampo}
            className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium">
            + Agregar campo
          </button>
        </div>

        <div className="flex gap-2 mt-5">
          {editando && (
            <button onClick={cancelar}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              Cancelar
            </button>
          )}
          <button onClick={guardar} disabled={guardando || !nombre.trim()}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : editando ? "Actualizar" : "Crear categoría"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campos</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lista.length === 0 && (
              <tr><td colSpan={3} className="text-center py-10 text-gray-300 text-sm">Sin categorías registradas</td></tr>
            )}
            {lista.map((c) => (
              <tr key={c._id} className="hover:bg-gray-50/50 transition">
                <td className="px-5 py-3 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {c.campos.length === 0 ? "—" : c.campos.map((cp) => cp.nombre).join(", ")}
                </td>
                <td className="px-5 py-3 text-right space-x-3">
                  <button onClick={() => iniciarEdicion(c)} className="text-xs text-blue-500 hover:text-blue-700 transition">Editar</button>
                  <button onClick={() => eliminar(c)} className="text-xs text-gray-400 hover:text-red-500 transition">Desactivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sección Tipo Componente / Categoría ────────────────────────────────────
// Jerarquía de clasificación de Materiales (distinta de "Categorías de
// compra" — esa es un catálogo aparte para formularios de solicitud). Un
// Tipo Componente agrupa varias Categorías hijas; una Categoría no existe
// sin su Tipo Componente padre.

function SeccionComponentes() {
  const [tipos, setTipos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tipoSel, setTipoSel] = useState(null);

  const [nombreTipo, setNombreTipo] = useState("");
  const [editandoTipo, setEditandoTipo] = useState(null);
  const [guardandoTipo, setGuardandoTipo] = useState(false);
  const [errorTipo, setErrorTipo] = useState("");

  const [nombreCat, setNombreCat] = useState("");
  const [editandoCat, setEditandoCat] = useState(null);
  const [guardandoCat, setGuardandoCat] = useState(false);
  const [errorCat, setErrorCat] = useState("");

  const cargar = useCallback(async () => {
    const [rt, rc] = await Promise.all([
      fetchAuth("/tipos-componente"),
      fetchAuth("/categorias-componente"),
    ]);
    if (rt.ok) setTipos(await rt.json());
    if (rc.ok) setCategorias(await rc.json());
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cancelarTipo = () => { setEditandoTipo(null); setNombreTipo(""); setErrorTipo(""); };
  const iniciarEdicionTipo = (t) => { setEditandoTipo(t._id); setNombreTipo(t.nombre); setErrorTipo(""); };

  const guardarTipo = async () => {
    if (!nombreTipo.trim()) { setErrorTipo("El nombre es obligatorio."); return; }
    setGuardandoTipo(true);
    setErrorTipo("");
    const metodo = editandoTipo ? "PUT" : "POST";
    const url = editandoTipo ? `/tipos-componente/${editandoTipo}` : "/tipos-componente";
    const r = await fetchAuth(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombreTipo.trim() }) });
    if (r.ok) { await cargar(); cancelarTipo(); }
    else { const d = await r.json().catch(() => ({})); setErrorTipo(d.mensaje || "Error al guardar el Tipo Componente."); }
    setGuardandoTipo(false);
  };

  const eliminarTipo = async (t) => {
    if (!window.confirm(`¿Desactivar el Tipo Componente "${t.nombre}"? También sus categorías hijas dejarán de aparecer para elegir.`)) return;
    const r = await fetchAuth(`/tipos-componente/${t._id}`, { method: "DELETE" });
    if (r.ok) { await cargar(); if (tipoSel === t._id) setTipoSel(null); }
  };

  const categoriasDelTipo = categorias.filter((c) => (c.tipoComponente?._id || c.tipoComponente) === tipoSel);

  const cancelarCat = () => { setEditandoCat(null); setNombreCat(""); setErrorCat(""); };
  const iniciarEdicionCat = (c) => { setEditandoCat(c._id); setNombreCat(c.nombre); setErrorCat(""); };

  const guardarCat = async () => {
    if (!nombreCat.trim()) { setErrorCat("El nombre es obligatorio."); return; }
    setGuardandoCat(true);
    setErrorCat("");
    const metodo = editandoCat ? "PUT" : "POST";
    const url = editandoCat ? `/categorias-componente/${editandoCat}` : "/categorias-componente";
    const body = editandoCat ? { nombre: nombreCat.trim() } : { nombre: nombreCat.trim(), tipoComponente: tipoSel };
    const r = await fetchAuth(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { await cargar(); cancelarCat(); }
    else { const d = await r.json().catch(() => ({})); setErrorCat(d.mensaje || "Error al guardar la Categoría."); }
    setGuardandoCat(false);
  };

  const eliminarCat = async (c) => {
    if (!window.confirm(`¿Desactivar la categoría "${c.nombre}"?`)) return;
    const r = await fetchAuth(`/categorias-componente/${c._id}`, { method: "DELETE" });
    if (r.ok) await cargar();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tipos Componente */}
      <div className="space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {editandoTipo ? "Editar Tipo Componente" : "Nuevo Tipo Componente"}
          </p>
          {errorTipo && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">{errorTipo}</p>}
          <input value={nombreTipo} onChange={(e) => setNombreTipo(e.target.value)}
            className={`w-full ${INP}`} placeholder="Ej: Semiconductores" />
          <div className="flex gap-2 mt-4">
            {editandoTipo && (
              <button onClick={cancelarTipo} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
            )}
            <button onClick={guardarTipo} disabled={guardandoTipo || !nombreTipo.trim()}
              className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
              {guardandoTipo ? "Guardando…" : editandoTipo ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo Componente</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tipos.length === 0 && (
                <tr><td colSpan={2} className="text-center py-10 text-gray-300 text-sm">Sin tipos registrados</td></tr>
              )}
              {tipos.map((t) => (
                <tr key={t._id}
                  onClick={() => setTipoSel(t._id)}
                  className={`cursor-pointer transition ${tipoSel === t._id ? "bg-blue-50" : "hover:bg-gray-50/50"}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{t.nombre}</td>
                  <td className="px-5 py-3 text-right space-x-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => iniciarEdicionTipo(t)} className="text-xs text-blue-500 hover:text-blue-700 transition">Editar</button>
                    <button onClick={() => eliminarTipo(t)} className="text-xs text-gray-400 hover:text-red-500 transition">Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Categorías del Tipo Componente elegido */}
      <div className="space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {tipoSel
              ? `${editandoCat ? "Editar" : "Nueva"} categoría de "${tipos.find((t) => t._id === tipoSel)?.nombre}"`
              : "Elige un Tipo Componente a la izquierda"}
          </p>
          {tipoSel && (
            <>
              {errorCat && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">{errorCat}</p>}
              <input value={nombreCat} onChange={(e) => setNombreCat(e.target.value)}
                className={`w-full ${INP}`} placeholder="Ej: Compresores" />
              <div className="flex gap-2 mt-4">
                {editandoCat && (
                  <button onClick={cancelarCat} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
                )}
                <button onClick={guardarCat} disabled={guardandoCat || !nombreCat.trim()}
                  className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
                  {guardandoCat ? "Guardando…" : editandoCat ? "Actualizar" : "Crear"}
                </button>
              </div>
            </>
          )}
        </div>

        {tipoSel && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categoriasDelTipo.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-10 text-gray-300 text-sm">Sin categorías registradas</td></tr>
                )}
                {categoriasDelTipo.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3 font-medium text-gray-800">{c.nombre}</td>
                    <td className="px-5 py-3 text-right space-x-3">
                      <button onClick={() => iniciarEdicionCat(c)} className="text-xs text-blue-500 hover:text-blue-700 transition">Editar</button>
                      <button onClick={() => eliminarCat(c)} className="text-xs text-gray-400 hover:text-red-500 transition">Desactivar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal Ingreso ──────────────────────────────────────────────────────────

function ModalIngreso({ materiales, onClose, onGuardado }) {
  const [form, setForm] = useState({
    material: "",
    cantidad: "",
    precioUnitario: "",
    lote: "",
    guiaProveedor: "",
    ordenCompra: "",
    proveedor: "",
    notas: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [rqPendiente, setRqPendiente] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Si este material tiene una solicitud de compra vinculada y pendiente, se
  // avisa acá — pero el ingreso por sí solo NO la resuelve: el almacenero
  // todavía debe "Atender" el ítem desde Requerimientos (crea el egreso real
  // hacia la OT que lo pidió) una vez que este stock esté disponible.
  useEffect(() => {
    if (!form.material) { setRqPendiente(null); return; }
    fetchAuth("/requerimientos").then((r) => r.ok ? r.json() : []).then((lista) => {
      for (const req of lista) {
        const item = req.items.find((it) =>
          it.esSolicitudCompra && it.estado === "pendiente" &&
          (it.materialAsociado?._id || it.materialAsociado) === form.material);
        if (item) { setRqPendiente({ requerimientoId: req._id, itemId: item._id, codigo: req.codigo, categoria: item.categoriaNombre }); return; }
      }
      setRqPendiente(null);
    });
  }, [form.material]);

  const guardar = async () => {
    if (!form.material || !form.cantidad || !form.precioUnitario) {
      setError("Material, cantidad y precio son obligatorios.");
      return;
    }
    setGuardando(true);
    const r = await fetchAuth("/movimientos-almacen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tipo: "ingreso" }),
    });
    if (r.ok) {
      const movimiento = await r.json();
      onGuardado(movimiento);
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al guardar");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Nuevo ingreso</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Material *</label>
              <select name="material" value={form.material} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Seleccionar material…</option>
                {materiales.map((m) => (
                  <option key={m._id} value={m._id}>{m.sku} — {m.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cantidad *</label>
              <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange}
                min={0.01} step="any" className={`w-full ${INP}`} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Precio unitario (S/) *</label>
              <input type="number" name="precioUnitario" value={form.precioUnitario} onChange={handleChange}
                min={0} step="0.01" className={`w-full ${INP}`} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Lote / Identificador</label>
              <input name="lote" value={form.lote} onChange={handleChange}
                className={`w-full ${INP}`} placeholder="Auto si se deja vacío" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha</label>
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
              <input name="proveedor" value={form.proveedor} onChange={handleChange}
                className={`w-full ${INP}`} placeholder="Nombre del proveedor" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Guía del proveedor</label>
              <input name="guiaProveedor" value={form.guiaProveedor} onChange={handleChange}
                className={`w-full ${INP}`} placeholder="N° de guía" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Orden de compra</label>
              <input name="ordenCompra" value={form.ordenCompra} onChange={handleChange}
                className={`w-full ${INP}`} placeholder="N° de OC" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Notas</label>
              <input name="notas" value={form.notas} onChange={handleChange}
                className={`w-full ${INP}`} placeholder="Opcional" />
            </div>
          </div>

          {rqPendiente && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
              <span className="text-blue-700">
                Este material abastece la solicitud de compra <strong>{rqPendiente.codigo}</strong> ({rqPendiente.categoria}) — despáchala desde Requerimientos ("Atender") una vez guardado este ingreso.
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : "Registrar ingreso"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Egreso Manual ────────────────────────────────────────────────────

function ModalEgreso({ materiales, onClose, onGuardado }) {
  const [form, setForm] = useState({
    material: "",
    cantidad: "",
    loteOrigen: "",
    notas: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [lotes, setLotes] = useState([]);
  const [precioAuto, setPrecioAuto] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [busquedaMaterial, setBusquedaMaterial] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => {
    if (!form.material) { setLotes([]); return; }
    fetchAuth(`/movimientos-almacen/lotes/${form.material}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setLotes);
  }, [form.material]);

  const q = busquedaMaterial.trim().toLowerCase();
  const materialesFiltrados = q
    ? materiales.filter((m) =>
        m.sku?.toLowerCase().includes(q) ||
        m.nombre?.toLowerCase().includes(q) ||
        m.ubicacion?.nombre?.toLowerCase().includes(q)
      )
    : materiales;
  // si el material ya seleccionado queda fuera del filtro, se mantiene visible
  // para no dejar el <select> apuntando a un value sin <option> en el DOM
  const materialSeleccionado = materiales.find((m) => m._id === form.material);
  if (materialSeleccionado && !materialesFiltrados.some((m) => m._id === materialSeleccionado._id)) {
    materialesFiltrados.unshift(materialSeleccionado);
  }

  const seleccionarLote = (lote) => {
    setForm((prev) => ({ ...prev, loteOrigen: lote.lote }));
    setPrecioAuto(lote.precioUnitario);
  };

  const guardar = async () => {
    if (!form.material || !form.cantidad) {
      setError("Material y cantidad son obligatorios.");
      return;
    }
    setGuardando(true);
    const r = await fetchAuth("/movimientos-almacen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tipo: "egreso", precioUnitario: precioAuto }),
    });
    if (r.ok) {
      onGuardado(await r.json());
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al guardar");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Nuevo egreso</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Material *</label>
              <input type="text" value={busquedaMaterial} onChange={(e) => setBusquedaMaterial(e.target.value)}
                placeholder="Buscar por SKU, nombre o ubicación…" className={`w-full mb-2 ${INP}`} />
              <select name="material" value={form.material} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Seleccionar material…</option>
                {materialesFiltrados.map((m) => (
                  <option key={m._id} value={m._id}>{m.sku} — {m.nombre} (stock: {m.stock} {m.unidad})</option>
                ))}
              </select>
            </div>

            {lotes.length > 0 && (
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 block mb-2">Seleccionar lote *</label>
                <div className="space-y-2">
                  {lotes.map((l) => (
                    <button key={l.lote} type="button" onClick={() => seleccionarLote(l)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                        form.loteOrigen === l.lote
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-semibold text-gray-700">{l.lote}</span>
                        <span className="font-semibold text-gray-800">S/ {Number(l.precioUnitario).toFixed(2)}</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400">
                        {l.proveedor && <span>{l.proveedor}</span>}
                        <span>Disponible: <strong>{l.cantidadDisponible}</strong></span>
                        <span>{new Date(l.fecha).toLocaleDateString("es-PE")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.loteOrigen && (
              <div className="md:col-span-2 bg-blue-50 rounded-xl px-4 py-3 text-sm">
                <span className="text-blue-700">Precio unitario del lote: </span>
                <span className="font-semibold text-blue-800">S/ {Number(precioAuto).toFixed(2)}</span>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Cantidad *</label>
              <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange}
                min={0.01} step="any" className={`w-full ${INP}`} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha</label>
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className={`w-full ${INP}`} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Notas</label>
              <input name="notas" value={form.notas} onChange={handleChange}
                className={`w-full ${INP}`} placeholder="Opcional" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-rose-600 text-white px-5 py-2 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : "Registrar egreso"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección Movimientos ────────────────────────────────────────────────────

function SeccionMovimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [modalIngreso, setModalIngreso] = useState(false);
  const [modalEgreso, setModalEgreso] = useState(false);

  const cargar = useCallback(async () => {
    const params = new URLSearchParams();
    if (filtroTipo) params.set("tipo", filtroTipo);
    if (filtroMaterial) params.set("material", filtroMaterial);

    const [rm, rmat] = await Promise.all([
      fetchAuth(`/movimientos-almacen?${params}`),
      fetchAuth("/materiales"),
    ]);
    if (rm.ok) setMovimientos(await rm.json());
    if (rmat.ok) setMateriales(await rmat.json());
  }, [filtroTipo, filtroMaterial]);

  useEffect(() => { cargar(); }, [cargar]);

  const onGuardado = async () => {
    setModalIngreso(false);
    setModalEgreso(false);
    await cargar();
  };

  const fmt = (n) => Number(n || 0).toFixed(2);
  const fmtFecha = (d) => d ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  return (
    <div className="space-y-5">
      {/* Acciones y filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={() => setModalIngreso(true)}
          className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
          + Ingreso
        </button>
        <button onClick={() => setModalEgreso(true)}
          className="text-sm bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition font-medium">
          − Egreso
        </button>

        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={INP}>
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>

        <select value={filtroMaterial} onChange={(e) => setFiltroMaterial(e.target.value)} className={INP}>
          <option value="">Todos los materiales</option>
          {materiales.map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Material</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio U.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Lote / Origen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Detalle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">OT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">RQ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant. Req.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant. Atendida</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movimientos.length === 0 && (
                <tr><td colSpan={13} className="text-center py-10 text-gray-300 text-sm">Sin movimientos</td></tr>
              )}
              {movimientos.map((mv) => (
                <tr key={mv._id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{mv.codigo}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      mv.tipo === "ingreso" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}>
                      {mv.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{mv.material?.nombre || "—"}</p>
                    <p className="text-xs text-gray-400 font-mono">{mv.material?.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono">
                    {mv.cantidad} {mv.material?.unidad}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono">S/ {fmt(mv.precioUnitario)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">
                    S/ {fmt(mv.cantidad * mv.precioUnitario)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden lg:table-cell">
                    {mv.tipo === "ingreso" ? mv.lote : mv.loteOrigen || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                    {mv.tipo === "ingreso" ? (
                      <span>{mv.proveedor || ""}  {mv.guiaProveedor ? `G: ${mv.guiaProveedor}` : ""} {mv.ordenCompra ? `OC: ${mv.ordenCompra}` : ""}</span>
                    ) : (
                      mv.notas || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-blue-600">{mv.ordenTrabajo?.codigo || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-orange-600">{mv.requerimiento?.codigo || "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500 font-mono">{mv.cantidadRequerida ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-700 font-mono">{mv.requerimiento ? mv.cantidad : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtFecha(mv.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalIngreso && (
        <ModalIngreso materiales={materiales} onClose={() => setModalIngreso(false)} onGuardado={onGuardado} />
      )}
      {modalEgreso && (
        <ModalEgreso materiales={materiales} onClose={() => setModalEgreso(false)} onGuardado={onGuardado} />
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

const TABS = [
  { id: "ubicaciones", label: "Ubicaciones" },
  { id: "materiales", label: "Materiales (SKU)" },
  { id: "movimientos", label: "Movimientos" },
  { id: "componentes", label: "Tipos de Componente" },
  { id: "categorias", label: "Categorías de compra" },
];

export default function Almacen() {
  const [tab, setTab] = useState("materiales");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Almacén</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestión de ubicaciones, materiales e inventario</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ubicaciones" && <SeccionUbicaciones />}
      {tab === "materiales" && <SeccionMateriales />}
      {tab === "movimientos" && <SeccionMovimientos />}
      {tab === "componentes" && <SeccionComponentes />}
      {tab === "categorias" && <SeccionCategorias />}
    </div>
  );
}
