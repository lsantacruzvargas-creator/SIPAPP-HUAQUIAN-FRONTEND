import { imgUrl } from "../utils/fetchAuth";
import { tipoInformePorValor, claveChecklist } from "../utils/informesTecnicos";
import { exportarInformeTecnicoExcel } from "../utils/informeTecnicoExcel";

function Campo({ label, valor }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700">{valor || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

function BloqueSeccion({ seccion, campos }) {
  if (seccion.tipo === "campos") {
    return (
      <div className="grid grid-cols-2 gap-4">
        {seccion.campos.map((c) => <Campo key={c.clave} label={c.label} valor={campos[c.clave]} />)}
      </div>
    );
  }
  if (seccion.tipo === "checklist") {
    const claveHechoPor = `${claveChecklist(seccion.titulo)}__hechoPor`;
    const claveFecha = `${claveChecklist(seccion.titulo)}__fecha`;
    return (
      <div className="space-y-3">
        {seccion.hechoPor && (
          <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-100">
            <Campo label="Hecho por" valor={campos[claveHechoPor]} />
            <Campo label="Fecha" valor={campos[claveFecha]} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {seccion.items.map((it) => <Campo key={it.clave} label={it.label} valor={campos[it.clave]} />)}
        </div>
      </div>
    );
  }
  if (seccion.tipo === "bullets") {
    const lineas = (campos[seccion.clave] || []).filter(Boolean);
    return lineas.length ? (
      <ul className="space-y-1">
        {lineas.map((l, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
            <span className="text-gray-300 shrink-0">{seccion.simbolo || "▫"}</span>{l}
          </li>
        ))}
      </ul>
    ) : <span className="text-sm text-gray-300">Sin registros</span>;
  }
  if (seccion.tipo === "tabla") {
    const valores = campos[seccion.clave] || {};
    const claveHechoPor = `${claveChecklist(seccion.titulo)}__hechoPor`;
    const claveFecha = `${claveChecklist(seccion.titulo)}__fecha`;
    return (
      <div className="space-y-3">
        {seccion.hechoPor && (
          <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-100">
            <Campo label="Hecho por" valor={campos[claveHechoPor]} />
            <Campo label="Fecha" valor={campos[claveFecha]} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-2 py-1 text-xs text-gray-400"></th>
                {seccion.columnas.map((c) => <th key={c.clave} className="text-center px-2 py-1 text-xs text-gray-400 font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {seccion.filas.map((f) => (
                <tr key={f.clave}>
                  <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{f.label}</td>
                  {seccion.columnas.map((c) => (
                    <td key={c.clave} className="px-2 py-1.5 text-center font-mono text-gray-700">
                      {valores[`${f.clave}__${c.clave}`] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (seccion.tipo === "evidencias") {
    const grupos = campos[seccion.clave] || [];
    return grupos.length ? (
      <div className="space-y-3">
        {grupos.map((g, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
            {g.titulo && <p className="text-sm font-semibold text-gray-700">{g.titulo}</p>}
            <div className="flex flex-wrap gap-2">
              {(g.imagenes || []).map((img, j) => (
                <img key={j} src={imgUrl(img)} alt="" onClick={() => window.open(imgUrl(img), "_blank")}
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition" />
              ))}
            </div>
          </div>
        ))}
      </div>
    ) : <span className="text-sm text-gray-300">Sin fotos</span>;
  }
  return null;
}

export default function VistaInformeTecnico({ informe, ordenTrabajo, onClose, onModificar }) {
  const def = tipoInformePorValor(informe.tipo);
  const campos = informe.campos || {};

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-start justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{def?.label || "Informe Técnico"}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{ordenTrabajo.codigo} — {informe.codigo}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none mt-1">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {def?.secciones.map((seccion, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{seccion.titulo}</h3>
              <BloqueSeccion seccion={seccion} campos={campos} />
            </div>
          ))}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="grid grid-cols-3 gap-4">
              <Campo label="Hecho por" valor={informe.hechoPor} />
              <Campo label="V.B." valor={informe.vB} />
              <Campo label="Fecha" valor={informe.fecha ? new Date(informe.fecha).toLocaleDateString("es-PE") : ""} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-gray-100 px-8 py-4 flex gap-3 shrink-0">
        <button type="button" onClick={onClose} className="text-sm border border-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition">
          ← Volver
        </button>
        <button type="button" onClick={() => exportarInformeTecnicoExcel(informe, ordenTrabajo)}
          className="text-sm bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition font-medium">
          Exportar Excel
        </button>
        {onModificar && (
          <button type="button" onClick={onModificar} className="text-sm bg-amber-500 text-white px-5 py-2.5 rounded-lg hover:bg-amber-600 transition font-medium">
            Editar
          </button>
        )}
      </div>
    </div>
  );
}
