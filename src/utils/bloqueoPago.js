// Aprobar, enviar, anular, generar-ot/quitar-ot, estado/encargados de OT y el PUT de informe responden
// sin `bloqueadoPorPago` ni `bloqueo`: se conserva lo que ya se tenía en vez de pisarlo con undefined.
export const fusionarBloqueo = (previo, nuevo) => ({
  ...nuevo,
  bloqueadoPorPago: nuevo?.bloqueadoPorPago ?? previo?.bloqueadoPorPago,
  bloqueo: nuevo?.bloqueo ?? previo?.bloqueo,
});
