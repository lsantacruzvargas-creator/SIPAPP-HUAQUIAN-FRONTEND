import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DosLineas from "../components/DosLineas";
import { fetchAuth, uploadAuth, abrirArchivoProtegido, getUsuario } from "../utils/fetchAuth";
import { formatearFecha, anioLima, mesLima } from "../utils/fecha";
import DetalleDocumento from "../components/DetalleDocumento";
import ModalImportarExcel, { COLS_OC, COLS_CADENA } from "../components/ModalImportarExcel";
import {
  Chip, DotChip, CeldaFacturaPartida, badgeGeneral, dotGeneral, badgeInformes, dotInformes, ESTADOS_SERVICIO, bloqueadoPorPago,
} from "../components/detalleShared";
import TablaScroll from "../components/TablaScroll";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../utils/usePaginacion";
import * as XLSX from "xlsx";
import { r2 } from "../utils/redondeo";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const TH = "px-3 py-3 font-semibold text-gray-500 whitespace-nowrap align-bottom leading-tight";

// "Todas las Órdenes de Compra" (tabla única, sin categorizar por estado) es
// la vista por defecto al abrir la página — mismo patrón pedido para
// Cotizaciones (ver ListaCotizaciones.jsx).
const VISTAS = [
  { valor: "todasLasOC",  label: "Todas las Órdenes de Compra" },
  { valor: "todas",       label: "Todas las tablas" },
  { valor: "sin facturar",      label: "Sin facturar" },
  { valor: "facturada parcial", label: "Facturada parcial" },
  { valor: "facturada",         label: "Facturada" },
  { valor: "pagada",            label: "Pagada" },
];

// Tablas por estado de facturación derivado (estadoFacturacion.estado del backend).
const TABLAS_ESTADO = [
  { estado: "sin facturar",      titulo: "Órdenes de Compra sin facturar",      hoja: "Sin facturar",      acento: "bg-amber-500",   vacio: "Sin órdenes de compra sin facturar" },
  { estado: "facturada parcial", titulo: "Órdenes de Compra facturadas parcialmente", hoja: "Facturada parcial", acento: "bg-sky-500",     vacio: "Sin órdenes de compra facturadas parcialmente" },
  { estado: "facturada",         titulo: "Órdenes de Compra facturadas",        hoja: "Facturada",         acento: "bg-emerald-500", vacio: "Sin órdenes de compra facturadas" },
  { estado: "pagada",            titulo: "Órdenes de Compra pagadas",           hoja: "Pagada",            acento: "bg-gray-500",    vacio: "Sin órdenes de compra pagadas" },
];

const BADGE_FACTURACION = {
  "sin facturar":      "bg-gray-100 text-gray-500",
  "facturada parcial": "bg-sky-100 text-sky-700",
  "facturada":         "bg-emerald-100 text-emerald-700",
  "pagada":            "bg-green-100 text-green-700",
};

const SELECCION_VACIA = { oc: null, partidas: [], cargando: false, error: "" };

const estadoDePartida = (o, p) => o.estadoFacturacion?.partidas?.find((e) => String(e._id) === String(p._id));
const facturadasDe = (o) => (o.estadoFacturacion?.partidas || []).filter((e) => e.estado === "facturada" || e.estado === "pagada").length;
const numerosFacturaDe = (o) => (o.estadoFacturacion?.numerosFactura || "").split(/\s*,\s*/).filter(Boolean);
const idCotDe = (p) => p.cotizacion?._id || p.cotizacion;

// OT padre de cada cotización (mismo criterio que la tabla de partidas de DetalleOrdenCompra.jsx).
const otsPorCotizacion = (ots) => {
  const map = {};
  ots.forEach((ot) => {
    const cotId = ot.cotizacion?._id || ot.cotizacion;
    if (ot.ordenPadre || !cotId) return;
    (map[cotId] ||= []).push(ot.numeroOT || ot.codigo);
  });
  return map;
};

const SORTS = [
  { valor: "fecha",             label: "Más reciente" },
  { valor: "numeroOT",          label: "N° OT" },
  { valor: "numeroCotizacion",  label: "N° Cotización" },
];

// Comparador descendente: numérico si ambos parsean como número, si no
// localeCompare; los valores vacíos van al final.
const compararTexto = (na, nb) => {
  if (!na && !nb) return 0;
  if (!na) return 1;
  if (!nb) return -1;
  const numA = Number(na), numB = Number(nb);
  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
  return String(nb).localeCompare(String(na));
};

// El monto de la OC no tiene moneda propia: hereda la de su Cotización
// (igual que DetalleOrdenCompra.jsx); sin cotización vinculada es Soles.
// Antes se trataba siempre como Soles y una OC de cotización en USD
// mostraba los dólares en la columna S/ (reportado por el usuario, 2026-11-06).
const totalesDuales = (monto, moneda, tipoCambio) => {
  const m = r2(Number(monto) || 0);
  const tc = Number(tipoCambio) || 0;
  if (moneda === "USD") {
    return { pen: tc > 0 ? r2(m * tc) : null, usd: m };
  }
  return { pen: m, usd: tc > 0 ? r2(m / tc) : null };
};

