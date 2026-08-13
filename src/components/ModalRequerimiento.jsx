import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import SelectorMateriales from "./SelectorMateriales";
import ModalSolicitudCompra from "./ModalSolicitudCompra";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full";

// Requerimiento de material desde una OT (padre o sub-OT): mezcla ítems de
// stock existente (buscados por SKU) y solicitudes de compra (sin SKU
// todavía) en una sola lista, enviados juntos al backend.
export default function ModalRequerimiento({ ot, onClose, onCreado }) {
  const [personal, setPersonal] = useState([]);
  const [personalId, setPersonalId] = useState("");
  const [items, setItems] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [solicitudAbierta, setSolicitudAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuth("/personal/lista").then((r) => r.ok && r.json()).then((d) => setPersonal(d || []));
  }, []);

  const personaSel = personal.find((p) => p._id === personalId);

  const agregarMaterial = (material) => {
    setItems((prev) => [...prev, {
      key: `${material._id}-${Date.now()}`,
      esSolicitudCompra: false,
      material: material._id,
      materialInfo: material,
      cantidad: 1,
    }]);
    setBuscadorAbierto(false);
  };

  const agregarCompra = (item) => {
    setItems((prev) => [...prev, { ...item, key: `compra-${Date.now()}` }]);
    setSolicitudAbierta(false);
  };

  const cambiarCantidad = (key, cantidad) => {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, cantidad: Number(cantidad) } : it));
  };

  const quitarItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));

  const guardar = async () => {
    if (!personalId) { setError("Selecciona quién solicita el material."); return; }
    if (items.length === 0) { setError("Agrega al menos un ítem."); return; }
    for (const it of items) {
      if (!it.cantidad || it.cantidad <= 0) { setError("Todos los ítems necesitan una cantidad válida."); return; }
    }

    setGuardando(true);
    setError("");
    const body = {
      ordenTrabajo: ot._id,
      solicitadoPor: personaSel?.nombre || "",
      dni: personaSel?.dni || "",
      personal: personalId,
      observaciones,
      items: items.map((it) => it.esSolicitudCompra
        ? { esSolicitudCompra: true, cantidad: it.cantidad, categoriaMaterial: it.categoriaMaterial, categoriaNombre: it.categoriaNombre, camposCompra: it.camposCompra }
        : { esSolicitudCompra: false, material: it.material, cantidad: it.cantidad }),
    };
    const r = await fetchAuth("/requerimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      onCreado(await r.json());
    } else {
      const d = await r.json();
      setError(d.mensaje || "Error al guardar el requerimiento");
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">Nuevo requerimiento de material</h3>
            <p className="text-xs text-gray-400">{ot.numeroOT} — {ot.titulo}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Solicitado por *</label>
            <select value={personalId} onChange={(e) => setPersonalId(e.target.value)} className={INP}>
              <option value="">Seleccionar…</option>
              {personal.map((p) => <option key={p._id} value={p._id}>{p.nombre}{p.dni ? ` — DNI ${p.dni}` : ""}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setBuscadorAbierto(true)}
              className="text-sm border border-blue-300 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition font-medium">
              + Buscar material en stock
            </button>
            <button onClick={() => setSolicitudAbierta(true)}
              className="text-sm border border-amber-300 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-50 transition font-medium">
              + Solicitar compra
            </button>
          </div>

          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-gray-300 text-center py-6">Sin ítems agregados</p>
            )}
            {items.map((it) => (
              <div key={it.key} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  {it.esSolicitudCompra ? (
                    <>
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 mr-1.5">Compra</span>
                        {it.categoriaNombre}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {Object.entries(it.camposCompra).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-800">{it.materialInfo.nombre}</p>
                      <p className="text-xs text-gray-400 font-mono">{it.materialInfo.codigo} — stock: {it.materialInfo.stock} {it.materialInfo.unidad}</p>
                    </>
                  )}
                </div>
                <input type="number" min={0.01} step="any" value={it.cantidad}
                  onChange={(e) => cambiarCantidad(it.key, e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right" />
                <button onClick={() => quitarItem(it.key)} className="text-gray-300 hover:text-red-500 transition">✕</button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              className={INP} rows={2} placeholder="Opcional" />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {guardando ? "Guardando…" : "Enviar requerimiento"}
          </button>
        </div>
      </div>

      {buscadorAbierto && (
        <SelectorMateriales onSelect={agregarMaterial} onClose={() => setBuscadorAbierto(false)} />
      )}
      {solicitudAbierta && (
        <ModalSolicitudCompra onAgregar={agregarCompra} onClose={() => setSolicitudAbierta(false)} />
      )}
    </div>
  );
}
