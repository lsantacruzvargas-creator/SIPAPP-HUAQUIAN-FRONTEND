# Logos del membrete de Cotización

Extraídos de `Plantilla-cotizacion.xlsx` (raíz del proyecto), la plantilla
oficial de cotización de Huaquian. Usados por
`Frontend/src/utils/cotizacionPdf.js`:

- `huaquian_icon.png` — ícono chip + wordmark "HUAQUIAN" apilado (1:1, azul
  marino). Marca de agua centrada y esquina del encabezado.
- `huaquian_header.png` — banner ancho (13:1) "HUAQUIAN | In partnership
  with SIEMENS", fondo azul marino. Franja superior de cada PDF.
- `marcas_footer.png` — grid de marcas representadas (SEW Eurodrive, Lenze,
  Siemens, ABB, Parker, Allen-Bradley, Baumüller, Emerson, Rexroth) + lema
  "ESPECIALISTAS EN MANTENIMIENTO...". Pie de página.
- `bcp_logo.png` / `banco_nacion_logo.png` — logos de los bancos, junto a
  los números de cuenta en la sección "MÉTODO DE PAGO".

`logo_huaquian.jpg` y `logo_sip.png` son variantes usadas en otras partes
de la UI (no en el PDF de cotización).

No hace falta reiniciar nada: al estar en `public/`, Vite los sirve tal
cual en `/assets/logos/...`. Si algún archivo no está presente, la
exportación de PDF simplemente omite ese logo (no rompe la descarga).
