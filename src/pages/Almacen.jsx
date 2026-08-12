import { useState, useEffect, useCallback } from "react";
import { fetchAuth } from "../utils/fetchAuth";

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

function SeccionMateriales() {
  const [lista, setLista] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [form, setForm] = useState({ nombre: "", descripcion: "", unidad: "und", stockMinimo: 0, ubicacion: "" });
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    const [rm, ru] = await Promise.all([
      fetchAuth("/materiales"),
      fetchAuth("/ubicaciones"),
    ]);
    if (rm.ok) setLista(await rm.json());
    if (ru.ok) setUbicaciones(await ru.json());
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const iniciarEdicion = (m) => {
    setEditando(m._id);
    setForm({
      nombre: m.nombre,
      descripcion: m.descripcion,
      unidad: m.unidad,
      stockMinimo: m.stockMinimo,
      ubicacion: m.ubicacion?._id || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelar = () => {
    setEditando(null);
    setForm({ nombre: "", descripcion: "", unidad: "und", stockMinimo: 0, ubicacion: "" });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setGuardando(true);
    const metodo = editando ? "PUT" : "POST";
    const url = editando ? `/materiales/${editando}` : "/materiales";
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

  const filtrados = lista.filter((m) =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const badgeStock = (m) => {
    if (m.stock <= 0) return "bg-red-100 text-red-700";
    if (m.stock <= m.stockMinimo) return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
  };

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {editando ? "Editar material" : "Nuevo material (SKU)"}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
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
            {guardando ? "Guardando…" : editando ? "Actualizar" : "Crear material"}
          </button>
        </div>
      </div>

      {/* Buscador */}
      <input
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        className={`w-full ${INP}`} placeholder="Buscar por nombre o código…" />

      {/* Tabla */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Unidad</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Ubicación</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-300 text-sm">Sin materiales</td></tr>
            )}
            {filtrados.map((m) => (
              <tr key={m._id} className="hover:bg-gray-50/50 transition">
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{m.codigo}</td>
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{m.nombre}</p>
                  {m.descripcion && <p className="text-xs text-gray-400">{m.descripcion}</p>}
                </td>
                <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{m.unidad}</td>
                <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{m.ubicacion?.nombre || "—"}</td>
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
                <td className="px-5 py-3 text-right">
                  <button onClick={() => iniciarEdicion(m)}
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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
                  <option key={m._id} value={m._id}>{m.codigo} — {m.nombre}</option>
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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => {
    if (!form.material) { setLotes([]); return; }
    fetchAuth(`/movimientos-almacen/lotes/${form.material}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setLotes);
  }, [form.material]);

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
              <select name="material" value={form.material} onChange={handleChange} className={`w-full ${INP}`}>
                <option value="">Seleccionar material…</option>
                {materiales.map((m) => (
                  <option key={m._id} value={m._id}>{m.codigo} — {m.nombre} (stock: {m.stock} {m.unidad})</option>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movimientos.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-300 text-sm">Sin movimientos</td></tr>
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
                    <p className="text-xs text-gray-400 font-mono">{mv.material?.codigo}</p>
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
                      mv.ordenTrabajo ? (
                        <span className="font-mono text-blue-600">{mv.ordenTrabajo.codigo}</span>
                      ) : mv.notas || "—"
                    )}
                  </td>
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
    </div>
  );
}
