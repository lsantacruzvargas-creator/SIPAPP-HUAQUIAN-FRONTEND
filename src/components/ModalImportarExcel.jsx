import { useState } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import * as XLSX from "xlsx";

/* Config por tipo: columnas del Excel (orden = plantilla) */
export const COLS_FACTURAS = [
  { key: "numeroFactura",      label: "N° Factura" },
  { key: "ruc",                label: "RUC", requerido: true },
  { key: "razonSocial",        label: "Razón Social" },
  { key: "fechaEmision",       label: "Fecha emisión", tipo: "fecha" },
  { key: "fechaCancelacion",   label: "Fecha cancelación", tipo: "fecha" },
  { key: "subtotal",           label: "Subtotal", tipo: "numero", requerido: true },
  { key: "descripcion",        label: "Descripción" },
  { key: "encargado",          label: "Encargado" },
  { key: "planta",             label: "Planta" },
  { key: "numeroOrdenCompra",  label: "N° OC" },
  { key: "numeroGuiaEmision",  label: "Guía de llegada" },
  { key: "numeroGuiaRemision", label: "Guía de salida" },
];

export const COLS_OC = [
  { key: "numeroOrden",   label: "N° Orden" },
  { key: "ruc",           label: "RUC", requerido: true },
  { key: "razonSocial",   label: "Razón Social" },
  { key: "fecha",         label: "Fecha", tipo: "fecha" },
  { key: "subtotal",      label: "Subtotal", tipo: "numero", requerido: true },
  { key: "titulo",        label: "Título" },
  { key: "descripcion",   label: "Descripción" },
  { key: "encargado",     label: "Encargado" },
  { key: "planta",        label: "Planta" },
  { key: "numeroFactura", label: "N° Factura" },
];

// Una fila crea y encadena Cotización + Orden de Trabajo + Orden de Compra +
// Factura, todas con el mismo numeroDocumento. Descripción/Subtotal/Encargado/
// Planta se comparten entre los 4 documentos — no hay un título por cada tipo.
export const COLS_CADENA = [
  { key: "ruc",                label: "RUC", requerido: true },
  { key: "razonSocial",        label: "Razón Social" },
  { key: "subtotal",           label: "Subtotal sin IGV", tipo: "numero", requerido: true },
  { key: "encargado",          label: "Encargado" },
  { key: "planta",             label: "Planta" },
  { key: "descripcion",        label: "Descripción (título)" },
  { key: "numeroCotizacion",   label: "N° Cotización" },
  { key: "fechaRecibida",      label: "Fecha recibida", tipo: "fecha" },
  { key: "numeroOT",           label: "N° OT" },
  { key: "numeroOrdenCompra",  label: "N° Orden (OC)" },
  { key: "numeroFactura",      label: "N° Factura" },
  { key: "fechaEmision",       label: "Fecha emisión", tipo: "fecha" },
  { key: "fechaCancelacion",   label: "Fecha cancelación", tipo: "fecha" },
  { key: "numeroGuiaEmision",  label: "Guía de llegada" },
  { key: "numeroGuiaRemision", label: "Guía de salida" },
];

// Una fila crea y encadena Cotización + Orden de Trabajo, y opcionalmente
// también Orden de Compra (si trae N° de orden) — todos con el mismo
// numeroDocumento. Factura se agrega después por separado y hereda el mismo
// número automáticamente al enlazarse con la OC/cotización.
export const COLS_COT_OT = [
  { key: "ruc",                label: "RUC", requerido: true },
  { key: "razonSocial",        label: "Razón Social" },
  { key: "subtotal",           label: "Subtotal sin IGV", tipo: "numero", requerido: true },
  { key: "encargado",          label: "Encargado" },
  { key: "planta",             label: "Planta" },
  { key: "descripcion",        label: "Descripción (título)" },
  { key: "numeroCotizacion",   label: "N° Cotización" },
  { key: "fechaRecibida",      label: "Fecha recibida", tipo: "fecha" },
  { key: "numeroOT",           label: "N° OT" },
  { key: "numeroOrdenCompra",  label: "N° Orden (OC)" },
  { key: "numeroGuiaEmision",  label: "Guía de llegada" },
  { key: "numeroGuiaRemision", label: "Guía de salida" },
];

