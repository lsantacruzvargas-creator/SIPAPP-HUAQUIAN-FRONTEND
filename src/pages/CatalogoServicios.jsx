import { useState, useEffect } from "react";
import { fetchAuth } from "../utils/fetchAuth";
import ModalCatalogoServicio from "../components/ModalCatalogoServicio";

export default function CatalogoServicios() {
  const [catalogo, setCatalogo] = useState([]);
  const [modal, setModal] = useState(null); // null | "nuevo" | objeto grupo

  useEffect(() => {
    fetchAuth("/catalogo-servicios").then((r) => r.ok ? r.json() : []).then(setCatalogo);
  }, []);

  const upsert = (g) => {
    setCatalogo((prev) => {
      const existe = prev.find((x) => x._id === g._id);
      return existe ? prev.map((x) => (x._id === g._id ? g : x)) : [...prev, g];
    });
    setModal(null);
  };

  const eliminar = async (g) => {
    if (!confirm(`¿Eliminar el grupo "${g.grupo}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetchAuth(`/catalogo-servicios/${g._id}`, { method: "DELETE" });
    if (res.ok) setCatalogo((prev) => prev.filter((x) => x._id !== g._id));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Catálogo de servicios</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">
            Grupos e ítems disponibles al armar el detalle de una cotización
          </p>
        </div>
        <button
          onClick={() => setModal("nuevo")}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition"
        >
          + Nuevo grupo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-500 text-white text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Grupo</th>
                <th className="px-4 py-3 text-center">Ítems</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {catalogo.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Sin grupos registrados</td></tr>
              ) : catalogo.map((g) => (
                <tr key={g._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 cursor-pointer" onClick={() => setModal(g)}>
                    {g.grupo}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{g.items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => setModal(g)} className="text-xs text-gray-500 hover:text-gray-800 transition">
                      Editar
                    </button>
                    <button onClick={() => eliminar(g)} className="text-xs text-red-400 hover:text-red-600 transition">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ModalCatalogoServicio
          grupoServicio={modal === "nuevo" ? null : modal}
          onClose={() => setModal(null)}
          onGuardado={upsert}
        />
      )}
    </div>
  );
}
