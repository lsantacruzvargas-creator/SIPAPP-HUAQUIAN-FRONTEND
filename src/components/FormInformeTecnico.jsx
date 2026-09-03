import { useState, useEffect } from "react";
import { fetchAuth, uploadAuth, getUsuario } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import { tipoInformePorValor, claveChecklist } from "../utils/informesTecnicos";
import ImagenProtegida from "./ImagenProtegida";
import TablaScroll from "./TablaScroll";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 w-full transition";

// Tipos cuya plantilla ya no trae bloque de encabezado propio (ver
// MAPEOS.<tipo> en informeTecnicoExcel.js) — la celda de descripción se
// autocompleta con el TÍTULO de la OT/sub-OT en vez de su descripción
// general (pedido explícito del usuario, tipo por tipo, 2026-09-03).
const TIPOS_SIN_ENCABEZADO = ["adicional", "arrancador", "plc", "diagnostico_servomotor", "panel", "pc", "ups"];
// Tipos cuyo "Datos del equipo" (Equipo/Marca, Modelo, Código, Tag,
// Potencia, S/N) comparte los mismos nombres de campo que la OT/sub-OT y se
// autocompleta desde ahí.
const TIPOS_DATOS_EQUIPO_DESDE_OT = ["arrancador", "plc", "diagnostico_servomotor", "panel", "pc", "ups"];

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
            <input value={campos[c.clave] ?? ""} onChange={(e) => onCampo(c.clave, e.target.value)} placeholder={c.placeholder} className={INP} />
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
function SeccionFilas({ seccion, campos, onCampos, itemsRequerimientos }) {
  const filas = campos[seccion.clave] || [];
  const set = (nuevas) => onCampos(seccion.clave, nuevas);
  const [colUno, colDos] = seccion.columnas;
  const actualizar = (i, clave, valor) => set(filas.map((f, j) => (j === i ? { ...f, [clave]: valor } : f)));
  // "Traer de requerimientos" — solo en Piezas a reemplazar (pedido
  // explícito del usuario): agrega de una sola vez todos los ítems
  // "atendidos" de los requerimientos de esta OT/sub-OT que todavía no
  // estén en la tabla (comparados por cantidad+descripción exactos, para
  // no duplicar si se hace clic más de una vez).
  const traerDeRequerimientos = () => {
    const existentes = new Set(filas.map((f) => `${f[colUno.clave]}__${f[colDos.clave]}`));
    const nuevas = (itemsRequerimientos || [])
      .filter((it) => !existentes.has(`${it.cantidad}__${it.descripcion}`))
      .map((it) => ({ [colUno.clave]: it.cantidad, [colDos.clave]: it.descripcion }));
    if (nuevas.length) set([...filas, ...nuevas]);
  };
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
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set([...filas, { [colUno.clave]: "", [colDos.clave]: "" }])}
            className="text-xs text-gray-400 hover:text-amber-600 transition">+ agregar fila</button>
          {seccion.clave === "piezasAReemplazar" && itemsRequerimientos?.length > 0 && (
            <button type="button" onClick={traerDeRequerimientos}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium transition">↓ Traer de requerimientos</button>
          )}
        </div>
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
        return g ? { ...g, _label: slot.label, _separador: slot.separador, _campoTitulo: slot.campoTitulo } : null;
      }).filter(Boolean)
    : grupos;

  const agregarGrupo = () => set([...grupos, { _key: Date.now() + Math.random(), titulo: "", imagenes: [] }]);
  const actualizarTitulo = (key, titulo) => set(grupos.map((g) => (g._key === key ? { ...g, titulo } : g)));
  const eliminarGrupo = (key) => set(grupos.filter((g) => g._key !== key));
  const eliminarImagen = (key, indice) =>
    set(grupos.map((g) => (g._key === key ? { ...g, imagenes: g.imagenes.filter((_, i) => i !== indice) } : g)));

  const subir = async (key, files) => {
    // `maxImagenes` — tope opcional por sección (ver "adicional" y
    // "Fotos del mantenimiento" de arrancador en informesTecnicos.js): si el
    // cuadro ya llegó al tope, no sube nada más; si la selección múltiple
    // trae más archivos de los que caben, solo toma los primeros.
    const grupo = grupos.find((g) => g._key === key);
    const espacio = seccion.maxImagenes ? Math.max(0, seccion.maxImagenes - (grupo?.imagenes.length || 0)) : Infinity;
    const archivos = Array.from(files).slice(0, espacio);
    if (!archivos.length) return;
    setSubiendo(key);
    const urls = [];
    for (const file of archivos) {
      const fd = new FormData();
      fd.append("imagen", file);
      const res = await uploadAuth("/informes-tecnicos/subir-imagen", fd);
      if (res.ok) urls.push((await res.json()).url);
    }
    set(grupos.map((g) => (g._key === key ? { ...g, imagenes: [...g.imagenes, ...urls] } : g)));
    setSubiendo(null);
  };

  // `columnas`/`miniaturaGrande` — opcionales por sección (ver definiciones
  // de "adicional" y "arrancador" en informesTecnicos.js): por defecto los
  // grupos se apilan en una sola columna con miniaturas chicas, igual que
  // siempre en el resto de tipos de informe. Clases Tailwind literales (no
  // generadas dinámicamente) para que el escaneo estático las detecte.
  const CLASES_COLUMNAS = { 2: "grid grid-cols-1 sm:grid-cols-2 gap-3 items-start", 3: "grid grid-cols-1 sm:grid-cols-3 gap-3 items-start" };
  // Ancho fijo (300px) se desbordaba de la card en columnas de 2/3 (el flex
  // no encoge un w-[300px] al hacer wrap) — "grande" ahora llena el ancho
  // disponible de la card (w-full, hasta 300px como tope) y mantiene 300px
  // de alto.
  const tamMiniatura = seccion.miniaturaGrande ? "w-full max-w-[300px] h-[300px]" : "w-16 h-16";
  return (
    <Seccion titulo={seccion.titulo}>
      <div className={CLASES_COLUMNAS[seccion.columnas] || "space-y-3"}>
        {gruposAMostrar.map((g) => {
          const alcanzoLimite = seccion.maxImagenes && g.imagenes.length >= seccion.maxImagenes;
          return (
          <div key={g._key}>
            {g._separador && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-1 first:mt-0">{g._separador}</p>
            )}
            <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-center gap-2">
                {seccion.slotsFijos ? (
                  // `campoTitulo` (ver definición del slot en informesTecnicos.js)
                  // — el rótulo de este cuadro tiene celda propia en la
                  // plantilla y es editable; si el técnico lo deja vacío,
                  // escribir() en informeTecnicoExcel.js no la toca y queda
                  // el texto impreso. Sin `campoTitulo`, el rótulo es fijo
                  // (comportamiento de siempre en el resto de tipos).
                  g._campoTitulo ? (
                    <input value={campos[g._campoTitulo] ?? ""} onChange={(e) => onCampos(g._campoTitulo, e.target.value)}
                      placeholder={g._label} className={`${INP} flex-1 text-sm font-semibold`} />
                  ) : (
                    <span className="flex-1 text-sm font-semibold text-gray-700">{g._label}</span>
                  )
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
                  // El tamaño va en el wrapper (flex item real) — un
                  // w-full en la propia <img>, sin ancho definido en su
                  // padre, no tiene contra qué resolver el 100% y colapsa.
                  <div key={i} className={`relative ${seccion.miniaturaGrande ? tamMiniatura : `${tamMiniatura} shrink-0`}`}>
                    <ImagenProtegida src={img} className="w-full h-full object-cover rounded-lg border border-gray-200" />
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
                {/* maxImagenes: 1 foto por cuadro (adicional / fotos del
                    mantenimiento) — al llegar al tope se ocultan los botones
                    de subida; hay que borrar la foto actual para poder subir
                    otra. */}
                {!alcanzoLimite && ["environment", null].map((capture) => (
                  <label key={capture || "galeria"}
                    className={`${tamMiniatura} flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition text-gray-400 select-none
                      ${subiendo === g._key ? "opacity-50 cursor-wait border-gray-200" : "border-gray-300 hover:border-amber-400 hover:text-amber-500"}`}>
                    <span className="text-lg leading-none">{capture ? "📷" : "🖼️"}</span>
                    <span className="text-[10px] mt-0.5">{capture ? "Cámara" : "Galería"}</span>
                    <input type="file" accept="image/*" multiple={seccion.maxImagenes !== 1} className="hidden"
                      capture={capture || undefined}
                      disabled={subiendo === g._key}
                      onChange={(e) => subir(g._key, e.target.files)} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          );
        })}
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
  // Ver TIPOS_SIN_ENCABEZADO/TIPOS_DATOS_EQUIPO_DESDE_OT arriba: sus
  // plantillas ya no traen bloque de encabezado propio (ver MAPEOS.<tipo> en
  // informeTecnicoExcel.js), así que la celda de descripción se autocompleta
  // con el TÍTULO de la OT/sub-OT en vez de su descripción general. En
  // Adicional también se autocompletan Equipo/Marca, Modelo y Potencia de
  // "Datos del componente / equipo" desde los mismos campos de la OT/sub-OT
  // (mismo nombre de clave en ambos lados) — "Componente" y "Cantidad"
  // quedan vacíos porque no tienen equivalente en la OT.
  const esAdicional = tipo === "adicional";
  const [campos, setCampos] = useState(() => informeExistente?.campos ?? {
    empresa: ordenTrabajo.empresa?.razonSocial || "",
    contacto: [ordenTrabajo.contactoNombre, ordenTrabajo.contactoTelefono].filter(Boolean).join(" — "),
    lineaArea: ordenTrabajo.micLinea || "",
    descripcion: (TIPOS_SIN_ENCABEZADO.includes(tipo) ? ordenTrabajo.titulo : ordenTrabajo.descripcion) || "",
    categoria: ordenTrabajo.categorizacionTaller || "",
    fecha: hoy,
    fechaInicio: hoy,
    fechaTermino: hoy,
    ...(esAdicional && {
      equipoMarca: ordenTrabajo.equipoMarca || "",
      equipoModelo: ordenTrabajo.equipoModelo || "",
      equipoPotencia: ordenTrabajo.equipoPotencia || "",
    }),
    ...(TIPOS_DATOS_EQUIPO_DESDE_OT.includes(tipo) && {
      equipoMarca: ordenTrabajo.equipoMarca || "",
      modelo: ordenTrabajo.equipoModelo || "",
      codigo: ordenTrabajo.equipoCodigo || "",
      tag: ordenTrabajo.equipoTag || "",
      potencia: ordenTrabajo.equipoPotencia || "",
      serie: ordenTrabajo.equipoSerie || "",
    }),
  });
  const [hechoPor, setHechoPor] = useState(informeExistente?.hechoPor ?? getUsuario()?.nombre ?? "");
  const [vB, setVB] = useState(informeExistente?.vB ?? "");
  const [fecha, setFecha] = useState(
    informeExistente?.fecha ? new Date(informeExistente.fecha).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Ítems "atendidos" (ver Requerimiento.js, enum de estado) de los
  // requerimientos de material de esta OT/sub-OT — usados por el botón
  // "Traer de requerimientos" de la sección "Piezas a reemplazar" (ver
  // SeccionFilas). Mismo formato de descripción que la tabla de
  // Requerimientos en DetalleOrdenTrabajo.jsx/DetalleSubOT.jsx.
  const [itemsAtendidos, setItemsAtendidos] = useState([]);
  useEffect(() => {
    fetchAuth(`/requerimientos?ordenTrabajo=${ordenTrabajo._id}`)
      .then((r) => r.ok && r.json())
      .then((reqs) => {
        const items = (reqs || [])
          .flatMap((r) => r.items || [])
          .filter((it) => it.estado === "atendido")
          .map((it) => ({
            cantidad: it.cantidad,
            descripcion: it.esSolicitudCompra ? `${it.categoriaNombre} (compra)` : (it.material?.nombre || ""),
          }));
        setItemsAtendidos(items);
      });
  }, [ordenTrabajo._id]);

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

  const renderSeccion = (seccion, key) => {
    if (seccion.tipo === "campos") return <SeccionCampos key={key} seccion={seccion} campos={campos} onCampo={handleCampo} />;
    if (seccion.tipo === "checklist") return <SeccionChecklist key={key} seccion={seccion} campos={campos} onCampo={handleCampo} />;
    if (seccion.tipo === "bullets") return <SeccionBullets key={key} seccion={seccion} campos={campos} onCampos={handleCampo} />;
    if (seccion.tipo === "filas") return <SeccionFilas key={key} seccion={seccion} campos={campos} onCampos={handleCampo} itemsRequerimientos={itemsAtendidos} />;
    if (seccion.tipo === "tabla") return <SeccionTabla key={key} seccion={seccion} campos={campos} onCampo={handleCampo} onCampos={handleCampo} />;
    if (seccion.tipo === "evidencias") return <SeccionEvidencias key={key} seccion={seccion} campos={campos} onCampos={handleCampo} />;
    return null;
  };

  // `parPosicion: "izquierda"/"derecha"` en 2 secciones consecutivas (ej.
  // Informe Arrancador: "Protocolo de prueba inicial" + su foto) — pedido
  // explícito del usuario para romper el apilado lineal por defecto y
  // ponerlas lado a lado. El resto de tipos de informe no lo usa y sigue
  // apilándose una card debajo de otra, igual que siempre.
  const gruposSecciones = [];
  for (let i = 0; i < def.secciones.length; i++) {
    const actual = def.secciones[i];
    const siguiente = def.secciones[i + 1];
    if (actual.parPosicion === "izquierda" && siguiente?.parPosicion === "derecha") {
      gruposSecciones.push([actual, siguiente]);
      i += 1;
    } else {
      gruposSecciones.push([actual]);
    }
  }

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
          {gruposSecciones.map((grupo, i) => grupo.length === 2 ? (
            <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {grupo.map((seccion, j) => renderSeccion(seccion, j))}
            </div>
          ) : renderSeccion(grupo[0], i))}

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
