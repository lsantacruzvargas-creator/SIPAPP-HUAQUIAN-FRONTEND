import { INP, INP_RO } from "../utils/cotizacionItems";

export default function CeldasNumericas({ item, ro, onUpdate }) {
  return (
    <>
      <td className="px-3 py-2">
        <input
          type="number" min="0" step="0.01"
          value={item.cantidad}
          onChange={(e) => onUpdate(item._key, "cantidad", parseFloat(e.target.value) || 0)}
          required disabled={ro}
          className={`w-16 text-center ${ro ? INP_RO : INP}`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          value={item.fechaEntrega}
          onChange={(e) => onUpdate(item._key, "fechaEntrega", e.target.value)}
          disabled={ro}
          className={ro ? INP_RO : INP}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number" min="0" step="0.01"
          value={item.precio}
          onChange={(e) => onUpdate(item._key, "precio", parseFloat(e.target.value) || 0)}
          required disabled={ro}
          className={`w-24 text-right ${ro ? INP_RO : INP}`}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <select
          value={item.moneda}
          onChange={(e) => onUpdate(item._key, "moneda", e.target.value)}
          disabled={ro}
          className={ro ? "bg-transparent text-sm text-center" : `${INP} text-center`}
        >
          <option value="PEN">S/</option>
          <option value="USD">$</option>
        </select>
      </td>
    </>
  );
}
