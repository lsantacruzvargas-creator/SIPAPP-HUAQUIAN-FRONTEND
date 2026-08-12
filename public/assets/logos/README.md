# Logos del membrete de Cotización

Archivos que usa `Frontend/src/utils/cotizacionPdf.js` para armar el
encabezado del PDF exportado:

- `Logo_grande-DESKTOP-3FJUSSF.png` — logo cuadrado (1:1), ícono globo+paloma
  con "ALCOINSAC" apilado debajo. Va en la esquina superior izquierda.
- `Logo_pequeño.png` — wordmark ancho (~4.46:1), "ALCOINSAC / ALPHA CONTROL E
  INGENIERIA S.A.C." horizontal. Va a la derecha del logo cuadrado.

No hace falta reiniciar nada: al estar en `public/`, Vite los sirve tal cual
en `/assets/logos/...`. Si algún archivo no está presente, la exportación de
PDF simplemente omite ese logo (no rompe la descarga).
