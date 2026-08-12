import { useState } from "react";
import { fetchAuth, uploadAuth, imgUrl, getUsuario } from "../utils/fetchAuth";
import { tipoInformePorValor, claveChecklist } from "../utils/informesTecnicos";

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
            <input value={campos[it.clave] ?? ""} onChange={(e) => onCampo(it.clave, e.target.value)}
              className={`${INP} py-1.5`} />
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
      <div className="overflow-x-auto">
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
                    <input value={valores[`${f.clave}__${c.clave}`] ?? ""}
                      onChange={(e) => set(f.clave, c.clave, e.target.value)}
                      className={`${INP} text-center py-1`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  );
}

function SeccionEvidencias({ seccion, campos, onCampos }) {
  const grupos = campos[seccion.clave] || [];
  const [subiendo, setSubiendo] = useState(null);
  const set = (nuevos) => onCampos(seccion.clave, nuevos);

  const agregarGrupo = () => set([...grupos, { _key: Date.now() + Math.random(), titulo: "", imagenes: [] }]);
  const actualizarTitulo = (key, titulo) => set(grupos.map((g) => (g._key === key ? { ...g, titulo } : g)));
  const eliminarGrupo = (key) => set(grupos.filter((g) => g._key !== key));

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
        {grupos.map((g) => (
          <div key={g._key} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <input value={g.titulo} onChange={(e) => actualizarTitulo(g._key, e.target.value)}
                placeholder="Leyenda (ej. Ingreso de equipo)" className={`${INP} flex-1`} />
              <button type="button" onClick={() => eliminarGrupo(g._key)} className="text-red-300 hover:text-red-500 shrink-0">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.imagenes.map((img, i) => (
                <img key={i} src={imgUrl(img)} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
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
        ))}
        <button type="button" onClick={agregarGrupo}
          className="w-full text-sm border-2 border-dashed border-gray-200 text-gray-400 py-2.5 rounded-xl hover:border-amber-300 hover:text-amber-600 transition">
          + Agregar grupo de fotos
        </button>
      </div>
    </Seccion>
  );
}

export default function FormInformeTecnico({ ordenTrabajo, tipo, informeExistente, onClose, onGuardado }) {
  const def = tipoInformePorValor(tipo);
  const esEdicion = !!informeExistente;
  const [campos, setCampos] = useState(() => informeExistente?.campos ?? {
    cliente: ordenTrabajo.empresa?.razonSocial || "",
    equipo: ordenTrabajo.titulo || "",
    ot: ordenTrabajo.numeroOT || "",
    planta: ordenTrabajo.planta || "",
    nGuia: ordenTrabajo.numeroGuiaEmision || "",
    tecnico: ordenTrabajo.encargado || "",
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
