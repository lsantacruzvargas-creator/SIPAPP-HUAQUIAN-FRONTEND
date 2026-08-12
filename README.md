# SIP App Alcoinsac — Frontend

ERP de Alcoinsac, empresa dedicada a la reparación de motores y mantenimiento. React 19 + Vite + Tailwind CSS v4 + React Router (HashRouter). Empaquetable como app de escritorio con Electron.

## Requisitos

- Node.js 18+
- Backend corriendo (ver `../Backend/README.md`)

## Instalación

```bash
npm install
```

## Scripts

```bash
npm run dev             # servidor de desarrollo (Vite)
npm run build            # build de producción → dist/
npm run preview          # sirve el build de dist/ localmente
npm run lint              # ESLint
npm run electron:dev      # app de escritorio en modo desarrollo
npm run electron:build    # empaqueta instalador de escritorio (NSIS, dist-electron/)
```

## Configuración

La URL del backend se resuelve vía la variable de entorno `VITE_API_URL`
(build-time, Vite) en `src/utils/fetchAuth.js`, con fallback a
`http://localhost:5000/api` si no está definida. Para apuntar a producción,
crear un `.env` en `Frontend/` con `VITE_API_URL=https://api.alcoin-sac.com/api`
antes de compilar.

## Estructura

```
src/
  components/   # componentes reutilizables (modales, navbar, vistas de detalle)
  pages/        # una página por ruta
  utils/        # fetchAuth (JWT desde localStorage + helper de fetch)
  App.jsx        # definición de rutas (HashRouter)
```

## Páginas / módulos

| Página                     | Descripción                                  |
|-----------------------------|-----------------------------------------------|
| `Login`                      | Autenticación                                 |
| `Dashboard`                   | Panel general (rol admin/vendedor)            |
| `Empresas`                    | Empresas cliente + plantas + contactos        |
| `ListaCotizaciones`           | Presupuestos — filtros + selector de vista (Pendientes de OC / Con OC / Cerradas / Sin OT / Todas), crear cotización "en frío" (`ModalNuevaCotizacion`) o desde una OT |
| `ListaOrdenesTrabajo`          | Órdenes de Trabajo — filtros, columna Estado con chip de color |
| `IngresoEquipos`               | Ingreso de equipos a taller                   |
| `ListaOrdenesCompra`            | Órdenes de Compra (crear, editar, importar Excel) |
| `ListaFacturas`                  | Facturas (crear, editar, importar Excel)      |
| `Almacen`                         | Stock, materiales, movimientos                |
| `Usuarios`                         | Gestión de usuarios (rol admin)               |

## Autenticación y roles

JWT almacenado en `localStorage`. `src/utils/fetchAuth.js` adjunta el token en cada request y expone `getUsuario()`/`logout()`. La navbar y las rutas se muestran/ocultan según el rol: `admin`, `vendedor`, `tecnico`, `almacenero`.

## Temas

Selector Claro / Oscuro / Sepia en la Navbar (3 botones), persistido en
`localStorage` y aplicado vía atributo `data-theme` en `<html>` + variables
CSS definidas en `src/index.css`.

## Cotizaciones — ítems y PDF

- `TablaItemsCotizacion.jsx` (compartida entre `DetalleCotizacion.jsx` y
  `ModalNuevaCotizacion.jsx`): tabla de ítems con dos formas de agregar
  filas — manual (descripción libre) o desde el catálogo de servicios
  (`SelectorCatalogoServicios.jsx`, trae los grupos/ítems desde
  `GET /catalogo-servicios`; gestión de altas/bajas en `/catalogo-servicios`,
  admin y asistente), grupos padre en negrita + sub-ítems anidados. Sobre
  tipo "servicio", permite seleccionar varios ítems y generar una Orden de
  Trabajo por cada uno (`+ Generar OT de N ítems`).
