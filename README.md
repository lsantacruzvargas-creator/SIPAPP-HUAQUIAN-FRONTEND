# SIP App Huaquian — Frontend

ERP de Huaquian, empresa dedicada a la reparación de motores y mantenimiento industrial. React 19 + Vite + Tailwind CSS v4 + React Router (HashRouter). Empaquetable como app de escritorio con Electron, con auto-actualización.

## Requisitos

- Node.js 18+
- Backend corriendo (ver `../Backend/README.md`)

## Instalación

```bash
npm install
```

## Scripts

```bash
npm run dev              # servidor de desarrollo (Vite)
npm run build             # build de producción → dist/
npm run preview           # sirve el build de dist/ localmente
npm run lint               # ESLint
npm run electron:dev       # app de escritorio en modo desarrollo
npm run electron:build     # empaqueta instalador de escritorio (dist-electron/), sin publicar
npm run release:patch      # bump patch + build + publica instalador en GitHub Releases
npm run release:minor      # bump minor + build + publica
npm run release:major      # bump major + build + publica
```

## Configuración

Copiar el `.env.example` a `.env` en `Frontend/` y completar:

```
VITE_API_URL=https://api.huaquian-sac.com/api   # o http://localhost:5000/api en desarrollo
```

`VITE_API_URL` se resuelve en build-time (Vite) desde `src/utils/fetchAuth.js`, con fallback a `http://localhost:5000/api` si no está definida.

## Despliegue web (Cloudflare Pages)

El sitio en `www.huaquian-sac.com` se despliega automáticamente en cada `git push` a este repo — Cloudflare Pages hace su propio `npm run build` desde el código fuente (no usa la carpeta local `dist/`, que está en `.gitignore`). No hace falta ningún paso manual para el despliegue web.

**Cuidado con archivos estáticos servidos desde `public/` con nombre fijo** (ej. las plantillas `.xlsx` de `public/informes-templates/`): a diferencia del JS/CSS del bundle (que sí llevan hash de contenido en el nombre y por eso invalidan caché solos), estos se piden siempre con la misma URL — el fetch que los descarga usa `cache: "no-store"` + un query param `?v=timestamp` para evitar que el navegador o el CDN sirvan una versión vieja después de un deploy (ver `src/utils/informeTecnicoExcel.js`).

## Estructura

```
src/
  components/   # componentes reutilizables (modales, Sidebar, vistas de detalle a pantalla completa)
  pages/        # una página por ruta
  utils/        # fetchAuth (JWT + helper de fetch), generadores de PDF/Excel, catálogos de datos
  App.jsx        # definición de rutas (HashRouter)
public/
  informes-templates/   # plantillas .xlsx REALES de cada tipo de Informe Técnico — marcadas
                          # binarias en .gitattributes (ver nota abajo)
electron/        # main.cjs (proceso principal Electron), preload
```

## Páginas / módulos (`src/App.jsx`)

| Ruta | Descripción |
|---|---|
| `/dashboard` | Panel general |
| `/empresas` | Empresas cliente + plantas + contactos |
| `/cotizaciones`, `/cotizaciones/nueva` | Cotizaciones — vista "Todas las cotizaciones" por defecto + selector de tablas categorizadas (sin OT/pendientes de OC/con OC/cerradas). 3 formatos de ítems/cálculo: estándar, Gloria, "Alicorp" (compartido por Alicorp/Intradevco/Masterbread — ver abajo) |
| `/ordenes-trabajo` | Órdenes de Trabajo + sub-OTs, estado agregado por sub-OTs |
| `/facturas` | Facturas — crear, editar, importar Excel, estado de pago/cuotas |
| `/ordenes-compra` | Órdenes de Compra — vista "Todas las OC" por defecto + tablas categorizadas |
| `/ingresos-equipo` | Ingreso de equipos a taller |
| `/usuarios` | Gestión de usuarios + fichas de Personal (exclusivo admin) |
| `/catalogo-servicios` | Catálogo de ítems reutilizables para cotizaciones |
| `/almacen`, `/inventario` | Stock, materiales, movimientos |
| `/facturacion-electronica`, `/facturacion-electronica/emitir` | Comprobantes de Pago Electrónicos (CPE: Factura/Boleta/Nota) vía hub SUNAT |
| `/facturacion-electronica/guias`, `/guias/emitir` | Guías de Remisión Electrónica (GRE, tipo Remitente/Transportista) |
| `/aprobaciones` | Aprobación de Informes Técnicos |
| `/requerimientos` | Requerimientos de material de una OT (atención: salida/devolución/rechazo) |
| `/tipo-cambio` | Tipo de cambio PEN/USD compartido |
| `/reportes` | Reportes agregados |
| `/sistema` | Configuración/salud del sistema |

