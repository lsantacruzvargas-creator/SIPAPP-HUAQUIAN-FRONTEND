import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

// La rueda del mouse sobre un <input type="number"> enfocado cambia su valor (montos, cantidades)
// sin que el usuario lo note: se quita el foco antes de que el navegador lo aplique.
document.addEventListener("wheel", (e) => {
  const el = document.activeElement;
  if (el === e.target && el.tagName === "INPUT" && el.type === "number") el.blur();
}, { passive: true, capture: true });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);

// Requisito de Chrome/Android para considerar el sitio instalable como app
// (ver public/sw.js) — no aplica dentro del wrapper de Electron.
if ("serviceWorker" in navigator && !navigator.userAgent.toLowerCase().includes("electron")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