function PillSiNo({ si }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${si ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {si ? "SI" : "NO"}
    </span>
  );
}

// Checkbox con estado "indeterminado" (algunas partidas de la OC marcadas, no todas).
function CheckOC({ marcadas, total, disabled, title, onChange, label }) {
  return (
    <input type="checkbox" aria-label={label} title={title}
      ref={(el) => { if (el) el.indeterminate = marcadas > 0 && marcadas < total; }}
      checked={total > 0 && marcadas === total} disabled={disabled} onChange={onChange}
      className="w-4 h-4 disabled:cursor-not-allowed" />
  );
}

const celdaMonto = (v) => (v != null ? v.toLocaleString("es-PE", { minimumFractionDigits: 2 }) : "—");

function TablaOC({
  titulo, acento, ordenes, otGroupMap, otsCot, greMap, tipoCambio, onSelect, subirDocumento,
  mostrarFactura = true, mostrarTitulo = true, mostrarDocumento = true, mostrarHesActa = false,
  puedeVerPrecios = true, vacioMsg,
  puedeFacturarOC, seleccion, onTogglePartida, onToggleOC, expandidas, onToggleExpandir,
}) {
  const hayCheck = ordenes.some(puedeFacturarOC);
  const totalColumnas = 11
    + (hayCheck ? 1 : 0)
    + (puedeVerPrecios ? 2 : 0)
    + (mostrarFactura ? 1 : 0) + (mostrarTitulo ? 1 : 0)
    + (mostrarHesActa ? 2 : 0) + (mostrarDocumento ? 1 : 0);
  const pag = usePaginacion(ordenes);
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-5 rounded-full ${acento}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{titulo}</h3>
        <span className="text-xs text-gray-400">({ordenes.length})</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <TablaScroll className="overflow-x-auto" fija scrollKey={pag.pagina}>
        <table className="w-full text-sm" style={{ minWidth: `${totalColumnas * 85}px` }}>
          <thead className="bg-gray-50 text-xs uppercase tracking-wide border-b-2 border-gray-200">
            <tr>
              <th className={`${TH} w-8`}><span className="sr-only">Partidas</span></th>
              {hayCheck && <th className={`${TH} w-8`}><span className="sr-only">Seleccionar</span></th>}
              <th className={`${TH} text-left`}><DosLineas>Cotización</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>N° OT</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>N° Orden de Compra</DosLineas></th>
              <th className={`${TH} text-left`}><DosLineas>Fecha de creación</DosLineas></th>
              {mostrarFactura && <th className={`${TH} text-left`}><DosLineas>N° Factura</DosLineas></th>}
              <th className={`${TH} text-left`}><DosLineas>Facturación</DosLineas></th>
              <th className={`${TH} text-left min-w-[13rem]`}><DosLineas>Empresa</DosLineas></th>
              {mostrarTitulo && <th className={`${TH} text-left min-w-[13rem]`}><DosLineas>Título</DosLineas></th>}
              {puedeVerPrecios && <th className={`${TH} text-right`}><DosLineas>Total (S/)</DosLineas></th>}
              {puedeVerPrecios && <th className={`${TH} text-right`}><DosLineas>Total (US$)</DosLineas></th>}
              <th className={`${TH} text-center`}><DosLineas>Estado Cotización</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Estado de servicio</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>Estado Informes</DosLineas></th>
              <th className={`${TH} text-center`}><DosLineas>GRE</DosLineas></th>
              {mostrarHesActa && <th className={`${TH} text-center`}><DosLineas>HES</DosLineas></th>}
              {mostrarHesActa && <th className={`${TH} text-center`}><DosLineas>Acta de Conformidad</DosLineas></th>}
              {mostrarDocumento && <th className={`${TH} text-center`}><DosLineas>Documento</DosLineas></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordenes.length === 0 ? (
              <tr><td colSpan={totalColumnas} className="px-4 py-8 text-center text-gray-400">{vacioMsg}</td></tr>
            ) : pag.visibles.flatMap((o) => {
              const grupoOT = otGroupMap[o.numeroDocumento];
              const otPadre = grupoOT?.parent || null;
              const subs = grupoOT?.subs || [];
              const { pen, usd } = totalesDuales(o.monto, o.cotizacion?.moneda, tipoCambio);
              const partidas = o.partidas || [];
              const estadoFact = o.estadoFacturacion;
              const abierta = expandidas.includes(o._id);
              const seleccionables = puedeFacturarOC(o)
                ? partidas.filter((p) => estadoDePartida(o, p)?.estado === "sin facturar").map((p) => p._id)
                : [];
              const deEstaOC = seleccion.oc?._id === o._id;
              const otraOC = !!seleccion.oc && !deEstaOC;
              const avisoOtraOC = otraOC
                ? `Ya hay partidas seleccionadas de ${seleccion.oc.numeroOrden || seleccion.oc.codigo}: se factura una sola OC a la vez.`
                : undefined;

              const filaPrincipal = (
                <tr key={o._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${o.anulado ? "opacity-50" : ""} ${deEstaOC ? "bg-blue-50/40" : ""}`}
                  onClick={() => onSelect(o)}>
                  <td className="pl-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    {partidas.length > 0 && (
                      <button type="button" onClick={() => onToggleExpandir(o._id)} aria-expanded={abierta}
                        aria-label={abierta ? "Ocultar partidas" : "Ver partidas"} title={abierta ? "Ocultar partidas" : "Ver partidas"}
                        className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded text-base leading-none w-6 h-6">
                        {abierta ? "▾" : "▸"}
                      </button>
                    )}
                  </td>
                  {hayCheck && (
                    <td className="px-2 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      {seleccionables.length > 0 && (
                        <CheckOC marcadas={deEstaOC ? seleccion.partidas.length : 0} total={seleccionables.length}
                          disabled={otraOC} title={avisoOtraOC}
                          label={`Seleccionar las partidas sin facturar de ${o.numeroOrden || o.codigo}`}
                          onChange={() => onToggleOC(o, seleccionables)} />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{o.cotizacion?.numeroCotizacion || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 whitespace-nowrap">{otPadre?.numeroOT || <span className="text-gray-300 font-sans">Sin OT</span>}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800 max-w-[220px]">
                    <div className="flex items-center gap-1.5 flex-wrap break-words">
                      {o.numeroOrden || <span className="text-gray-300">—</span>}
                      {o.anulado && (
                        <span title={o.motivoAnulacion} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                          Anulada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                    {o.createdAt ? formatearFecha(o.createdAt) : <span className="text-gray-300">—</span>}
                  </td>
                  {mostrarFactura && (
                    <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">
                      {numerosFacturaDe(o).length
                        ? numerosFacturaDe(o).map((n) => <div key={n} className="whitespace-nowrap">{n}</div>)
                        : <span className="text-gray-300 font-sans">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {estadoFact?.estado ? (
                      <span className="flex items-center gap-1.5">
                        <Chip className={BADGE_FACTURACION[estadoFact.estado] || "bg-gray-100 text-gray-500"}>{estadoFact.estado}</Chip>
                        {partidas.length > 0 && (
                          <span className="text-xs text-gray-500 tabular-nums" title={`${facturadasDe(o)} de ${partidas.length} partidas facturadas`}>
                            {facturadasDe(o)}/{partidas.length}
                          </span>
                        )}
                        {estadoFact.reservada && (
                          <span title="Un comprobante en emisión incluye partidas de esta OC.">
                            <Chip className="bg-amber-100 text-amber-700">En emisión</Chip>
                          </span>
                        )}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700">{o.empresa?.razonSocial || "—"}</td>
                  {mostrarTitulo && <td className="px-4 py-3.5 text-gray-600">{o.titulo}</td>}
                  {puedeVerPrecios && <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">{celdaMonto(pen)}</td>}
                  {puedeVerPrecios && <td className="px-4 py-3.5 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">{celdaMonto(usd)}</td>}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${o.cotizacion?.aprobado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {o.cotizacion?.aprobado ? "Aprobada" : "Pendiente"}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${o.cotizacion?.enviado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {o.cotizacion?.enviado ? "Enviada" : "No enviada"}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${o.cotizacion?.informeEnviado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {o.cotizacion?.informeEnviado ? "Informe enviado" : "Informe no enviado"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {otPadre ? (
                      <DotChip chip={badgeGeneral(otPadre.estadoGeneral)} dot={dotGeneral(otPadre.estadoGeneral)}>{otPadre.estadoGeneral}</DotChip>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin OT</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {otPadre ? (
                      <DotChip chip={badgeInformes(otPadre.estadoInformes)} dot={dotInformes(otPadre.estadoInformes)}>{otPadre.estadoInformes}</DotChip>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {otPadre && greMap[otPadre._id] ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                        GRE {greMap[otPadre._id]}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin GRE</span>
                    )}
                  </td>
                  {mostrarHesActa && <td className="px-4 py-3.5 text-center"><PillSiNo si={!!o.hesConfirmado} /></td>}
                  {mostrarHesActa && <td className="px-4 py-3.5 text-center"><PillSiNo si={!!o.actaConformidadConfirmada} /></td>}
                  {mostrarDocumento && bloqueadoPorPago(o, getUsuario()?.rol) && (
                    <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      {o.documento ? (
                        <button type="button" onClick={() => abrirArchivoProtegido(o.documento)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium underline">
                          Ver PDF
                        </button>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  )}
                  {mostrarDocumento && !bloqueadoPorPago(o, getUsuario()?.rol) && (
                    <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <label className="cursor-pointer inline-flex flex-col items-center gap-1">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => { if (e.target.files[0]) subirDocumento(o._id, e.target.files[0]); e.target.value = ""; }}
                        />
                        {o.documento ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirArchivoProtegido(o.documento); }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                            >
                              Ver PDF
                            </button>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-400 hover:text-gray-600 underline">Reemplazar</span>
                          </div>
                        ) : (
                          <span className="text-xs text-blue-500 hover:text-blue-700 underline">Subir PDF</span>
                        )}
                      </label>
                    </td>
                  )}
                </tr>
              );

              const filasPartida = !abierta ? [] : partidas.map((p, idx) => {
                const marcada = deEstaOC && seleccion.partidas.includes(p._id);
                const totales = totalesDuales(p.subtotal, o.cotizacion?.moneda, tipoCambio);
                const tituloPartida = (
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{p.titulo || p.cotizacion?.titulo}</span>
                );
                return (
                  <tr key={`${o._id}-${p._id}`}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${marcada ? "bg-blue-50/60" : "bg-sky-50/30"} ${o.anulado ? "opacity-50" : ""}`}
                    onClick={() => onSelect(o)}>
                    <td className="py-3" />
                    {hayCheck && (
                      <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {seleccionables.includes(p._id) && (
                          <input type="checkbox" aria-label={`Seleccionar partida ${idx + 1} de ${o.numeroOrden || o.codigo}`}
                            title={avisoOtraOC} checked={marcada} disabled={otraOC}
                            onChange={() => onTogglePartida(o, p._id)}
                            className="w-4 h-4 disabled:cursor-not-allowed" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-400 mr-2">{idx + 1}/{partidas.length}</span>
                      <span className="font-mono text-sm text-sky-700">{p.cotizacion?.numeroCotizacion || p.cotizacion?.codigo || "—"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600 whitespace-nowrap">
                      {otsCot[idCotDe(p)]?.join(", ") || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    {mostrarFactura && <td className="px-4 py-3" />}
                    <td className="px-4 py-3"><CeldaFacturaPartida estado={estadoDePartida(o, p)} /></td>
                    {/* Sin columna Título (vista Sin facturar), el título de la partida va en la de Empresa. */}
                    <td className="px-4 py-3">{!mostrarTitulo && tituloPartida}</td>
                    {mostrarTitulo && <td className="px-4 py-3">{tituloPartida}</td>}
                    {puedeVerPrecios && <td className="px-4 py-3 text-right text-gray-700 tabular-nums whitespace-nowrap">{celdaMonto(totales.pen)}</td>}
                    {puedeVerPrecios && <td className="px-4 py-3 text-right text-gray-700 tabular-nums whitespace-nowrap">{celdaMonto(totales.usd)}</td>}
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    {mostrarHesActa && <td className="px-4 py-3" />}
                    {mostrarHesActa && <td className="px-4 py-3" />}
                    {mostrarDocumento && <td className="px-4 py-3" />}
                  </tr>
                );
              });

              const filasSub = subs.map((s) => (
                <tr key={s._id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors bg-indigo-50/30 ${s.anulado ? "opacity-50" : ""}`}
                  onClick={() => onSelect(o)}>
                  <td className="py-3" />
                  {hayCheck && <td className="py-3" />}
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 font-semibold text-indigo-700 whitespace-nowrap pl-8">↳ {s.numeroOT}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  {mostrarFactura && <td className="px-4 py-3" />}
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  {mostrarTitulo && <td className="px-4 py-3" />}
                  {puedeVerPrecios && <td className="px-4 py-3" />}
                  {puedeVerPrecios && <td className="px-4 py-3" />}
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-center">
                    <DotChip chip={badgeGeneral(s.estadoGeneral)} dot={dotGeneral(s.estadoGeneral)}>{s.estadoGeneral}</DotChip>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <DotChip chip={badgeInformes(s.estadoInformes)} dot={dotInformes(s.estadoInformes)}>{s.estadoInformes}</DotChip>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {greMap[s._id] ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                        GRE {greMap[s._id]}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin GRE</span>
                    )}
                  </td>
                  {mostrarHesActa && <td className="px-4 py-3" />}
                  {mostrarHesActa && <td className="px-4 py-3" />}
                  {mostrarDocumento && <td className="px-4 py-3" />}
                </tr>
              ));

              return [filaPrincipal, ...filasPartida, ...filasSub];
            })}
          </tbody>
        </table>
        </TablaScroll>
        <Paginacion {...pag} />
      </div>
    </div>
  );
}

export default function ListaOrdenesCompra() {
  const rol = getUsuario()?.rol;
  // Administración ve la vista de OC pero no montos/costos — mismo criterio
  // que Cotizaciones (Fase 16).
  const puedeVerPrecios = ["admin", "facturacion", "jefatura"].includes(rol);
  // Mismo gate que "Facturar seleccionadas" en DetalleOrdenCompra.jsx (POST /facturas puedeCrear).
  const puedeFacturarRol = ["admin", "facturacion", "jefatura"].includes(rol);
  const navigate = useNavigate();
  const [ordenes, setOrdenes]       = useState([]);
  const [otGroupMap, setOtGroupMap] = useState({});
  const [otsCot, setOtsCot]         = useState({});
  const [greMap, setGreMap]         = useState({});
  const [tipoCambio, setTipoCambio] = useState(null);
  const [sortBy, setSortBy]         = useState("fecha");
  const [vista, setVista]           = useState("todasLasOC");
  const [detalle, setDetalle]       = useState(null);
  const [seleccion, setSeleccion]   = useState(SELECCION_VACIA);
  const [expandidas, setExpandidas] = useState([]);
  const [importarOpen, setImportarOpen] = useState(false);
  const [importarCadenaOpen, setImportarCadenaOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estadoOT, setEstadoOT] = useState("");
  const [empresa, setEmpresa]   = useState("");
  const [planta, setPlanta]     = useState("");
  // Sin año/mes preseleccionado — el filtro de fecha solo se aplica cuando
  // el usuario elige uno, no por defecto (pedido explícito del usuario,
  // 2026-09-04; mismo criterio que ListaCotizaciones.jsx).
  const [anio, setAnio]         = useState("");
  const [mes, setMes]           = useState("");

  const cargar = () =>
    Promise.all([
      fetchAuth("/ordenes-compra").then((r) => r.ok ? r.json() : []),
      fetchAuth("/ordenes-trabajo").then((r) => r.ok ? r.json() : []),
      fetchAuth("/tipo-cambio").then((r) => r.ok ? r.json() : null),
    ]).then(([ocs, ots, tc]) => {
      setOrdenes(ocs);
      setSeleccion(SELECCION_VACIA);
      setTipoCambio(tc?.valor ?? null);
      // Agrupa por numeroDocumento (compartido por toda la cadena): la OT
      // padre + sus sub-OTs quedan bajo la misma OC/Cotización/Factura. Una
      // sub-OT hereda el numeroDocumento de su padre al crearse, así que
      // agrupar por este campo agarra padre + hijas sin necesitar `ordenPadre`.
      const otG = {};
      ots.forEach((ot) => {
        if (ot.numeroDocumento == null) return;
        if (!otG[ot.numeroDocumento]) otG[ot.numeroDocumento] = { parent: null, subs: [] };
        if (ot.ordenPadre) otG[ot.numeroDocumento].subs.push(ot);
        else otG[ot.numeroDocumento].parent = ot;
      });
      setOtGroupMap(otG);
      setOtsCot(otsPorCotizacion(ots));

      // GRE generadas por OT/sub-OT (mismo mecanismo que el badge de
      // DetalleOrdenTrabajo.jsx) — solo cuentan las ACEPTADAS por SUNAT.
      const otIds = ots.map((ot) => ot._id);
      if (otIds.length) {
        fetchAuth(`/guias?ordenesTrabajo=${otIds.join(",")}&estado=ACEPTADO&limit=1000`)
          .then((r) => r.ok && r.json())
          .then((data) => {
            if (!data?.ok) return;
            const map = {};
            data.data.forEach((g) => {
              const codigo = `${g.serie}-${String(g.correlativo).padStart(4, "0")}`;
              (g.ordenesTrabajo || []).forEach((id) => {
                const key = id?._id || id;
                map[key] = map[key] ? `${map[key]}, ${codigo}` : codigo;
              });
            });
            setGreMap(map);
          });
      } else {
        setGreMap({});
      }
    });

  useEffect(() => { cargar(); }, []);

  // Una OC sin partidas (legado) no trae el detalle de su factura en estadoFacturacion: el detalle
  // la recibe aparte, buscada entre las facturas cuyo número ya figura en numerosFactura.
  const abrirOrden = async (o) => {
    const numeros = numerosFacturaDe(o);
    if (o.partidas?.length || !numeros.length) return setDetalle({ orden: o, extra: null });
    const facturas = await fetchAuth("/facturas").then((r) => r.ok ? r.json() : []).catch(() => []);
    const extra = facturas.find((f) => {
      const ocId = f.ordenCompra?._id || f.ordenCompra;
      const deLaOC = ocId ? ocId === o._id : f.numeroDocumento != null && f.numeroDocumento === o.numeroDocumento;
      return deLaOC && !f.anulado && (numeros.includes(f.numeroFactura) || numeros.includes(f.codigo));
    }) || null;
    setDetalle({ orden: o, extra });
  };

  const puedeFacturarOC = (o) => puedeFacturarRol && !o.anulado && !bloqueadoPorPago(o, rol);

  // Solo se marcan partidas de una OC a la vez: marcar una de otra OC está deshabilitado en la tabla.
  const togglePartida = (oc, id) => setSeleccion((prev) => {
    const base = prev.oc?._id === oc._id ? prev.partidas : [];
    const partidas = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    return partidas.length ? { ...SELECCION_VACIA, oc, partidas } : SELECCION_VACIA;
  });
  const toggleOC = (oc, ids) => {
    setExpandidas((exp) => exp.includes(oc._id) ? exp : [...exp, oc._id]);
    setSeleccion((prev) => {
      const todas = prev.oc?._id === oc._id && ids.every((id) => prev.partidas.includes(id));
      return todas ? SELECCION_VACIA : { ...SELECCION_VACIA, oc, partidas: ids };
    });
  };
  const toggleExpandir = (id) => setExpandidas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  // Mismo contrato que DetalleOrdenCompra.jsx: `cotizaciones` son las cotizaciones completas
  // (con ítems) de las partidas elegidas, indexadas por _id.
  const facturarSeleccionadas = async () => {
    const { oc, partidas: ids } = seleccion;
    setSeleccion((prev) => ({ ...prev, cargando: true, error: "" }));
    const idsCot = new Set((oc.partidas || []).filter((p) => ids.includes(p._id)).map(idCotDe));
    const cots = await fetchAuth("/cotizaciones").then((r) => r.ok ? r.json() : null).catch(() => null);
    if (!cots) {
      return setSeleccion((prev) => ({ ...prev, cargando: false, error: "No se pudieron cargar las cotizaciones de las partidas. Inténtalo de nuevo." }));
    }
    const cotizaciones = Object.fromEntries(cots.filter((c) => idsCot.has(c._id)).map((c) => [c._id, c]));
    navigate("/facturacion-electronica/emitir", {
      state: { prellenarDesdeOC: { oc, partidas: ids, cotizaciones } },
    });
  };

  const anios = [...new Set(ordenes.map((o) => anioLima(o.fecha)))].sort((a, b) => b - a);

  const empresasLista = [
    ...new Map(
      ordenes.filter((o) => o.empresa?._id).map((o) => [o.empresa._id, o.empresa])
    ).values(),
  ].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));

  const plantasLista = [...new Set(
    (empresa ? ordenes.filter((o) => o.empresa?._id === empresa) : ordenes)
      .map((o) => o.planta)
      .filter(Boolean)
  )].sort();

  const handleEmpresa = (e) => { setEmpresa(e.target.value); setPlanta(""); };

  const filtradas = ordenes.filter((o) => {
    const fecha = new Date(o.fecha);
    const matchAnio  = !anio || anioLima(fecha) === Number(anio);
    const matchMes   = !mes || mesLima(fecha) === Number(mes);
    const txt = busqueda.toLowerCase();
    const grupoOT = otGroupMap[o.numeroDocumento];
    const numerosOT = grupoOT ? [grupoOT.parent, ...grupoOT.subs].filter(Boolean).map((ot) => ot.numeroOT) : [];
    const partidas = o.partidas || [];
    const numerosCot = [
      o.cotizacion?.numeroCotizacion,
      ...partidas.flatMap((p) => [p.cotizacion?.numeroCotizacion, p.cotizacion?.codigo]),
    ];
    const otsPartidas = partidas.flatMap((p) => otsCot[idCotDe(p)] || []);
    const coincide = (v) => v?.toLowerCase().includes(txt);
    const matchBusq  = !txt
      || coincide(o.numeroOrden)
      || coincide(o.titulo)
      || numerosFacturaDe(o).some(coincide)
      || numerosOT.some(coincide)
      || otsPartidas.some(coincide)
      || numerosCot.some(coincide)
      || coincide(o.empresa?.razonSocial)
      || o.empresa?.ruc?.includes(txt);
    const estadoActual = grupoOT?.parent?.estadoGeneral;
    const matchEstado = !estadoOT || estadoActual === estadoOT;
    const matchEmpresa = !empresa || o.empresa?._id === empresa;
    const matchPlanta = !planta || o.planta === planta;
    return matchAnio && matchMes && matchBusq && matchEstado && matchEmpresa && matchPlanta;
  });

  filtradas.sort((a, b) => {
    if (sortBy === "numeroOT") return compararTexto(otGroupMap[a.numeroDocumento]?.parent?.numeroOT, otGroupMap[b.numeroDocumento]?.parent?.numeroOT);
    if (sortBy === "numeroCotizacion") return compararTexto(a.cotizacion?.numeroCotizacion, b.cotizacion?.numeroCotizacion);
    return new Date(b.fecha) - new Date(a.fecha);
  });

  const hayFiltro = busqueda || estadoOT || empresa || planta || anio || mes;
  // Si hay búsqueda de texto activa, no dejar que el selector de "vista"
  // esconda una tabla donde SÍ cae el resultado — mismo criterio que
  // ListaCotizaciones.jsx.
  const vistaEfectiva = busqueda ? "todasLasOC" : vista;

  const porEstado = (estado) => filtradas.filter((o) => (o.estadoFacturacion?.estado || "sin facturar") === estado);

  // Una fila por partida con las columnas de la OC repetidas; una OC sin partidas (legado) va en
  // una sola fila. Mismas columnas que TablaOC (sin "Documento", no aplica a una hoja de cálculo).
  const filasOC = (o) => {
    const grupoOT = otGroupMap[o.numeroDocumento];
    const { pen, usd } = totalesDuales(o.monto, o.cotizacion?.moneda, tipoCambio);
    const partidas = o.partidas || [];
    const base = {
      "Cotización":         o.cotizacion?.numeroCotizacion || "—",
      "N° Orden de Compra": o.numeroOrden || "—",
      "Fecha de creación":  o.createdAt ? formatearFecha(o.createdAt) : "—",
      "N° OT":              grupoOT?.parent?.numeroOT || "—",
      "Sub-OTs":            grupoOT?.subs?.map((s) => s.numeroOT).join(", ") || "—",
      "N° Factura":         o.estadoFacturacion?.numerosFactura || "—",
      "Estado facturación": o.estadoFacturacion?.estado || "—",
      "Partidas facturadas": partidas.length ? `${facturadasDe(o)}/${partidas.length}` : "—",
      "Empresa":            o.empresa?.razonSocial || "—",
      "Título":             o.titulo || "—",
      ...(puedeVerPrecios ? {
        "Total (S/)":       pen != null ? pen.toFixed(2) : "—",
        "Total (US$)":      usd != null ? usd.toFixed(2) : "—",
      } : {}),
      "Aprobado":           o.cotizacion?.aprobado ? "Aprobada" : "Pendiente",
      "Enviado":            o.cotizacion?.enviado ? "Enviada" : "No enviada",
      "Informe enviado":    o.cotizacion?.informeEnviado ? "Enviado" : "No enviado",
      "Estado de servicio": grupoOT?.parent?.estadoGeneral || "Sin OT",
      "Estado Informes":    grupoOT?.parent?.estadoInformes || "—",
      "GRE":                (grupoOT?.parent && greMap[grupoOT.parent._id]) || "Sin GRE",
    };
    const filaPartida = (p, idx) => {
      const estado = p && estadoDePartida(o, p);
      const totales = p ? totalesDuales(p.subtotal, o.cotizacion?.moneda, tipoCambio) : {};
      return {
        ...base,
        "Partida":                  p ? `${idx + 1}/${partidas.length}` : "—",
        "Cotización de la partida": p ? (p.cotizacion?.numeroCotizacion || p.cotizacion?.codigo || "—") : "—",
        "OT de la partida":         p ? (otsCot[idCotDe(p)]?.join(", ") || "—") : "—",
        "Título de la partida":     p ? (p.titulo || p.cotizacion?.titulo || "—") : "—",
        ...(puedeVerPrecios ? {
          "Total partida (S/)":     totales.pen != null ? totales.pen.toFixed(2) : "—",
          "Total partida (US$)":    totales.usd != null ? totales.usd.toFixed(2) : "—",
        } : {}),
        "Factura de la partida":    estado?.factura ? (estado.factura.numeroFactura || estado.factura.codigo) : "—",
        "Estado de la partida":     estado?.estado || "—",
      };
    };
    return partidas.length ? partidas.map(filaPartida) : [filaPartida(null)];
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    TABLAS_ESTADO.forEach(({ estado, hoja }) => {
      const ws = XLSX.utils.json_to_sheet(porEstado(estado).flatMap(filasOC));
      XLSX.utils.book_append_sheet(wb, ws, hoja);
    });
    XLSX.writeFile(wb, "ordenes-de-compra.xlsx");
  };

  const subirDocumento = async (id, file) => {
    const fd = new FormData();
    fd.append("documento", file);
    const res = await uploadAuth(`/ordenes-compra/${id}/documento`, fd);
    if (res.ok) {
      const actualizada = await res.json();
      setOrdenes((prev) => prev.map((o) => o._id === id ? { ...o, documento: actualizada.documento } : o));
    }
  };

  const propsTabla = {
    otGroupMap, otsCot, greMap, tipoCambio, puedeVerPrecios,
    onSelect: abrirOrden, subirDocumento,
    puedeFacturarOC, seleccion, onTogglePartida: togglePartida, onToggleOC: toggleOC,
    expandidas, onToggleExpandir: toggleExpandir,
  };
  const vacioFiltro = "Sin resultados para los filtros aplicados";

  return (
    <div className="p-6 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Órdenes de Compra</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filtradas.length} orden{filtradas.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Exportar Excel
          </button>
          <button onClick={() => setImportarOpen(true)}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Importar Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex gap-3 flex-wrap items-center barra-filtros">
        <select
          value={anio}
          onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todo año</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value ? Number(e.target.value) : "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todo mes</option>
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={empresa}
          onChange={handleEmpresa}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Toda empresa</option>
          {empresasLista.map((e) => (
            <option key={e._id} value={e._id}>
              {e.alias ? `${e.alias} — ` : ""}{e.razonSocial}
            </option>
          ))}
        </select>
        {plantasLista.length > 0 && (
          <select
            value={planta}
            onChange={(e) => setPlanta(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Toda planta</option>
            {plantasLista.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por N° OT, cotización, OC, factura, título, empresa o RUC…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-60 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={estadoOT}
          onChange={(e) => setEstadoOT(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todo estado de servicio</option>
          {ESTADOS_SERVICIO.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
        <select
          value={vista}
          onChange={(e) => setVista(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {VISTAS.map(({ valor, label }) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {SORTS.map(({ valor, label }) => (
            <option key={valor} value={valor}>Ordenar: {label}</option>
          ))}
        </select>
        {(hayFiltro || vista !== "todasLasOC") && (
          <button
            onClick={() => { setBusqueda(""); setEstadoOT(""); setEmpresa(""); setPlanta(""); setAnio(""); setMes(""); setVista("todasLasOC"); }}
            className="text-sm text-gray-400 hover:text-gray-700 transition"
          >
            Limpiar
          </button>
        )}
      </div>

      {seleccion.oc && (
        <div className="sticky top-0 z-10 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-blue-900">
            {seleccion.partidas.length} partida{seleccion.partidas.length !== 1 ? "s" : ""} de{" "}
            <span className="font-semibold">{seleccion.oc.numeroOrden || seleccion.oc.codigo}</span>
            {seleccion.oc.empresa?.razonSocial && <span className="text-blue-700"> · {seleccion.oc.empresa.razonSocial}</span>}
          </p>
          {seleccion.error && <p className="text-sm text-red-600">{seleccion.error}</p>}
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={() => setSeleccion(SELECCION_VACIA)} disabled={seleccion.cargando}
              className="text-sm text-gray-500 hover:text-gray-800 transition disabled:opacity-50">
              Quitar selección
            </button>
            <button type="button" onClick={facturarSeleccionadas} disabled={seleccion.cargando}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium">
              {seleccion.cargando ? "Preparando…" : `Facturar seleccionadas (${seleccion.partidas.length})`}
            </button>
          </div>
        </div>
      )}

      {vistaEfectiva === "todasLasOC" && (
        <TablaOC
          {...propsTabla}
          titulo="Todas las Órdenes de Compra"
          acento="bg-blue-500"
          ordenes={filtradas}
          vacioMsg={hayFiltro ? vacioFiltro : "Sin órdenes de compra registradas"}
        />
      )}

      {TABLAS_ESTADO.filter(({ estado }) => vistaEfectiva === "todas" || vistaEfectiva === estado).map(({ estado, titulo, acento, vacio }) => (
        <TablaOC
          key={estado}
          {...propsTabla}
          titulo={titulo}
          acento={acento}
          ordenes={porEstado(estado)}
          {...(estado === "sin facturar" ? { mostrarFactura: false, mostrarTitulo: false, mostrarDocumento: false, mostrarHesActa: true } : {})}
          vacioMsg={hayFiltro ? vacioFiltro : vacio}
        />
      ))}

      {detalle && (
        <DetalleDocumento
          tipo="oc"
          data={detalle.orden}
          extra={detalle.extra}
          onClose={() => { setDetalle(null); cargar(); }}
          onGuardadaOC={(actualizada) => {
            setOrdenes((prev) => prev.map((o) => o._id === actualizada._id ? actualizada : o));
          }}
        />
      )}

      {importarOpen && (
        <ModalImportarExcel
          tipo="Ordenes de Compra"
          columnas={COLS_OC}
          endpoint="/ordenes-compra/importar"
          color="blue"
          onClose={() => setImportarOpen(false)}
          onImportado={cargar}
        />
      )}

      {importarCadenaOpen && (
        <ModalImportarExcel
          tipo="Cadena completa (Cotización + OT + OC + Factura)"
          columnas={COLS_CADENA}
          endpoint="/cadena/importar"
          color="blue"
          onClose={() => setImportarCadenaOpen(false)}
          onImportado={cargar}
        />
      )}
    </div>
  );
}