## Autenticación y roles

JWT almacenado en `localStorage`. `src/utils/fetchAuth.js` adjunta el token en cada request y expone `getUsuario()`/`logout()`.

Roles: `admin`, `jefatura`, `facturacion`, `asistente`, `planner`, `supervisor`, `coordinadora`, `almacenero`, `tecnico`, `tecnico_prueba`, `tecnico_intervencion`. `admin` y `jefatura` tienen privilegio completo de creación/edición en toda la app (salvo importaciones masivas destructivas e gestión de Usuarios/Personal, exclusivas de `admin`). El Sidebar y las rutas protegidas (`<ProtectedRoute roles={[...]}>` en `App.jsx`) ocultan navegación según rol; el backend valida el permiso real en cada endpoint (ver `../Backend/README.md`).

## Navegación (Sidebar)

Sidebar vertical colapsable (`src/components/Sidebar.jsx`), con 3 temas — Claro/Oscuro/Cálido — seleccionables y persistidos en `localStorage`, aplicados vía atributo `data-theme` en `<html>` con tokens Tailwind v4 (`@theme inline` en `src/index.css`).

## Informes Técnicos — Excel

Sistema aparte de las notas de avance simples (`Informe`, backend `/api/informes`): **Informe Técnico** (`FormInformeTecnico.jsx`) es un formulario config-driven — cada uno de los **15 tipos de equipo** (variador, arrancador, PLC, panel, PC, tarjetas, servomotor, UPS, suministro, diagnósticos, equipo en general, mantenimiento de variador, etc., ver `src/utils/informesTecnicos.js`) define sus propias secciones (campos, checklist, tablas, fotos), y `src/utils/informeTecnicoExcel.js` exporta el resultado **directamente sobre la plantilla `.xlsx` real** de `public/informes-templates/` (con ExcelJS), preservando 100% el formato/logo/merges original — no genera un Excel desde cero. Cada celda de cada tipo está mapeada manualmente contra la plantilla real (`MAPEOS`/`SLOTS_FOTOS` en ese archivo); lo que no tiene celda mapeada cae a un bloque "DATOS ADICIONALES" anexo al final, para nunca perder un dato capturado.

**Las plantillas `.xlsx` están marcadas como binarias en `.gitattributes`** — sin eso, `core.autocrlf` (activo en Windows) corrompe 1-2 bytes en cada `git checkout`/`pull`, rompiendo el archivo silenciosamente (Excel lo "repara" solo al abrir, pero ExcelJS puede perder contenido). Si se agrega una plantilla `.xlsx` nueva a `public/informes-templates/`, no hace falta hacer nada extra — el patrón `*.xlsx binary` ya cubre toda la carpeta.

## Cotizaciones — formatos, ítems y PDF

- **Formato estándar**: `TablaItemsCotizacion.jsx` — ítems manuales o desde catálogo, subtotal con descuento.
- **Formato Gloria**: `TablaItemsCotizacionGloria.jsx` — 5 grupos fijos, gastos generales + utilidad sobre el subtotal.
- **Formato "Alicorp"** (`TablaItemsCotizacionAlicorp.jsx`): mismo criterio que Gloria (5 grupos, gastos administrativos + utilidad), compartido hoy por **Alicorp** (RUC 20100055237), **Intradevco** (20417378911) y **Masterbread** (20557345931) — `esFormatoAlicorp(ruc)` en `src/utils/cotizacionItems.js` decide cuál empresa usa este formato. El PDF (`src/utils/cotizacionAlicorpPdf.js`) lee razón social/dirección de la empresa real de la cotización (no hardcodeado a Alicorp).
- Todos los formatos exportan a PDF con jsPDF + jspdf-autotable — membrete con logos (`public/assets/logos/`), marca de agua, tabla de ítems, condiciones comerciales, logos de marcas al pie.
- **"Total sin IGV" en las tablas de lista** se deriva siempre de `cotizacion.total / 1.18` (nunca de `subtotal` directo) — `total` es el único campo que refleja de forma confiable el monto final en los 3 formatos, ya que `subtotal` guarda el valor crudo de ítems sin descuento/margen aplicado.