const LABELS_DETALLE = {
  cotizaciones: "cotizaciones",
  ot:           "órdenes de trabajo",
  oc:           "órdenes de compra",
  facturas:     "facturas",
};

function parseFecha(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString();
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(dt) ? null : dt.toISOString();
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt.toISOString();
}

export default function ModalImportarExcel({ tipo, columnas, endpoint, color = "blue", onClose, onImportado }) {
  const [paso, setPaso]       = useState("subir"); // subir | preview | resultado
  const [filas, setFilas]     = useState([]);      // { datos, errores[] }
  const [nombreArch, setArch] = useState("");
  const [importando, setImp]  = useState(false);
  const [resultado, setRes]   = useState(null);
  const [errorGlobal, setErrG] = useState("");

  const c = {
    blue:    { btn: "bg-blue-600 hover:bg-blue-700",       soft: "bg-blue-50 text-blue-700",       ring: "focus:ring-blue-300" },
    emerald: { btn: "bg-emerald-600 hover:bg-emerald-700", soft: "bg-emerald-50 text-emerald-700", ring: "focus:ring-emerald-300" },
  }[color];

  const descargarPlantilla = () => {
    const ejemplo = {};
    columnas.forEach(col => { ejemplo[col.label] = ""; });
    const ws = XLSX.utils.json_to_sheet([ejemplo], { header: columnas.map(c => c.label) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo.slice(0, 31));
    XLSX.writeFile(wb, `plantilla-${tipo}.xlsx`);
  };

  const leerArchivo = (file) => {
    setErrG(""); setArch(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rows.length === 0) { setErrG("El archivo no tiene filas de datos."); return; }

        // mapa label(normalizado) -> key
        const mapa = {};
        columnas.forEach(col => { mapa[col.label.toLowerCase().trim()] = col; });

        const procesadas = rows.map(row => {
          const datos = {};
          Object.keys(row).forEach(header => {
            const col = mapa[String(header).toLowerCase().trim()];
            if (!col) return;
            let val = row[header];
            if (col.tipo === "fecha")  val = parseFecha(val);
            else if (col.tipo === "numero") val = val === "" ? "" : Number(String(val).replace(",", "."));
            else val = String(val).trim();
            datos[col.key] = val;
          });

          const errores = [];
          columnas.forEach(col => {
            const v = datos[col.key];
            if (col.requerido && (v === "" || v == null)) errores.push(`Falta ${col.label}`);
            if (col.tipo === "numero" && v !== "" && v != null && (isNaN(v) || v < 0)) errores.push(`${col.label} inválido`);
          });
          // Si el RUC no está registrado se necesita Razón Social para crearlo (aviso, no bloqueo)
          return { datos, errores };
        });
        setFilas(procesadas);
        setPaso("preview");
      } catch {
        setErrG("No se pudo leer el archivo. Verifica que sea un Excel válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validas = filas.filter(f => f.errores.length === 0);

  const confirmar = async () => {
    setImp(true);
    const res = await fetchAuth(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas: validas.map(f => f.datos) }),
    });
    if (res.ok) {
      const data = await res.json();
      setRes(data);
      setPaso("resultado");
      onImportado?.();
    } else {
      setErrG("Error al importar. Intenta nuevamente.");
    }
    setImp(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-800">Importar {tipo} desde Excel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* PASO 1 — subir */}
          {paso === "subir" && (
            <div className="space-y-5">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
                <p className="text-sm text-gray-600">
                  1. Descarga la plantilla, rellena tus datos y súbela. El <strong>Subtotal</strong> genera el IGV,
                  total y detracción automáticamente. La empresa se ubica por <strong>RUC</strong> (se crea si no existe).
                </p>
                <button onClick={descargarPlantilla}
                  className={`text-sm ${c.soft} px-4 py-2 rounded-lg font-medium hover:opacity-80 transition`}>
                  ↓ Descargar plantilla
                </button>
              </div>

              <label className="block border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-300 transition">
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) leerArchivo(e.target.files[0]); e.target.value = ""; }} />
                <p className="text-sm text-gray-500">
                  <span className={`font-semibold ${c.soft.split(" ")[1]}`}>Haz clic para subir</span> tu archivo Excel
                </p>
                <p className="text-xs text-gray-400 mt-1">.xlsx o .xls</p>
              </label>

              {errorGlobal && <p className="text-sm text-red-500">{errorGlobal}</p>}
            </div>
          )}

          {/* PASO 2 — preview */}
          {paso === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 truncate">{nombreArch}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.soft}`}>{validas.length} válidas</span>
                {filas.length - validas.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                    {filas.length - validas.length} con error
                  </span>
                )}
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">#</th>
                        {columnas.map(col => <th key={col.key} className="px-2 py-2 text-left whitespace-nowrap">{col.label}</th>)}
                        <th className="px-2 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filas.map((f, i) => (
                        <tr key={i} className={f.errores.length ? "bg-red-50/50" : ""}>
                          <td className="px-2 py-2 text-gray-400">{i + 2}</td>
                          {columnas.map(col => (
                            <td key={col.key} className="px-2 py-2 whitespace-nowrap text-gray-600">
                              {col.tipo === "fecha" && f.datos[col.key]
                                ? new Date(f.datos[col.key]).toLocaleDateString("es-PE")
                                : (f.datos[col.key] === "" || f.datos[col.key] == null
                                    ? <span className="text-gray-300">—</span>
                                    : String(f.datos[col.key]))}
                            </td>
                          ))}
                          <td className="px-2 py-2 whitespace-nowrap">
                            {f.errores.length
                              ? <span className="text-red-600">{f.errores.join(", ")}</span>
                              : <span className="text-green-600">✓ Lista</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {errorGlobal && <p className="text-sm text-red-500">{errorGlobal}</p>}
            </div>
          )}

          {/* PASO 3 — resultado */}
          {paso === "resultado" && resultado && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${c.soft} text-2xl mb-3`}>✓</div>
                <p className="text-lg font-semibold text-gray-800">Importación completada</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.creadas}</p>
                  <p className="text-xs text-gray-500">creadas</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.omitidas}</p>
                  <p className="text-xs text-gray-500">omitidas (duplicadas)</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{resultado.empresasCreadas}</p>
                  <p className="text-xs text-gray-500">empresas nuevas</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    {resultado.ocCreadas ?? resultado.errores.length}
                  </p>
                  <p className="text-xs text-gray-500">
                    {resultado.ocCreadas != null ? "OC creadas" : "errores"}
                  </p>
                </div>
              </div>
              {resultado.detalle && (
                <div className={`rounded-xl bg-gray-50 p-4 grid gap-2 text-center ${
                  { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[Object.keys(resultado.detalle).length] || "grid-cols-4"
                }`}>
                  {Object.entries(resultado.detalle).map(([key, valor]) => (
                    <div key={key}>
                      <p className="text-lg font-bold text-gray-800">{valor}</p>
                      <p className="text-[11px] text-gray-500">{LABELS_DETALLE[key] || key}</p>
                    </div>
                  ))}
                </div>
              )}
              {resultado.errores.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-600 mb-1">Filas con error:</p>
                  {resultado.errores.map((e, i) => (
                    <p key={i} className="text-xs text-red-500">Fila {e.fila}: {e.motivo}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">
          {paso === "subir" && (
            <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              Cancelar
            </button>
          )}
          {paso === "preview" && (<>
            <button onClick={() => { setPaso("subir"); setFilas([]); }}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              Atrás
            </button>
            <button onClick={confirmar} disabled={importando || validas.length === 0}
              className={`text-sm text-white px-5 py-2 rounded-lg disabled:opacity-50 transition font-medium ${c.btn}`}>
              {importando ? "Importando…" : `Importar ${validas.length} ${validas.length === 1 ? "fila" : "filas"}`}
            </button>
          </>)}
          {paso === "resultado" && (
            <button onClick={onClose} className={`text-sm text-white px-5 py-2 rounded-lg transition font-medium ${c.btn}`}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