- `src/utils/cotizacionPdf.js`: exporta a PDF con jsPDF + jspdf-autotable —
  membrete con logos (`public/assets/logos/`), marca de agua centrada,
  tabla de ítems (negrita en descripciones padre, oculta valores en 0.00),
  bloque de condiciones comerciales, y fila de logos de marcas
  representadas al pie.

## Convenciones de UI

- Formularios: un solo `useState` por formulario + `handleChange` genérico.
- Precios/montos traídos de la API son siempre `readOnly`.
- Vistas de detalle a pantalla completa (`DetalleCotizacion`,
  `DetalleOrdenTrabajo`, `DetalleOrdenCompra`, `DetalleFactura`) navegan
  entre sí reemplazando el estado en `DetalleDocumento.jsx` (sin anidar
  overlays); el panel "Relaciones" soporta relaciones 1:N (ej. varias OT
  bajo una misma Cotización), no solo 1:1.
- Componentes compartidos de detalle (`TarjetaRelacion`, `FlujoNegocio`,
  `Chip`, `DotChip`, `money()`, helpers `badge*/dot*`) viven en
  `src/components/detalleShared.jsx`.
- Páginas de lista con varias categorías (pendientes/cerradas/etc.) usan un
  selector de "vista" para mostrar una tabla a la vez (más la opción
  "Todas las tablas"), en vez de apilarlas siempre visibles.
- Import/Export Excel vía librería `xlsx` (`ModalImportarExcel.jsx`, botones "Exportar/Importar Excel" en las tablas).

## Build de escritorio (Electron)

```bash
npm run electron:build
```

Genera el instalador en `dist-electron/` (configuración en `package.json` → `build`), sin publicarlo.

## Releases en GitHub + auto-actualización

La app se distribuye publicando instaladores en los **Releases** del repo público
`lsantacruzvargas-creator/SIPAPP-ALCOINSAC-FRONTEND`. Al ser público, `electron-updater`
lee esos Releases sin necesitar ningún token embebido, y actualiza la app sola cada
vez que se abre.

### Publicar una nueva versión

1. Tener un GitHub token con permiso de escritura sobre el repo (solo se necesita
   para *publicar*, no para que los clientes se actualicen), exportado en la
   terminal antes de correr el comando:
   ```bash
   set GH_TOKEN=<token_con_permiso_repo>       # cmd
   $env:GH_TOKEN="<token_con_permiso_repo>"    # PowerShell
   ```
2. Elegir el tipo de versión según [semver](https://semver.org/lang/es/)
   (`MAJOR.MINOR.PATCH`) y correr uno de estos comandos:
   ```bash
   npm run release:patch   # 1.0.2 → 1.0.3  (fixes)
   npm run release:minor   # 1.0.2 → 1.1.0  (features nuevos, compatibles)
   npm run release:major   # 1.0.2 → 2.0.0  (cambios incompatibles)
   ```
   Cada uno sube el número de versión en `package.json` (sin tocar git — no crea
   commit ni tag local) y encadena `electron:release`: compila, empaqueta y sube el
   instalador como un nuevo Release en GitHub con el tag `vX.Y.Z` correspondiente.
3. El bump de versión queda como cambio sin commitear en `package.json` /
   `package-lock.json` — commitealo tú cuando quieras (`git add` + `git commit`),
   igual que cualquier otro cambio.

### Primer lanzamiento (checklist)

1. `npm run release:patch` (con `GH_TOKEN` exportado) — crea el primer Release.
2. Verificar en GitHub → Releases que el instalador (`.exe`) y los archivos
   `latest.yml`/`app-update.yml` quedaron adjuntos (electron-builder los sube solos).
3. Instalar ese `.exe` en una PC de prueba.
4. Subir la versión en `package.json`, volver a correr `npm run electron:release`.
5. Abrir la app ya instalada en la PC de prueba: debe detectar la nueva versión y
   actualizarse sola (revisa al arrancar, vía `autoUpdater.checkForUpdatesAndNotify()`
   en `electron/main.cjs`).
