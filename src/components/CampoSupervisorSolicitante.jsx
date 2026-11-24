// El supervisor solicitante viene de la planta elegida (Empresa.plantas[].supervisor). Si la planta
// todavía no tiene uno registrado, el campo sigue siendo texto libre como antes; un valor anterior
// que no coincide con el de la planta se conserva como opción para no perderlo al editar.
export default function CampoSupervisorSolicitante({ planta, value, onChange, className }) {
  const sup = planta?.supervisor;
  if (!sup?.nombre) {
    return <input name="jefeSupervisorSolicitante" value={value} onChange={onChange} placeholder="—" className={className} />;
  }
  return (
    <>
      <select name="jefeSupervisorSolicitante" value={value} onChange={onChange} className={className}>
        <option value="">— Sin supervisor —</option>
        <option value={sup.nombre}>{sup.nombre}</option>
        {value && value !== sup.nombre && <option value={value}>{value}</option>}
      </select>
      {value === sup.nombre && (sup.telefono || sup.correo) && (
        <p className="text-xs text-gray-400 mt-1">{[sup.telefono, sup.correo].filter(Boolean).join(" · ")}</p>
      )}
    </>
  );
}
