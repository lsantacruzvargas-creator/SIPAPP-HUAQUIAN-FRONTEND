import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuth, getUsuario } from "../utils/fetchAuth";
import { formatearFecha } from "../utils/fecha";
import ModalOrdenCompra from "./ModalOrdenCompra";
import SelectorEmpresas from "./SelectorEmpresas";
import ModalSeleccionarTipoInforme from "./ModalSeleccionarTipoInforme";
import FormInformeTecnico from "./FormInformeTecnico";
import VistaInformeTecnico from "./VistaInformeTecnico";
import ModalNuevaSubOT from "./ModalNuevaSubOT";
import ModalRequerimiento from "./ModalRequerimiento";
import TablaServiciosExternos from "./TablaServiciosExternos";
import TablaScroll from "./TablaScroll";
import ModalGenerarGRE from "./ModalGenerarGRE";
import { exportarInformeTecnicoExcel } from "../utils/informeTecnicoExcel";
import {
  FlujoNegocio, TarjetaRelacion, Chip,
  badgePago, badgeOT, badgeGeneral, money, BotonAnular, BotonCerrarCadena, BotonDesanular, BannerAnulado, bloqueadoPorCadenaCerrada,
} from "./detalleShared";

const INP = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full transition";
const RO = "bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 w-full";

const ESTADOS = ["pendiente", "en progreso", "completado", "entregado"];
const CATEGORIAS_SERVICIO = ["SOPORTE", "DEVOLUCION", "DIAGNOSTICO", "GARANTIA", "MANTENIMIENTO", "REPARACION", "PRESTAMO", "SUMINISTRO", "MANTENIMIENTO EN PLANTA"];

const colorEstado = (e, activo) => {
  if (!activo) return "bg-gray-100 text-gray-500 hover:bg-gray-200";
  if (e === "entregado") return "bg-teal-600 text-white";
  if (e === "completado") return "bg-green-600 text-white";
  if (e === "en progreso") return "bg-blue-600 text-white";
  return "bg-amber-500 text-white";
};

