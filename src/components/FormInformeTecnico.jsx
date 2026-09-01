import { useState, useEffect } from "react";
import { fetchAuth, uploadAuth, getUsuario } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import { tipoInformePorValor, claveChecklist } from "../utils/informesTecnicos";
import ImagenProtegida from "./ImagenProtegida";
import TablaScroll from "./TablaScroll";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 w-full transition";

function Seccion({ titulo, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{titulo}</h3>
      {children}
    </div>
  );
}

function SeccionCampos({ seccion, campos, onCampo }) {
  return (
    <Seccion titulo={seccion.titulo}>
      <div className="grid grid-cols-2 gap-4">
        {seccion.campos.map((c) => (
          <div key={c.clave}>
            <label className="text-xs text-gray-500 block mb-1">{c.label}</label>
            <input value={campos[c.clave] ?? ""} onChange={(e) => onCampo(c.clave, e.target.value)} className={INP} />
          </div>
        ))}
      </div>
    </Seccion>
  );
}

function SeccionChecklist({ seccion, campos, onCampo }) {
  const claveHechoPor = `${claveChecklist(seccion.titulo)}__hechoPor`;
  const claveFecha = `${claveChecklist(seccion.titulo)}__fecha`;
  return (
    <Seccion titulo={seccion.titulo}>
      {seccion.hechoPor && (
        <div className="grid grid-cols-2 gap-4 pb-2 mb-2 border-b border-gray-100">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hecho por</label>
            <input value={campos[claveHechoPor] ?? ""} onChange={(e) => onCampo(claveHechoPor, e.target.value)} className={INP} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={campos[claveFecha] ?? ""} onChange={(e) => onCampo(claveFecha, e.target.value)} className={INP} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {seccion.items.map((it) => (
          <div key={it.clave} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-1/2 shrink-0">{it.label}</label>
            {seccion.opciones ? (
              <select value={campos[it.clave] ?? ""} onChange={(e) => onCampo(it.clave, e.target.value)}
                className={`${INP} py-1.5 font-medium ${
                  campos[it.clave] === "OK" ? "text-green-600" : campos[it.clave] === "NOK" ? "text-red-600" : "text-gray-500"
                }`}>
                <option value="">—</option>
                {seccion.opciones.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            ) : (
              <input value={campos[it.clave] ?? ""} onChange={(e) => onCampo(it.clave, e.target.value)}
                className={`${INP} py-1.5`} />
            )}
          </div>
        ))}
      </div>
    </Seccion>
  );
}

function SeccionBullets({ seccion, campos, onCampos }) {
  const lineas = campos[seccion.clave] || [];
  const set = (nuevas) => onCampos(seccion.clave, nuevas);
  return (
    <Seccion titulo={seccion.titulo}>
      <div className="space-y-2">
        {lineas.map((linea, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-gray-300 shrink-0">{seccion.simbolo || "▫"}</span>
            <input value={linea} onChange={(e) => set(lineas.map((l, j) => (j === i ? e.target.value : l)))}
              className={INP} />
            <button type="button" onClick={() => set(lineas.filter((_, j) => j !== i))}
              className="text-red-300 hover:text-red-500 shrink-0">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set([...lineas, ""])}
          className="text-xs text-gray-400 hover:text-amber-600 transition">+ agregar línea</button>
      </div>
    </Seccion>
  );
}

// Lista dinámica de filas con 2 campos cada una (ej. Cantidad/Descripción)
// — mismo patrón "+ agregar" de SeccionBullets, pero cada línea guarda un
// objeto en vez de un string.
function SeccionFilas({ seccion, campos, onCampos }) {
  const filas = campos[seccion.clave] || [];
  const set = (nuevas) => onCampos(seccion.clave, nuevas);
  const [colUno, colDos] = seccion.columnas;
  const actualizar = (i, clave, valor) => set(filas.map((f, j) => (j === i ? { ...f, [clave]: valor } : f)));
  return (
    <Seccion titulo={seccion.titulo}>
      <div className="space-y-2">
        {filas.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={f[colUno.clave] ?? ""} onChange={(e) => actualizar(i, colUno.clave, e.target.value)}
              placeholder={colUno.label} className={`${INP} !w-24 shrink-0`} />
            <input value={f[colDos.clave] ?? ""} onChange={(e) => actualizar(i, colDos.clave, e.target.value)}
              placeholder={colDos.label} className={`${INP} flex-1 min-w-0`} />
            <button type="button" onClick={() => set(filas.filter((_, j) => j !== i))}
              className="text-red-300 hover:text-red-500 shrink-0">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set([...filas, { [colUno.clave]: "", [colDos.clave]: "" }])}
          className="text-xs text-gray-400 hover:text-amber-600 transition">+ agregar fila</button>
      </div>
    </Seccion>
  );
}

function SeccionTabla({ seccion, campos, onCampo, onCampos }) {
  const valores = campos[seccion.clave] || {};
  const set = (filaClave, columnaClave, valor) =>
    onCampos(seccion.clave, { ...valores, [`${filaClave}__${columnaClave}`]: valor });
  const claveHechoPor = `${claveChecklist(seccion.titulo)}__hechoPor`;
  const claveFecha = `${claveChecklist(seccion.titulo)}__fecha`;
  return (
    <Seccion titulo={seccion.titulo}>
      {seccion.hechoPor && (
        <div className="grid grid-cols-2 gap-4 pb-2 mb-2 border-b border-gray-100">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hecho por</label>
            <input value={campos[claveHechoPor] ?? ""} onChange={(e) => onCampo(claveHechoPor, e.target.value)} className={INP} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={campos[claveFecha] ?? ""} onChange={(e) => onCampo(claveFecha, e.target.value)} className={INP} />
          </div>
        </div>
      )}
      <TablaScroll className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-xs text-gray-400"></th>
              {seccion.columnas.map((c) => (
                <th key={c.clave} className="text-center px-2 py-1 text-xs text-gray-400 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seccion.filas.map((f) => (
              <tr key={f.clave}>
                <td className="px-2 py-1 text-xs text-gray-600 whitespace-nowrap">{f.label}</td>
                {seccion.columnas.map((c) => (
                  <td key={c.clave} className="px-1 py-1">
                    {seccion.opciones ? (
                      <select value={valores[`${f.clave}__${c.clave}`] ?? ""}
                        onChange={(e) => set(f.clave, c.clave, e.target.value)}
                        className={`${INP} text-center py-1 font-medium ${
                          valores[`${f.clave}__${c.clave}`] === "OK" ? "text-green-600"
                            : valores[`${f.clave}__${c.clave}`] === "NOK" ? "text-red-600" : "text-gray-500"
                        }`}>
                        <option value="">—</option>
                        {seccion.opciones.map((op) => <option key={op} value={op}>{op}</option>)}
                      </select>
                    ) : (
                      <input value={valores[`${f.clave}__${c.clave}`] ?? ""}
                        onChange={(e) => set(f.clave, c.clave, e.target.value)}
                        className={`${INP} text-center py-1`} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TablaScroll>
    </Seccion>
  );
}

function SeccionEvidencias({ seccion, campos, onCampos }) {
  const grupos = campos[seccion.clave] || [];
  const [subiendo, setSubiendo] = useState(null);
  const set = (nuevos) => onCampos(seccion.clave, nuevos);

  // Slots fijos (ej. Servicio de Soporte: A/B/C/D, Diagnóstico de Equipo: 8
  // recuadros con nombre propio — uno por recuadro impreso en la plantilla,
  // ver SLOTS_FOTOS en informeTecnicoExcel.js, que ubica cada foto por la
  // `clave` del slot, no por orden de subida) — se crean una sola vez si
  // todavía no existen; a diferencia del modo genérico, acá no se pueden
  // agregar/quitar grupos, solo llenar los ya definidos. Cada slot es
  // { clave, label }: `clave` se guarda como `titulo` del grupo (identidad
  // para el matching en la exportación), `label` es el texto visible.
  useEffect(() => {
    if (!seccion.slotsFijos) return;
    const faltantes = seccion.slotsFijos.filter((slot) => !grupos.some((g) => g.titulo === slot.clave));
    if (faltantes.length) set([...grupos, ...faltantes.map((slot) => ({ _key: slot.clave, titulo: slot.clave, imagenes: [] }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion.slotsFijos]);

  const gruposAMostrar = seccion.slotsFijos
    ? seccion.slotsFijos.map((slot) => {
        const g = grupos.find((gr) => gr.titulo === slot.clave);
        return g ? { ...g, _label: slot.label, _separador: slot.separador } : null;
      }).filter(Boolean)
    : grupos;

  const agregarGrupo = () => set([...grupos, { _key: Date.now() + Math.random(), titulo: "", imagenes: [] }]);
  const actualizarTitulo = (key, titulo) => set(grupos.map((g) => (g._key === key ? { ...g, titulo } : g)));
  const eliminarGrupo = (key) => set(grupos.filter((g) => g._key !== key));
  const eliminarImagen = (key, indice) =>
    set(grupos.map((g) => (g._key === key ? { ...g, imagenes: g.imagenes.filter((_, i) => i !== indice) } : g)));

  const subir = async (key, files) => {
    setSubiendo(key);
    const urls = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("imagen", file);
      const res = await uploadAuth("/informes-tecnicos/subir-imagen", fd);
      if (res.ok) urls.push((await res.json()).url);
    }
    set(grupos.map((g) => (g._key === key ? { ...g, imagenes: [...g.imagenes, ...urls] } : g)));
    setSubiendo(null);
  };

  return (
    <Seccion titulo={seccion.titulo}>
      <div className="space-y-3">
        {gruposAMostrar.map((g) => (
          <div key={g._key}>
            {g._separador && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-1 first:mt-0">{g._separador}</p>
            )}
            <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                {seccion.slotsFijos ? (
                  <span className="flex-1 text-sm font-semibold text-gray-700">{g._label}</span>
                ) : (
                  <>
                    <input value={g.titulo} onChange={(e) => actualizarTitulo(g._key, e.target.value)}
                      placeholder="Leyenda (ej. Ingreso de equipo)" className={`${INP} flex-1`} />
                    <button type="button" onClick={() => eliminarGrupo(g._key)} className="text-red-300 hover:text-red-500 shrink-0">✕</button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.imagenes.map((img, i) => (
                  <div key={i} className="relative shrink-0">
                    <ImagenProtegida src={img} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    <button type="button" onClick={() => eliminarImagen(g._key, i)}
                      title="Eliminar foto"
                      // Siempre visible (no solo en hover) — en tablet/touch no
                      // existe estado :hover, así que group-hover/foto nunca
                      // disparaba y el botón quedaba invisible e inalcanzable.
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none flex items-center justify-center hover:bg-red-600 transition shadow">
                      ✕
                    </button>
                  </div>
                ))}
                {["environment", null].map((capture) => (
                  <label key={capture || "galeria"}
                    className={`w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition text-gray-400 select-none
                      ${subiendo === g._key ? "opacity-50 cursor-wait border-gray-200" : "border-gray-300 hover:border-amber-400 hover:text-amber-500"}`}>
                    <span className="text-lg leading-none">{capture ? "📷" : "🖼️"}</span>
                    <span className="text-[10px] mt-0.5">{capture ? "Cámara" : "Galería"}</span>
                    <input type="file" accept="image/*" multiple className="hidden"
                      capture={capture || undefined}
                      disabled={subiendo === g._key}
                      onChange={(e) => subir(g._key, e.target.files)} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
        {!seccion.slotsFijos && (
          <button type="button" onClick={agregarGrupo}
            className="w-full text-sm border-2 border-dashed border-gray-200 text-gray-400 py-2.5 rounded-xl hover:border-amber-300 hover:text-amber-600 transition">
            + Agregar grupo de fotos
          </button>
        )}
      </div>
    </Seccion>
  );
}

export default function FormInformeTecnico({ ordenTrabajo, tipo, informeExistente, onClose, onGuardado }) {
  const def = tipoInformePorValor(tipo);
  const esEdicion = !!informeExistente;
  // Cabecera "Datos generales" (CAMPOS_HEADER_SERVICIO/CAMPOS_HEADER_SOPORTE
  // en informesTecnicos.js) se repite igual en las 13 plantillas — se
  // autocompleta desde la OT para no volver a escribirla en cada informe.
  // Sigue siendo editable por si el informe puntual necesita un valor
  // distinto (ej. otro contacto para ese servicio específico).
  const hoy = formatearFecha(new Date());
  const [campos, setCampos] = useState(() => informeExistente?.campos ?? {
    empresa: ordenTrabajo.empresa?.razonSocial || "",
    contacto: [ordenTrabajo.contactoNombre, ordenTrabajo.contactoTelefono].filter(Boolean).join(" — "),
    lineaArea: ordenTrabajo.micLinea || "",
    descripcion: ordenTrabajo.descripcion || "",
    categoria: ordenTrabajo.categorizacionTaller || "",
    fecha: hoy,
    fechaInicio: hoy,
    fechaTermino: hoy,
  });
  const [hechoPor, setHechoPor] = useState(informeExistente?.hechoPor ?? getUsuario()?.nombre ?? "");
  const [vB, setVB] = useState(informeExistente?.vB ?? "");
  const [fecha, setFecha] = useState(
    informeExistente?.fecha ? new Date(informeExistente.fecha).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const handleCampo = (clave, valor) => setCampos((prev) => ({ ...prev, [clave]: valor }));

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const payload = esEdicion
      ? { campos, hechoPor, vB, fecha: fecha || null }
      : { ordenTrabajo: ordenTrabajo._id, tipo, campos, hechoPor, vB, fecha: fecha || null };
    const res = await fetchAuth(
      esEdicion ? `/informes-tecnicos/${informeExistente._id}` : "/informes-tecnicos",
      {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) {
      const data = await res.json();
      onGuardado(data);
    } else {
      setError("Error al guardar el informe.");
    }
    setGuardando(false);
  };

  if (!def) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 flex flex-col">
      <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-8 py-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">{esEdicion ? "Editar informe" : def.label}</h3>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{ordenTrabajo.codigo}{esEdicion ? ` — ${informeExistente.codigo}` : ""}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8 space-y-5">
          {def.secciones.map((seccion, i) => {
            if (seccion.tipo === "campos") return <SeccionCampos key={i} seccion={seccion} campos={campos} onCampo={handleCampo} />;
            if (seccion.tipo === "checklist") return <SeccionChecklist key={i} seccion={seccion} campos={campos} onCampo={handleCampo} />;
            if (seccion.tipo === "bullets") return <SeccionBullets key={i} seccion={seccion} campos={campos} onCampos={handleCampo} />;
            if (seccion.tipo === "filas") return <SeccionFilas key={i} seccion={seccion} campos={campos} onCampos={handleCampo} />;
            if (seccion.tipo === "tabla") return <SeccionTabla key={i} seccion={seccion} campos={campos} onCampo={handleCampo} onCampos={handleCampo} />;
            if (seccion.tipo === "evidencias") return <SeccionEvidencias key={i} seccion={seccion} campos={campos} onCampos={handleCampo} />;
            return null;
          })}

          <Seccion titulo="Firma">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Hecho por</label>
                <input value={hechoPor} onChange={(e) => setHechoPor(e.target.value)} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">V.B.</label>
                <input value={vB} onChange={(e) => setVB(e.target.value)} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={INP} />
              </div>
            </div>
          </Seccion>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      <div className="shrink-0 bg-white border-t border-gray-100 px-8 py-4 flex gap-3 justify-end">
        <button type="button" onClick={onClose} className="text-sm border border-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="button" onClick={guardar} disabled={guardando}
          className="text-sm bg-amber-500 text-white px-5 py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition font-medium">
          {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar informe"}
        </button>
      </div>
    </div>
  );
}