## Convenciones de UI

- Formularios: un solo `useState` por formulario + `handleChange` genérico.
- Precios/montos traídos de la API son siempre `readOnly`.
- Visibilidad de precios (`puedeVerPrecios`) restringida a `admin`/`facturacion`/`jefatura` en Cotización/OC/OT — el resto de roles arma los documentos sin ver montos.
- Vistas de detalle a pantalla completa (`DetalleCotizacion`, `DetalleOrdenTrabajo`, `DetalleOrdenCompra`, `DetalleFactura`) navegan entre sí reemplazando el estado en `DetalleDocumento.jsx` (sin anidar overlays); el panel "Relaciones" soporta relaciones 1:N.
- Componentes compartidos de detalle (`TarjetaRelacion`, `FlujoNegocio`, `Chip`, `DotChip`, `money()`, helpers `badge*/dot*`) viven en `src/components/detalleShared.jsx`.
- Páginas de lista con varias categorías usan un selector de "vista", con una tabla "Todas las X" sin filtrar como opción por defecto, más las tablas categorizadas individuales.
- Import/Export Excel vía librería `xlsx` (`ModalImportarExcel.jsx`).
- Nunca `window.alert`/`confirm`/`prompt` — en Electron son diálogos nativos del SO que pueden dejar el foco de teclado/mouse sin volver al `BrowserWindow` (bug real confirmado en este proyecto). Usar siempre un modal de confirmación propio en React.

## Build de escritorio (Electron)

```bash
npm run electron:build
```

Genera el instalador en `dist-electron/` (configuración en `package.json` → `build`), sin publicarlo. Requiere haber corrido `npm run build` antes (o usar `electron:build`, que ya encadena ambos) — correr `electron-builder` solo sin buildear antes empaqueta un `dist/` viejo.

## Releases en GitHub + auto-actualización

La app se distribuye publicando instaladores en los **Releases** del repo público `lsantacruzvargas-creator/SIPAPP-HUAQUIAN-FRONTEND`. Al ser público, `electron-updater` lee esos Releases sin necesitar ningún token embebido, y actualiza la app sola cada vez que se abre.

### Publicar una nueva versión

1. Tener un GitHub token con permiso de escritura sobre el repo, exportado en la terminal:
   ```bash
   $env:GH_TOKEN="<token_con_permiso_repo>"    # PowerShell
   ```
2. Elegir el tipo de versión según [semver](https://semver.org/lang/es/) y correr:
   ```bash
   npm run release:patch   # fixes
   npm run release:minor   # features nuevos, compatibles
   npm run release:major   # cambios incompatibles
   ```
   Sube la versión en `package.json` (sin commit/tag local), compila, empaqueta y sube el instalador como Release con el tag `vX.Y.Z`.
3. El bump de versión queda sin commitear — commitealo tú cuando quieras.

**Nota de troubleshooting conocida**: `electron-builder` puede fallar con `EPERM: operation not permitted, rename ... win-unpacked.tmp -> win-unpacked` en Windows — es errático (no siempre Defender/OneDrive/indexado son la causa real). Si pasa: borrar `dist-electron/win-unpacked.tmp`, limpiar `%LOCALAPPDATA%\electron\Cache` y `%LOCALAPPDATA%\electron-builder\Cache\downloads`, reintentar; si persiste, correr la terminal como Administrador.

## Para levantar una copia completa del sistema

1. Clonar ambos repos (Backend y Frontend son remotos **separados**).
2. Backend: `npm install`, copiar `.env.example` → `.env` y completar (ver `../Backend/README.md`), `npm run dev`.
3. Frontend: `npm install`, copiar `.env.example` → `.env` apuntando a ese backend, `npm run dev`.
4. Restaurar los datos de MongoDB (`mongorestore` sobre un dump de `../scripts/backup.ps1`, o partir de una base vacía).
5. Copiar la carpeta `Backend/uploads/` si se quiere conservar imágenes/PDFs ya subidos (no versionada).
6. Para el módulo SUNAT (CPE/GRE): configurar `HUB_BASE_URL`/`HUB_API_KEY` de un hub SUNAT propio o compartido — sin esto, el resto del sistema funciona igual.
