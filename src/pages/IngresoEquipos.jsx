import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import ModalOTEquipo from "../components/ModalOTEquipo";

const ESTADOS = ["recibido", "en diagnóstico", "en reparación", "listo", "entregado"];
const ESTADOS_OT = ["pendiente", "en progreso", "completado", "entregado"];
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const badgeOT = (e) => {
  if (e === "entregado")   return "bg-teal-50 text-teal-700";
  if (e === "completado")  return "bg-green-50 text-green-700";
  if (e === "en progreso") return "bg-blue-50 text-blue-700";
  if (e === "pendiente")   return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-400";
};

const hoyISO = () => new Date().toISOString().split("T")[0];

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";
const INP_RO = "border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 w-full cursor-not-allowed";
const FORM_VACIO = {
  empresa: "",
  planta: "",
  fechaIngreso: hoyISO(),
  tipoEquipo: "",
  marca: "",
  modelo: "",
  caracteristicasElectricas: "",
  accesorios: "",
  descripcionProblema: "",
  numeroGuiaEmision: "",
  garantia: "false",
  estado: "recibido",
};

export default function IngresoEquipos() {
  const [ingresos, setIngresos]     = useState([]);
  const [empresas, setEmpresas]     = useState([]);
  const [otMap, setOtMap]           = useState({});
  const [busqueda, setBusqueda]         = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [anioFiltro, setAnioFiltro]     = useState("");
  const [mesFiltro, setMesFiltro]       = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [plantaFiltro, setPlantaFiltro]   = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [form, setForm]             = useState(FORM_VACIO);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");
  const [crearOT, setCrearOT]       = useState(false);

  const cargar = () =>
    Promise.all([
      fetchAuth("/ingresos-equipo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/empresas").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
    ]).then(([ings, emps, ots]) => {
      setIngresos(ings);
      setEmpresas(emps);
      const m = {};
      ots.forEach((ot) => {
        const ieId = ot.ingresoEquipo?._id || ot.ingresoEquipo;
        if (ieId && !m[ieId]) m[ieId] = ot;
      });
      setOtMap(m);
    });

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setSeleccionado(null);
    setForm(FORM_VACIO);
    setError("");
    setModalAbierto(true);
  };

  const abrirEditar = (ing) => {
    setSeleccionado(ing);
    setForm({
      empresa:                  ing.empresa?._id || "",
      planta:                   ing.planta || "",
      fechaIngreso:             ing.fechaIngreso ? ing.fechaIngreso.split("T")[0] : hoyISO(),
      tipoEquipo:               ing.tipoEquipo || "",
      marca:                    ing.marca || "",
      modelo:                   ing.modelo || "",
      caracteristicasElectricas: ing.caracteristicasElectricas || "",
      accesorios:               ing.accesorios || "",
      descripcionProblema:      ing.descripcionProblema || "",
      numeroGuiaEmision:        ing.numeroGuiaEmision || "",
      garantia:                 String(ing.garantia ?? false),
      estado:                   ing.estado || "recibido",
    });
    setError("");
    setModalAbierto(true);
  };

  const cerrar = () => { setModalAbierto(false); setSeleccionado(null); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value, ...(name === "empresa" ? { planta: "" } : {}) }));
  };

  const guardar = async () => {
    if (!form.tipoEquipo.trim()) { setError("El tipo de equipo es obligatorio."); return; }
    setGuardando(true);
    setError("");
    const url    = seleccionado ? `/ingresos-equipo/${seleccionado._id}` : "/ingresos-equipo";
    const method = seleccionado ? "PUT" : "POST";
    const res = await fetchAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, garantia: form.garantia === "true" }),
    });
    if (res.ok) {
      const data = await res.json();
      setIngresos((prev) =>
        seleccionado
          ? prev.map((i) => i._id === data._id ? data : i)
          : [data, ...prev]
      );
      cerrar();
    } else {
      setError("Error al guardar. Intenta de nuevo.");
    }
    setGuardando(false);
  };

  const aniosLista = [...new Set(ingresos.map((i) => new Date(i.fechaIngreso).getFullYear()))].sort((a, b) => b - a);

  const empresasLista = [
    ...new Map(
      ingresos.filter((i) => i.empresa?._id).map((i) => [i.empresa._id, i.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [...new Set(ingresos.map((i) => i.planta).filter(Boolean))].sort();

  const filtrados = ingresos.filter((i) => {
    const txt  = busqueda.toLowerCase();
    const ot   = otMap[i._id];
    const fecha = new Date(i.fechaIngreso);
    const matchBusq = !txt
      || i.codigo?.toLowerCase().includes(txt)
      || i.tipoEquipo?.toLowerCase().includes(txt)
      || i.marca?.toLowerCase().includes(txt)
      || i.modelo?.toLowerCase().includes(txt)
      || i.empresa?.razonSocial?.toLowerCase().includes(txt)
      || i.empresa?.ruc?.includes(txt)
      || ot?.codigo?.toLowerCase().includes(txt)
      || i.numeroGuiaEmision?.toLowerCase().includes(txt);
    const matchEstado  = !estadoFiltro  || ot?.estado === estadoFiltro;
    const matchAnio    = !anioFiltro    || fecha.getFullYear() === parseInt(anioFiltro);
    const matchMes     = !mesFiltro     || fecha.getMonth() + 1 === parseInt(mesFiltro);
    const matchEmpresa = !empresaFiltro || i.empresa?._id === empresaFiltro;
    const matchPlanta  = !plantaFiltro  || i.planta === plantaFiltro;
    return matchBusq && matchEstado && matchAnio && matchMes && matchEmpresa && matchPlanta;
  });

  const hayFiltro = busqueda || estadoFiltro || anioFiltro || mesFiltro || empresaFiltro || plantaFiltro;

  return (
    <div className="p-6 mx-auto">
      <div className="flex flex-wrap items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Ingreso de Equipos</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">{filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
        >
          + Nuevo ingreso
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={empresaFiltro}
          onChange={(e) => { setEmpresaFiltro(e.target.value); setPlantaFiltro(""); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Toda empresa</option>
          {empresasLista.map((e) => (
            <option key={e._id} value={e._id}>
              {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
            </option>
          ))}
        </select>

        {plantasLista.length > 0 && (
          <select
            value={plantaFiltro}
            onChange={(e) => setPlantaFiltro(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Toda planta</option>
            {plantasLista.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todo estado OT</option>
          {ESTADOS_OT.map((e) => (
            <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
          ))}
        </select>

        <select
          value={anioFiltro}
          onChange={(e) => setAnioFiltro(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos los años</option>
          {aniosLista.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos los meses</option>
          {MESES.map((m, idx) => (
            <option key={idx + 1} value={idx + 1}>{m}</option>
          ))}
        </select>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, equipo, marca, empresa, RUC o N° guía…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-60 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />

        {hayFiltro && (
          <button
            onClick={() => { setBusqueda(""); setEstadoFiltro(""); setAnioFiltro(""); setMesFiltro(""); setEmpresaFiltro(""); setPlantaFiltro(""); }}
            className="text-sm text-gray-400 hover:text-gray-700 transition"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-500 text-white text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Planta</th>
              <th className="px-4 py-3 text-left">Tipo de equipo</th>
              <th className="px-4 py-3 text-left">Marca / Modelo</th>
              <th className="px-4 py-3 text-center">Fecha ingreso</th>
              <th className="px-4 py-3 text-center">Código OT</th>
              <th className="px-4 py-3 text-center">Estado OT</th>
              <th className="px-4 py-3 text-center">N° Guía Emisión</th>
              <th className="px-4 py-3 text-center">Garantía</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  {hayFiltro ? "Sin resultados para los filtros aplicados" : "Sin registros de ingreso"}
                </td>
              </tr>
            ) : filtrados.map((i) => {
              const ot = otMap[i._id];
              return (
                <tr
                  key={i._id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => abrirEditar(i)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{i.codigo}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {i.empresa ? (
                      <span>
                        <span className="font-medium">{i.empresa.alias}</span>
                        <span className="text-gray-400"> — {i.empresa.razonSocial}</span>
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {i.planta || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{i.tipoEquipo}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {[i.marca, i.modelo].filter(Boolean).join(" / ") || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {new Date(i.fechaIngreso).toLocaleDateString("es-PE")}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-emerald-600">
                    {ot ? ot.codigo : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ot ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badgeOT(ot.estado)}`}>
                        {ot.estado}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin OT</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-700">
                    {i.numeroGuiaEmision || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {i.garantia
                      ? <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">Garantía</span>
                      : <span className="text-gray-300 text-xs">No</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {seleccionado ? "Editar ingreso" : "Nuevo ingreso de equipo"}
                </h3>
                {seleccionado && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{seleccionado.codigo}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {seleccionado && (
                  <button
                    onClick={() => setCrearOT(true)}
                    className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition font-medium"
                  >
                    Crear OT
                  </button>
                )}
                <button onClick={cerrar} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">

              {/* Cliente */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                  <option value="">— Sin cliente —</option>
                  {empresas.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                    </option>
                  ))}
                </select>
              </div>

              {/* Planta */}
              {(() => {
                const emp = empresas.find((e) => e._id === form.empresa);
                const plantas = emp?.plantas || [];
                return plantas.length > 0 ? (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Planta</label>
                    <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                      <option value="">— Sin planta —</option>
                      {plantas.map((p, i) => (
                        <option key={i} value={p.nombre}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                ) : null;
              })()}

              {/* Fecha ingreso */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de ingreso</label>
                <input type="date" name="fechaIngreso" value={form.fechaIngreso} onChange={handleChange} className={INP} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Tipo de equipo */}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Tipo de equipo <span className="text-red-400">*</span></label>
                  <input name="tipoEquipo" value={form.tipoEquipo} onChange={handleChange}
                    placeholder="Ej. Split, Chiller, VRF, Terma…" className={INP} />
                </div>

                {/* Marca */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Marca</label>
                  <input name="marca" value={form.marca} onChange={handleChange}
                    placeholder="Ej. Carrier, LG, Midea…" className={INP} />
                </div>

                {/* Modelo */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Modelo</label>
                  <input name="modelo" value={form.modelo} onChange={handleChange}
                    placeholder="Ej. CS-S18XKU" className={INP} />
                </div>
              </div>

              {/* Características eléctricas */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Características eléctricas</label>
                <input name="caracteristicasElectricas" value={form.caracteristicasElectricas} onChange={handleChange}
                  placeholder="Ej. 220V / 60Hz / 1Ø — 9000 BTU" className={INP} />
              </div>

              {/* Accesorios */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Accesorios</label>
                <input name="accesorios" value={form.accesorios} onChange={handleChange}
                  placeholder="Ej. Control remoto, filtros, base…" className={INP} />
              </div>

              {/* N° Guía de emisión */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° de guía de Remisión <span className="text-gray-300">(opcional)</span></label>
                <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange}
                  placeholder="—" className={INP} />
              </div>

              {/* Descripción del problema */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Descripción del problema</label>
                <textarea
                  name="descripcionProblema"
                  value={form.descripcionProblema}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describa la falla o motivo de ingreso…"
                  className={`${INP} resize-none`}
                />
              </div>

              {/* Garantía */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">¿Ingresa por garantía?</label>
                <select name="garantia" value={form.garantia} onChange={handleChange} className={INP}>
                  <option value="false">No</option>
                  <option value="true">Sí — en garantía</option>
                </select>
              </div>

              {/* Estado */}
              {/* <div>
                <label className="text-xs text-gray-500 block mb-1">Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange} className={INP}>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                  ))}
                </select>
              </div> */}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
              <button onClick={cerrar}
                className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
                {guardando ? "Guardando…" : seleccionado ? "Guardar cambios" : "Registrar ingreso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {crearOT && seleccionado && (
        <ModalOTEquipo
          ingreso={seleccionado}
          onClose={() => setCrearOT(false)}
          onCreada={(nueva) => {
            setOtMap((prev) => {
              const ieId = nueva.ingresoEquipo?._id || nueva.ingresoEquipo;
              return ieId ? { ...prev, [ieId]: nueva } : prev;
            });
            setCrearOT(false);
            cerrar();
          }}
        />
      )}
    </div>
  );
}
