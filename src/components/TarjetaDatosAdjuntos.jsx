import { useState } from "react";
import { fetchAuth, fetchUpload, uploadAuth, abrirArchivoProtegido, getUsuario } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import ImagenProtegida from "./ImagenProtegida";
import ConfirmacionAccion from "./ConfirmacionAccion";

const ROLES_ELIMINAN = ["admin", "jefatura", "coordinadora"];
const EXT_IMAGEN = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

const extension = (nombre = "") => (nombre.includes(".") ? nombre.split(".").pop().toLowerCase() : "");
const esImagen = (nombre) => EXT_IMAGEN.includes(extension(nombre));
const icono = (ext) => {
  if (ext === "pdf") return "📄";
  if (["doc", "docx", "odt", "rtf", "txt"].includes(ext)) return "📝";
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "📊";
  if (["ppt", "pptx", "odp"].includes(ext)) return "📽️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["dwg", "dxf"].includes(ext)) return "📐";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "🎞️";
  return "📎";
};
const formatoTamano = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Solo imágenes y PDF se abren en pestaña: la Object URL de blob hereda el
// origen de la app, así que cualquier otro tipo se descarga en vez de
// renderizarse (ver uploadArchivoOT en Backend/src/middleware/upload.js).
async function abrirODescargar(archivo) {
  if (esImagen(archivo.nombre) || extension(archivo.nombre) === "pdf") return abrirArchivoProtegido(archivo.url);
  const res = await fetchUpload(archivo.url);
  if (!res.ok) return;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Card "Datos adjuntos" de la OT/sub-OT — cualquier documento, con miniatura
// para imágenes. Mismo patrón que Intales (TarjetaArchivosRelacionados).
export default function TarjetaDatosAdjuntos({ ordenId, archivos = [], soloLectura = false, onCambio }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const puedeEliminar = !soloLectura && ROLES_ELIMINAN.includes(getUsuario()?.rol);

  const subir = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    setSubiendo(true);
    let ultima = null;
    // Secuencial: cada subida hace $push sobre el mismo array — en paralelo,
    // la respuesta de una podría llegar sin el archivo de la otra.
    for (const file of files) {
      const fd = new FormData();
      fd.append("archivo", file);
      try {
        const res = await uploadAuth(`/ordenes-trabajo/${ordenId}/archivos`, fd);
        const data = await res.json().catch(() => ({}));
        if (res.ok) ultima = data;
        else setError(`No se pudo subir "${file.name}": ${data.mensaje || "error del servidor"} (máx. 20 MB).`);
      } catch {
        setError(`No se pudo subir "${file.name}": error de conexión con el servidor.`);
      }
    }
    setSubiendo(false);
    if (ultima) onCambio?.(ultima);
  };

  const eliminar = async () => {
    setEliminando(true);
    setError("");
    try {
      const res = await fetchAuth(`/ordenes-trabajo/${ordenId}/archivos/${porEliminar._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onCambio?.(data);
      else setError(data.mensaje || "No se pudo eliminar el archivo.");
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-8 pb-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-cyan-500" />
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos adjuntos ({archivos.length})</h2>
          </div>
          {!soloLectura && (
            <label className={`text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg transition font-medium ${subiendo ? "opacity-60" : "hover:bg-cyan-700 cursor-pointer"}`}>
              {subiendo ? "Subiendo…" : "+ Agregar archivo"}
              <input type="file" multiple className="hidden" disabled={subiendo}
                onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {archivos.length === 0 ? (
          <p className="text-sm text-gray-400">Sin archivos adjuntos</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {archivos.map((a) => (
              <div key={a._id} className="relative border border-gray-100 rounded-xl p-3 w-[200px] space-y-2">
                {puedeEliminar && (
                  <button type="button" title="Eliminar archivo" onClick={() => setPorEliminar(a)}
                    className="absolute -top-2 -right-2 bg-white border border-gray-200 text-red-400 hover:text-red-600 rounded-full w-6 h-6 text-xs leading-none z-10">
                    ✕
                  </button>
                )}
                <button type="button" onClick={() => abrirODescargar(a)} className="block w-full">
                  {esImagen(a.nombre) ? (
                    <ImagenProtegida src={a.url} alt={a.nombre} className="w-[174px] h-[174px] object-cover rounded-lg" />
                  ) : (
                    <div className="w-[174px] h-[174px] bg-gray-50 rounded-lg flex items-center justify-center text-5xl">
                      {icono(extension(a.nombre))}
                    </div>
                  )}
                </button>
                <button type="button" onClick={() => abrirODescargar(a)} title={a.nombre}
                  className="text-xs text-blue-600 hover:text-blue-800 underline truncate block w-full text-left">
                  {a.nombre}
                </button>
                <p className="text-[11px] text-gray-400 truncate" title={a.subidoPor}>
                  {formatoTamano(a.tamano)} · {formatearFecha(a.fecha)}{a.subidoPor ? ` · ${a.subidoPor}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {porEliminar && (
        <ConfirmacionAccion
          mensaje={`¿Eliminar el archivo "${porEliminar.nombre}"? No se puede deshacer.`}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={eliminar}
          procesando={eliminando}
          textoConfirmar="Eliminar"
        />
      )}
    </div>
  );
}