export default function DetalleOrdenTrabajo({ orden: inicial, onClose, onGuardada, onNavegar }) {
  const [ot, setOt] = useState(inicial);
  const [form, setForm] = useState({
    numeroOT: inicial.numeroOT || "",
    fechaRecibida: inicial.fechaRecibida
      ? new Date(inicial.fechaRecibida).toISOString().split("T")[0] : "",
    codigoSap: inicial.codigoSap || "",
    empresa: inicial.empresa?._id || "",
    planta: inicial.planta || "",
    // Compatibilidad con OTs guardadas antes de este campo: si no hay
    // personaContacto propio, se intenta preseleccionar por el nombre que ya
    // tenía copiado en contactoNombre.
    personaContacto: inicial.personaContacto || inicial.contactoNombre || "",
    titulo: inicial.titulo || "",
    cantidad: inicial.cantidad ?? "",
    condicion: inicial.condicion || "",
    categorizacionTaller: inicial.categorizacionTaller || "",
    micLinea: inicial.micLinea || "",
    backup: inicial.backup || "",
    entregadoPor: inicial.entregadoPor || "",
    encargado: inicial.encargado || "",
    encargado2: inicial.encargado2 || "",
    numeroGuiaEmision: inicial.numeroGuiaEmision || "",
    numeroGuiaRemision: inicial.numeroGuiaRemision || "",
    fechaSalida: inicial.fechaSalida
      ? new Date(inicial.fechaSalida).toISOString().split("T")[0] : "",
    protocolo: inicial.protocolo || "",
    observaciones: inicial.observaciones || "",
    estado: inicial.estado || "pendiente",
    medioLlegadaEquipo: inicial.medioLlegadaEquipo || "",
    equipoMarca: inicial.equipoMarca || "",
    equipoModelo: inicial.equipoModelo || "",
    equipoCodigo: inicial.equipoCodigo || "",
    equipoTag: inicial.equipoTag || "",
    equipoPotencia: inicial.equipoPotencia || "",
    equipoSerie: inicial.equipoSerie || "",
  });
  const navigate = useNavigate();
  const rolActual = getUsuario()?.rol;
  // Supervisor edita los campos de la OT y los Informes Técnicos, pero no
  // puede anularla. Igual que técnico, supervisor no ve el resto de la
  // cadena (Cotización/OC/Factura).
  const puedeEditarCampos = ["admin", "supervisor", "planner", "coordinadora"].includes(rolActual);
  // Anular un documento queda reservado a Admin y Jefatura — Facturación ya
  // no puede. Desanular y cerrar/abrir la cadena a mano son exclusivos de admin.
  const puedeAnular = ["admin", "jefatura"].includes(rolActual);
  const esAdmin = rolActual === "admin";
  const esTecnico = ["tecnico", "tecnico_prueba", "tecnico_intervencion"].includes(rolActual);
  const esVistaLimitada = esTecnico || ["supervisor", "planner"].includes(rolActual);
  // Tabla de Servicios Externos: la ven todos los roles menos técnico.
  const puedeVerServicios = !esTecnico;
  // Mismo criterio que DetalleCotizacion.jsx/ModalNuevaCotizacion.jsx —
  // Planner puede ver el card de Cotización (ver más abajo) pero nunca su monto.
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(rolActual);
  const cadenaCerrada = bloqueadoPorCadenaCerrada(ot.estadoCadena, rolActual);
  // Estado (Encargado Intervención) y Progreso (Encargado Prueba) son cards
  // independientes del fieldset principal — un técnico no edita el resto de
  // la OT, solo la tarjeta que le corresponde según si su nombre de usuario
  // coincide con `encargado`/`encargado2` de esta OT.
  const nombreActual = getUsuario()?.nombre;
  const coincideNombre = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const puedeEditarEstado = puedeEditarCampos || (esTecnico && coincideNombre(ot.encargado2, nombreActual));
  const puedeEditarEstadoPrueba = puedeEditarCampos || (esTecnico && coincideNombre(ot.encargado, nombreActual));
  // Reasignar QUIÉN es Encargado Prueba/Intervención — a diferencia de arriba,
  // no exige ya ser el encargado (reasignar a otra persona es el propósito).
  // Estrictamente el rol "tecnico" (NO tecnico_prueba/tecnico_intervencion,
  // que solo editan su propia tarjeta de estado/progreso más arriba).
  const puedeEditarEncargados = puedeEditarCampos || rolActual === "tecnico";
  // Aprueba/desaprueba Informes Técnicos — mismo set que crea/edita más
  // abajo, MENOS los roles técnico (ver ROLES_APRUEBAN_INFORME en el
  // backend, informesTecnicos.js).
  const puedeAprobarInforme = ["admin", "jefatura", "planner", "coordinadora"].includes(rolActual);
  // Crea/edita un informe NO aprobado — Admin/Jefatura/Planner/Coordinadora
  // más los 3 roles técnico (quienes de hecho lo llenan en campo). Asistente
  // y Supervisor quedaron afuera (corrección explícita del usuario — antes
  // sí podían) — mismo set que ROLES_CREAN_EDITAN_INFORME en el backend.
  const puedeEditarInformeNoAprobado = puedeAprobarInforme || esTecnico;
  // Un informe ya aprobado no lo edita nadie — hay que desaprobarlo primero
  // (checkbox de arriba) para poder corregirlo.
  const puedeEditarInformeAprobado = false;
  // Mismo set de roles que ya tiene acceso a /facturacion-electronica/guias —
  // técnico (y cualquier otro rol sin acceso a esa ruta) no ve este card.
  const puedeGenerarGRE = ["admin", "asistente", "facturacion", "almacenero", "jefatura", "planner", "coordinadora"].includes(rolActual);
  const [usuarios, setUsuarios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresasOpen, setEmpresasOpen] = useState(false);
  const [cot, setCot] = useState(ot.cotizacion || null);
  const [oc, setOc] = useState(null);
  const [factura, setFactura] = useState(null);
  const [informes, setInformes] = useState([]);
  const [subOTs, setSubOTs] = useState([]);
  const [greMap, setGreMap] = useState({});
  const [requerimientos, setRequerimientos] = useState([]);
  const [crearRequerimientoOpen, setCrearRequerimientoOpen] = useState(false);
  const [servicios, setServicios] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [crearOCOpen, setCrearOCOpen] = useState(false);
  const [crearSubOTOpen, setCrearSubOTOpen] = useState(false);
  const [generarGREOpen, setGenerarGREOpen] = useState(false);
  const [seleccionarTipoOpen, setSeleccionarTipoOpen] = useState(false);
  const [tipoElegido, setTipoElegido] = useState(null);
  const [verInforme, setVerInforme] = useState(null);
  const [editandoInforme, setEditandoInforme] = useState(null);
  const [informesSeleccionados, setInformesSeleccionados] = useState([]);
  const [descargando, setDescargando] = useState(false);

  const cargarRelaciones = () => {
    Promise.all([
      fetchAuth("/cotizaciones").then(r => r.ok ? r.json() : []),
      fetchAuth("/ordenes-compra").then(r => r.ok ? r.json() : []),
      fetchAuth("/facturas").then(r => r.ok ? r.json() : []),
    ]).then(([cots, ocs, facts]) => {
      const cotId = ot.cotizacion?._id || ot.cotizacion;
      const cotResuelta =
        (cotId && cots.find(c => c._id === cotId)) ||
        (ot.numeroDocumento != null && cots.find(c => c.numeroDocumento === ot.numeroDocumento)) ||
        null;
      setCot(cotResuelta);

      const ocResuelta =
        (cotResuelta && ocs.find(o => (o.cotizacion?._id || o.cotizacion) === cotResuelta._id)) ||
        (ot.numeroDocumento != null && ocs.find(o => o.numeroDocumento === ot.numeroDocumento)) ||
        null;
      setOc(ocResuelta);

      const factResuelta =
        (ocResuelta && facts.find(f => (f.ordenCompra?._id || f.ordenCompra) === ocResuelta._id)) ||
        (ot.numeroDocumento != null && facts.find(f => f.numeroDocumento === ot.numeroDocumento)) ||
        null;
      setFactura(factResuelta);
    });

    // Este componente ahora solo se monta para la OT padre/normal (una
    // sub-OT usa DetalleSubOT.jsx) — informes y requerimientos siempre se
    // traen agregados (propios + de todas las sub-OTs).
    fetchAuth(`/informes-tecnicos?ordenTrabajoPadre=${ot._id}`)
      .then(r => r.ok && r.json())
      .then(infs => setInformes(infs || []));

    fetchAuth(`/ordenes-trabajo?ordenPadre=${ot._id}`)
      .then(r => r.ok && r.json())
      .then(subs => {
        setSubOTs(subs || []);
        if (!puedeGenerarGRE) return;
        // Qué sub-OTs (o la propia OT, si no tiene hijas) ya salieron en
        // alguna GRE — para el badge en cada card. Solo cuentan las GRE
        // ACEPTADAS por SUNAT: una rechazada/en error/anulada no significa
        // que el equipo realmente salió, así que no debe marcar la sub-OT
        // como "ya enviada". limit alto porque acá interesan todas las
        // coincidencias, no una página.
        const ids = [ot._id, ...(subs || []).map(s => s._id)];
        return fetchAuth(`/guias?ordenesTrabajo=${ids.join(",")}&estado=ACEPTADO&limit=1000`)
          .then(r => r.ok && r.json())
          .then(data => {
            if (!data?.ok) return;
            const map = {};
            data.data.forEach(g => {
              const codigo = `${g.serie}-${String(g.correlativo).padStart(4, "0")}`;
              (g.ordenesTrabajo || []).forEach(id => {
                const key = id?._id || id;
                map[key] = map[key] ? `${map[key]}, ${codigo}` : codigo;
              });
            });
            setGreMap(map);
          });
      });

    fetchAuth(`/requerimientos?ordenTrabajoPadre=${ot._id}`)
      .then(r => r.ok && r.json())
      .then(reqs => setRequerimientos(reqs || []));

    if (puedeVerServicios) {
      fetchAuth(`/servicios-externos?ordenTrabajoPadre=${ot._id}`)
        .then(r => r.ok && r.json())
        .then(servs => setServicios(servs || []));
    }
  };

  const cargarEmpresas = () =>
    fetchAuth("/empresas").then((res) => res.ok && res.json().then(setEmpresas));

  useEffect(() => {
    // Encargado Prueba / Encargado Intervención se eligen entre los
    // usuarios con login y rol "tecnico" (ver Fase 13 — antes salían de
    // Personal, sin relación real con quién puede loguearse como técnico).
    fetchAuth("/usuarios/lista").then(r => r.ok && r.json()).then(u => setUsuarios((u || []).filter(x => ["tecnico", "tecnico_prueba", "tecnico_intervencion"].includes(x.rol))));
    cargarEmpresas();
    cargarRelaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ot._id]);

  const empresaSel = empresas.find(e => e._id === form.empresa);
  const plantasEmpresa = empresaSel?.plantas ?? [];
  const plantaSel = plantasEmpresa.find(p => p.nombre === form.planta);
  const contactosPlanta = plantaSel?.contactos ?? [];
  const contactoSel = contactosPlanta.find(c => c.nombre === form.personaContacto);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === "empresa" ? { planta: "", personaContacto: "" } : {}),
      ...(name === "planta" ? { personaContacto: "" } : {}),
    }));
  };

  const guardar = async () => {
    setGuardando(true); setError("");
    const body = {
      ...form,
      contactoNombre: contactoSel?.nombre || "",
      contactoTelefono: contactoSel?.telefono || "",
    };
    if (!body.empresa) delete body.empresa;
    if (!body.fechaRecibida) delete body.fechaRecibida;
    if (!body.fechaSalida) delete body.fechaSalida;
    if (!body.categorizacionTaller) delete body.categorizacionTaller;
    body.cantidad = body.cantidad === "" ? null : Number(body.cantidad);

    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al guardar los cambios.");
    }
    setGuardando(false);
  };

  // Cambian de inmediato (sin pasar por "Guardar cambios", que técnico no
  // puede usar) — no llaman `onGuardada` a propósito: ese callback cierra el
  // modal entero (ver DetalleDocumento.jsx `cerrarGuardando`), y marcar un
  // estado no debería sacar al usuario de la vista.
  const cambiarEstado = async (nuevo) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      setForm((f) => ({ ...f, estado: actualizada.estado }));
    }
  };

  const cambiarEstadoPrueba = async (nuevo) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/estado-prueba`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estadoPrueba: nuevo }),
    });
    if (res.ok) setOt(await res.json());
  };

  const cambiarEncargado = async (campo, nombre) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/encargados`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: nombre }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      setForm((f) => ({ ...f, [campo]: actualizada[campo] }));
    }
  };

  const anular = async (motivo) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/anular`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al anular el documento.");
    }
  };

  const desanular = async () => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/desanular`, { method: "PATCH" });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al desanular el documento.");
    }
  };

  const toggleCerrarCadena = async (cerrado) => {
    const res = await fetchAuth(`/ordenes-trabajo/${ot._id}/cerrar-cadena`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cerrado }),
    });
    if (res.ok) {
      const actualizada = await res.json();
      setOt(actualizada);
      onGuardada?.(actualizada);
    } else {
      setError("Error al cerrar/abrir la cadena.");
    }
  };

  // Crea la cotización directo con el contexto de la OT (sin el modal
  // intermedio que pedía N°/tipo/moneda/subtotal) y navega de una al editor
  // completo — pedir esos mismos datos dos veces (modal rápido + de nuevo en
  // el detalle de la cotización, vía ítems) era trabajo duplicado.
  const crearCotizacion = async () => {
    if (!window.confirm("¿Crear una cotización para esta OT?")) return;

    const numRes = await fetchAuth("/cotizaciones/siguiente-numero-cotizacion");
    const { siguiente } = numRes.ok ? await numRes.json() : { siguiente: "" };

    const body = {
      numeroDocumento: ot.numeroDocumento,
      titulo: ot.titulo,
      numeroCotizacion: siguiente,
      tipo: "venta",
      moneda: "PEN",
      planta: ot.planta,
      encargado: ot.encargado,
      numeroGuiaEmision: ot.numeroGuiaEmision,
      numeroGuiaRemision: ot.numeroGuiaRemision,
      codigoSap: ot.codigoSap,
      fechaSalida: ot.fechaSalida,
      subtotal: 0, igv: 0, total: 0,
    };
    if (ot.empresa?._id) body.empresa = ot.empresa._id;
    if (ot.fechaRecibida) body.fechaRecibida = ot.fechaRecibida;

    const res = await fetchAuth("/cotizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setError("Error al crear la cotización."); return; }
    const nueva = await res.json();
    await fetchAuth(`/ordenes-trabajo/${ot._id}/vincular-cotizacion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cotizacion: nueva._id }),
    });
    onNavegar?.({ tipo: "cotizacion", data: nueva });
  };

  // Sin sub-OTs: un solo ítem (la OT misma) — directo al form prellenado, sin
  // paso intermedio. Con sub-OTs: abre el selector para elegir cuáles van en
  // esta GRE (permite envíos parciales, ver ModalGenerarGRE.jsx).
  const abrirGenerarGRE = () => {
    if (subOTs.length > 0) { setGenerarGREOpen(true); return; }
    navigate("/facturacion-electronica/guias/emitir", {
      state: {
        prellenarGRE: {
          items: [{ descripcion: ot.titulo, cantidad: 1, unidad: "NIU" }],
          destinatario: ot.empresa
            ? { schemeID: "6", numDoc: ot.empresa.ruc || "", nombre: ot.empresa.razonSocial || "" }
            : undefined,
          ordenesTrabajo: [ot._id],
        },
      },
    });
  };

  const toggleSeleccionInforme = (id) => {
    setInformesSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAprobarInforme = async (informeId, actual) => {
    const res = await fetchAuth(`/informes-tecnicos/${informeId}/aprobar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobado: !actual }),
    });
    if (res.ok) cargarRelaciones();
  };

  // Reutiliza tal cual la exportación ya existente por informe (utils/informeTecnicoExcel.js) —
  // secuencial (no Promise.all) para no disparar N descargas simultáneas del navegador de golpe.
  const descargarSeleccionados = async () => {
    setDescargando(true);
    for (const id of informesSeleccionados) {
      const inf = informes.find(i => i._id === id);
      if (inf) await exportarInformeTecnicoExcel(inf, inf.ordenTrabajo);
    }
    setDescargando(false);
  };

  const ie = ot.ingresoEquipo;
  const ultimo = informes[0];
  // El estado del padre pasa a ser calculado (backend, recalcularEstadoPadre) apenas tiene al
  // menos una sub-OT "sana" — las marcadas `irreparable` quedan excluidas del cálculo.
  const hayHijasSanas = subOTs.some(s => !s.irreparable);

  const pasos = [
    { tipo: "cotizacion", activo: !!cot, codigo: cot?.codigo },
    { tipo: "ot", activo: true, codigo: ot.codigo },
    { tipo: "informe", activo: informes.length > 0, codigo: informes.length > 1 ? `${informes.length} informes` : informes[0]?.codigo },
    { tipo: "oc", activo: !!oc, codigo: oc?.codigo },
    { tipo: "factura", activo: !!factura, codigo: factura?.codigo },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header degradado */}
      <div className="shrink-0 bg-gradient-to-r from-indigo-600 to-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose}
              className="text-sm text-white/80 hover:text-white transition flex items-center gap-1.5 group shrink-0">
              <span className="group-hover:-translate-x-0.5 transition">←</span> Órdenes de Trabajo
            </button>
            <span className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-lg font-bold text-white uppercase tracking-widest leading-none">Orden de Trabajo</p>
              <h1 className="text-lg font-bold font-mono leading-tight">
                {form.numeroOT || ot.codigo}
              </h1>
              <p className="text-xs font-normal text-white/60 leading-tight">
                {ot.codigo}{ot.numeroDocumento != null && ` · Doc. N° ${ot.numeroDocumento}`}
              </p>
              {ot.empresa && <p className="text-xs text-white/80 leading-tight">{ot.empresa.razonSocial}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none">OT</p>
              <Chip className={`mt-0.5 ${badgeGeneral(ot.estadoGeneral)}`}>{ot.estadoGeneral}</Chip>
              <p className="text-[10px] text-white/60 uppercase tracking-widest leading-none mt-1.5">Estado</p>
              <Chip className="mt-0.5 bg-white/20 text-white">{ot.estado}</Chip>
              {ot.informesAprobados && (
                <Chip className="mt-1 bg-teal-400/30 text-white block">Informes aprobados</Chip>
              )}
            </div>
            {!ot.anulado && !cadenaCerrada && puedeAnular && <BotonAnular onAnular={anular} />}
            {esAdmin && ot.anulado && <BotonDesanular onDesanular={desanular} />}
            {esAdmin && <BotonCerrarCadena cerrado={cadenaCerrada} onToggle={toggleCerrarCadena} />}
            {!ot.anulado && !cadenaCerrada && puedeEditarCampos && (
              <button onClick={guardar} disabled={guardando}
                className="bg-white text-indigo-700 text-sm px-5 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-semibold shadow-sm shrink-0">
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stepper de flujo */}
      <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-8 py-5">
          <FlujoNegocio pasos={pasos} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Progreso (Encargado Prueba) y Estado (Encargado Intervención) —
              cards independientes del fieldset principal: un técnico solo
              edita la que le corresponde según encargado/encargado2. */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progreso — Encargado Prueba</p>
            <select value={ot.encargado || ""} disabled={ot.anulado || cadenaCerrada || !puedeEditarEncargados}
              onChange={(e) => cambiarEncargado("encargado", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500">
              <option value="">Sin asignar</option>
              {usuarios.filter(u => u.rol === "tecnico_prueba").map(u => (
                <option key={u._id} value={u.nombre}>{u.nombre}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {ESTADOS.map(e => (
                <button key={e} type="button" disabled={hayHijasSanas || !puedeEditarEstadoPrueba}
                  onClick={() => cambiarEstadoPrueba(e)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition disabled:opacity-60 disabled:cursor-not-allowed ${colorEstado(e, ot.estadoPrueba === e)}`}>
                  {e}
                </button>
              ))}
            </div>
            {hayHijasSanas && <p className="text-xs text-gray-400">Calculado automáticamente según las sub-órdenes.</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado — Encargado Intervención</p>
            <select value={ot.encargado2 || ""} disabled={ot.anulado || cadenaCerrada || !puedeEditarEncargados}
              onChange={(e) => cambiarEncargado("encargado2", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500">
              <option value="">Sin asignar</option>
              {usuarios.filter(u => u.rol === "tecnico_intervencion").map(u => (
                <option key={u._id} value={u.nombre}>{u.nombre}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {ESTADOS.map(e => (
                <button key={e} type="button" disabled={hayHijasSanas || !puedeEditarEstado}
                  onClick={() => cambiarEstado(e)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition disabled:opacity-60 disabled:cursor-not-allowed ${colorEstado(e, ot.estado === e)}`}>
                  {e}
                </button>
              ))}
            </div>
            {hayHijasSanas && <p className="text-xs text-gray-400">Calculado automáticamente según las sub-órdenes.</p>}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Datos editables */}
          <fieldset disabled={ot.anulado || cadenaCerrada || !puedeEditarCampos} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 self-start">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Datos de la orden de trabajo</h2>
            </div>

            {ot.anulado && (
              <BannerAnulado motivo={ot.motivoAnulacion} por={ot.anuladoPor} fecha={ot.fechaAnulacion} />
            )}

            {!ot.anulado && cadenaCerrada && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                La cadena de este documento está cerrada (factura pagada) — de solo lectura. Solo Jefatura puede editarlo.
              </p>
            )}

            {/* Ingreso de equipo (solo lectura) */}
            {ie && (
              <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  Ingreso de equipo · <span className="font-mono">{ie.codigo}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Tipo de equipo</p>
                    <input value={ie.tipoEquipo || "—"} disabled className={RO} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Marca / Modelo</p>
                    <input value={[ie.marca, ie.modelo].filter(Boolean).join(" / ") || "—"} disabled className={RO} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">N° OT</label>
                <input name="numeroOT" value={form.numeroOT} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de ingreso</label>
                <input type="date" name="fechaRecibida" value={form.fechaRecibida} onChange={handleChange} className={INP} />
              </div>
              <div hidden>
                <label className="text-xs text-gray-500 block mb-1">Código SAP</label>
                <input name="codigoSap" value={form.codigoSap} onChange={handleChange} placeholder="—" className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <div className="flex gap-2">
                  <select name="empresa" value={form.empresa} onChange={handleChange} className={INP}>
                    <option value="">Seleccionar empresa…</option>
                    {empresas.map(e => (
                      <option key={e._id} value={e._id}>
                        {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setEmpresasOpen(true)}
                    className="shrink-0 text-xs border border-gray-300 px-3 rounded-lg hover:bg-gray-50 transition">
                    Empresas
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Planta</label>
                {plantasEmpresa.length > 0 ? (
                  <select name="planta" value={form.planta} onChange={handleChange} className={INP}>
                    <option value="">Seleccionar planta…</option>
                    {plantasEmpresa.map((p, i) => (
                      <option key={i} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <input name="planta" value={form.planta} onChange={handleChange} placeholder="Planta" className={INP} />
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Persona de contacto</label>
                <select name="personaContacto" value={form.personaContacto} onChange={handleChange} className={INP}>
                  <option value="">— Sin contacto —</option>
                  {contactosPlanta.map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
                {contactoSel && (contactoSel.telefono || contactoSel.correo) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {[contactoSel.telefono, contactoSel.correo].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_140px] gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Título OT</label>
                <input name="titulo" value={form.titulo} onChange={handleChange} placeholder="Título de la OT" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Cantidad</label>
                <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del equipo</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Equipo/Marca</label>
                  <input name="equipoMarca" value={form.equipoMarca} onChange={handleChange} className={INP} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Modelo</label>
                  <input name="equipoModelo" value={form.equipoModelo} onChange={handleChange} className={INP} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Código</label>
                  <input name="equipoCodigo" value={form.equipoCodigo} onChange={handleChange} className={INP} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tag</label>
                  <input name="equipoTag" value={form.equipoTag} onChange={handleChange} className={INP} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Potencia</label>
                  <input name="equipoPotencia" value={form.equipoPotencia} onChange={handleChange} className={INP} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">S/N</label>
                  <input name="equipoSerie" value={form.equipoSerie} onChange={handleChange} className={INP} />
                </div>
              </div>
            </div>

            <div hidden>
              <label className="text-xs text-gray-500 block mb-1">Condición</label>
              <input name="condicion" value={form.condicion} onChange={handleChange} className={INP} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Categorización de servicio</label>
                <select name="categorizacionTaller" value={form.categorizacionTaller} onChange={handleChange} className={INP}>
                  <option value="">Seleccionar categoría…</option>
                  {CATEGORIAS_SERVICIO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Entregado por</label>
                <input name="entregadoPor" value={form.entregadoPor} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">MIC/Línea</label>
                <input name="micLinea" value={form.micLinea} onChange={handleChange} className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Backup</label>
                <input name="backup" value={form.backup} onChange={handleChange} className={INP} />
              </div>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Guía de llegada</label>
                <input name="numeroGuiaEmision" value={form.numeroGuiaEmision} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Guía de salida</label>
                <input name="numeroGuiaRemision" value={form.numeroGuiaRemision} onChange={handleChange} placeholder="—" className={INP} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fecha de salida</label>
                <input type="date" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={INP} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Medio de llegada de equipo</label>
              <input name="medioLlegadaEquipo" value={form.medioLlegadaEquipo} onChange={handleChange} placeholder="—" className={INP} />
            </div>

            <div hidden>
              <label className="text-xs text-gray-500 block mb-1">Protocolo</label>
              <input name="protocolo" value={form.protocolo} onChange={handleChange} className={INP} />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
                rows={3} className={`${INP} resize-none`} />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </fieldset>

          {/* Relaciones */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-violet-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Relaciones</h2>
            </div>

            {(!esVistaLimitada || rolActual === "planner") && (
              <TarjetaRelacion tipo="cotizacion" codigo={cot?.codigo} numero={cot?.numeroCotizacion} vacio={!cot}
                onClick={cot ? () => onNavegar?.({ tipo: "cotizacion", data: cot }) : undefined}
                onCrear={!cot && !ot.anulado ? crearCotizacion : undefined} crearLabel="Cotización">
                <p className="text-sm text-gray-700 line-clamp-2">{cot?.titulo}</p>
                {puedeVerPrecios && cot?.total > 0 && <p className="text-xs text-gray-500">{money(cot.total)}</p>}
              </TarjetaRelacion>
            )}

            <TarjetaRelacion tipo="ot" codigo={ot.codigo} numero={ot.numeroOT} actual>
              {ot.estado && <Chip className={badgeOT(ot.estado)}>{ot.estado}</Chip>}
              {greMap[ot._id] && <Chip className="bg-purple-100 text-purple-700">GRE {greMap[ot._id]}</Chip>}
            </TarjetaRelacion>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sub-Órdenes ({subOTs.length})
                </p>
                {!ot.anulado && !cadenaCerrada && !esTecnico && (
                  <button type="button" onClick={() => setCrearSubOTOpen(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline">
                    + Crear Sub-OT
                  </button>
                )}
              </div>
              {subOTs.length === 0 ? (
                <p className="text-xs text-gray-400">Sin sub-órdenes</p>
              ) : (
                <div className="space-y-2">
                  {subOTs.map(s => {
                    const informesSub = informes.filter(inf => (inf.ordenTrabajo?._id || inf.ordenTrabajo) === s._id);
                    const totalInf = informesSub.length;
                    const aprobadosInf = informesSub.filter(inf => inf.aprobado).length;
                    return (
                      <TarjetaRelacion key={s._id} tipo="ot" codigo={s.codigo} numero={s.numeroOT}
                        onClick={() => onNavegar?.({ tipo: "ot", data: s })}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.estado && <Chip className={badgeOT(s.estado)}>{s.estado}</Chip>}
                          {s.irreparable && <Chip className="bg-red-100 text-red-700">Irreparable</Chip>}
                          {totalInf === 0 ? (
                            <Chip className="bg-red-100 text-red-700">Sin informe</Chip>
                          ) : aprobadosInf === totalInf ? (
                            <Chip className="bg-teal-100 text-teal-700">Informe aprobado</Chip>
                          ) : (
                            <Chip className="bg-amber-100 text-amber-700">{aprobadosInf}/{totalInf} informe(s) aprobado(s)</Chip>
                          )}
                          {greMap[s._id] && <Chip className="bg-purple-100 text-purple-700">GRE {greMap[s._id]}</Chip>}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-1">{s.titulo}</p>
                      </TarjetaRelacion>
                    );
                  })}
                </div>
              )}
            </div>

            <TarjetaRelacion
              tipo="informe"
              codigo={ultimo?.codigo}
              numero={informes.length > 1 ? `${informes.length} informes` : undefined}
              vacio={informes.length === 0}
              onClick={!subOTs.length && ultimo ? () => setVerInforme(ultimo) : undefined}
              onCrear={!subOTs.length && !ot.anulado && puedeEditarInformeNoAprobado ? () => setSeleccionarTipoOpen(true) : undefined}
              crearLabel="informe">
              {subOTs.length > 0 ? (
                <p className="text-xs text-gray-400">Ver informes por sub-OT (tabla abajo o en cada sub-OT)</p>
              ) : (
                ultimo?.fechaHoraGuardado && (
                  <p className="text-xs text-gray-500">
                    Último: {formatearFecha(ultimo.fechaHoraGuardado)}
                  </p>
                )
              )}
            </TarjetaRelacion>

            {puedeGenerarGRE && (
              <TarjetaRelacion tipo="gre" vacio
                onCrear={!ot.anulado ? abrirGenerarGRE : undefined} crearLabel="GRE" />
            )}

            {!esVistaLimitada && rolActual !== "coordinadora" && (
              <>
                <TarjetaRelacion tipo="oc" codigo={oc?.codigo} numero={oc?.numeroOrden} vacio={!oc}
                  onClick={oc ? () => onNavegar?.({ tipo: "oc", data: oc, extra: factura }) : undefined}
                  onCrear={!oc && cot && !ot.anulado ? () => setCrearOCOpen(true) : undefined} crearLabel="OC">
                  {oc?.monto > 0 && <p className="text-xs text-gray-500">{money(oc.monto)}</p>}
                </TarjetaRelacion>

                <TarjetaRelacion tipo="factura" codigo={factura?.codigo} numero={factura?.numeroFactura} vacio={!factura}
                  onClick={factura ? () => onNavegar?.({ tipo: "factura", data: factura }) : undefined}>
                  {(factura?.totalAPagar || factura?.total) > 0 && (
                    <p className="text-xs text-gray-500">{money(factura.totalAPagar ?? factura.total)}</p>
                  )}
                  {factura?.estadoPago && <Chip className={badgePago(factura.estadoPago)}>{factura.estadoPago}</Chip>}
                </TarjetaRelacion>
              </>
            )}
          </section>
        </div>

        {informes.length > 0 && (
          <div className="max-w-6xl mx-auto px-8 pb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-teal-500" />
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Informes Técnicos ({informes.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                {!subOTs.length && !ot.anulado && puedeEditarInformeNoAprobado && (
                  <button type="button" onClick={() => setSeleccionarTipoOpen(true)}
                    className="text-sm border border-teal-600 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-50 transition font-medium">
                    + Nuevo informe
                  </button>
                )}
                <button type="button" disabled={informesSeleccionados.length === 0 || descargando}
                  onClick={descargarSeleccionados}
                  className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition font-medium">
                  {descargando ? "Descargando…" : `Descargar seleccionados (${informesSeleccionados.length})`}
                </button>
                </div>
              </div>
              <TablaScroll className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2 pr-3 w-8"></th>
                      <th className="text-left py-2 pr-3">Código</th>
                      <th className="text-left py-2 pr-3">Tipo</th>
                      <th className="text-left py-2 pr-3">OT origen</th>
                      <th className="text-left py-2 pr-3">Fecha</th>
                      <th className="text-left py-2 pr-3">Aprobación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {informes.map(inf => {
                      const otOrigenId = inf.ordenTrabajo?._id || inf.ordenTrabajo;
                      const esPrincipal = otOrigenId === ot._id;
                      const subOrigen = subOTs.find(s => s._id === otOrigenId);
                      return (
                        <tr key={inf._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setVerInforme(inf)}>
                          <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={informesSeleccionados.includes(inf._id)}
                              onChange={() => toggleSeleccionInforme(inf._id)} />
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs text-gray-700">{inf.codigo}</td>
                          <td className="py-2 pr-3 text-gray-600">{inf.tipo}</td>
                          <td className="py-2 pr-3 text-gray-600">
                            {esPrincipal ? "Principal" : (subOrigen?.numeroOT || inf.ordenTrabajo?.numeroOT || "—")}
                          </td>
                          <td className="py-2 pr-3 text-gray-500">
                            {inf.fechaHoraGuardado ? formatearFecha(inf.fechaHoraGuardado) : "—"}
                          </td>
                          <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                            {puedeAprobarInforme ? (
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" checked={!!inf.aprobado}
                                  onChange={() => toggleAprobarInforme(inf._id, inf.aprobado)} />
                                <span className={inf.aprobado ? "text-teal-600 font-medium" : "text-gray-400"}>
                                  {inf.aprobado ? "Aprobado" : "Pendiente"}
                                </span>
                              </label>
                            ) : (
                              <Chip className={inf.aprobado ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}>
                                {inf.aprobado ? "Aprobado" : "Pendiente"}
                              </Chip>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TablaScroll>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-8 pb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-orange-500" />
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Requerimientos de Material ({requerimientos.length})
                </h2>
              </div>
              {!ot.anulado && (
                <button type="button" onClick={() => setCrearRequerimientoOpen(true)}
                  className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition font-medium">
                  + Nuevo requerimiento
                </button>
              )}
            </div>

            {requerimientos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin requerimientos de material</p>
            ) : (
              <TablaScroll className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2 pr-3">Código</th>
                      <th className="text-left py-2 pr-3">Solicitado por</th>
                      <th className="text-left py-2 pr-3">Ítems</th>
                      <th className="text-left py-2 pr-3">Sub-OT</th>
                      <th className="text-left py-2 pr-3">Estado</th>
                      <th className="text-left py-2 pr-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {requerimientos.map(req => {
                      const pendientes = req.items.filter(it => it.estado === "pendiente").length;
                      const otOrigenId = req.ordenTrabajo?._id || req.ordenTrabajo;
                      const esPrincipal = otOrigenId === ot._id;
                      const subOrigen = subOTs.find(s => s._id === otOrigenId);
                      return (
                        <tr key={req._id}>
                          <td className="py-2 pr-3 font-mono text-xs text-gray-700">{req.codigo}</td>
                          <td className="py-2 pr-3 text-gray-600">{req.solicitadoPor}</td>
                          <td className="py-2 pr-3 text-gray-600">
                            {req.items.map((it, i) => (
                              <span key={i} className="block text-xs">
                                {it.esSolicitudCompra ? `${it.categoriaNombre} (compra)` : it.material?.nombre} — {it.cantidad}
                              </span>
                            ))}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">
                            {esPrincipal ? "Principal" : (subOrigen?.numeroOT || req.ordenTrabajo?.numeroOT || "—")}
                          </td>
                          <td className="py-2 pr-3">
                            <Chip className={pendientes > 0 ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                              {pendientes > 0 ? `${pendientes} pendiente(s)` : "Completado"}
                            </Chip>
                          </td>
                          <td className="py-2 pr-3 text-gray-500">
                            {req.createdAt ? formatearFecha(req.createdAt) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TablaScroll>
            )}
          </div>
        </div>

        {puedeVerServicios && (
          <TablaServiciosExternos ot={ot} subOTs={subOTs} servicios={servicios}
            puedeEditar={puedeEditarCampos} onCambio={cargarRelaciones} />
        )}
      </div>

      {crearRequerimientoOpen && (
        <ModalRequerimiento
          ot={ot}
          onClose={() => setCrearRequerimientoOpen(false)}
          onCreado={() => { setCrearRequerimientoOpen(false); cargarRelaciones(); }}
        />
      )}

      {crearSubOTOpen && (
        <ModalNuevaSubOT
          padre={ot}
          onClose={() => setCrearSubOTOpen(false)}
          onCreada={() => { setCrearSubOTOpen(false); cargarRelaciones(); }}
        />
      )}

      {generarGREOpen && (
        <ModalGenerarGRE
          ot={ot}
          subOTs={subOTs}
          onClose={() => setGenerarGREOpen(false)}
        />
      )}

      {crearOCOpen && cot && (
        <ModalOrdenCompra
          cotizacion={cot}
          onClose={() => setCrearOCOpen(false)}
          onCreada={() => { setCrearOCOpen(false); cargarRelaciones(); }}
        />
      )}

      {seleccionarTipoOpen && (
        <ModalSeleccionarTipoInforme
          onSeleccionar={(tipo) => { setSeleccionarTipoOpen(false); setTipoElegido(tipo); }}
          onClose={() => setSeleccionarTipoOpen(false)}
        />
      )}

      {tipoElegido && (
        <FormInformeTecnico
          ordenTrabajo={ot}
          tipo={tipoElegido}
          onClose={() => setTipoElegido(null)}
          onGuardado={(informe) => { setTipoElegido(null); cargarRelaciones(); setVerInforme(informe); }}
        />
      )}

      {verInforme && (
        <VistaInformeTecnico
          informe={verInforme}
          ordenTrabajo={ot}
          onClose={() => setVerInforme(null)}
          onModificar={
            (verInforme.aprobado ? puedeEditarInformeAprobado : puedeEditarInformeNoAprobado) && !verInforme.anulado
              ? () => { setEditandoInforme(verInforme); setVerInforme(null); }
              : undefined
          }
        />
      )}

      {editandoInforme && (
        <FormInformeTecnico
          ordenTrabajo={ot}
          tipo={editandoInforme.tipo}
          informeExistente={editandoInforme}
          onClose={() => setEditandoInforme(null)}
          onGuardado={(informe) => { setEditandoInforme(null); cargarRelaciones(); setVerInforme(informe); }}
        />
      )}

      {empresasOpen && (
        <SelectorEmpresas
          empresas={empresas}
          onClose={() => setEmpresasOpen(false)}
          onSeleccionar={(e) => {
            setForm(f => ({ ...f, empresa: e._id, planta: "" }));
            setEmpresasOpen(false);
          }}
          onCambio={async (guardada, { esNueva }) => {
            await cargarEmpresas();
            if (esNueva) setForm(f => ({ ...f, empresa: guardada._id, planta: "" }));
          }}
        />
      )}
    </div>
  );
}
