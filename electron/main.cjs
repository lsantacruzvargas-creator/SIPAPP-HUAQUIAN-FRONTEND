const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

autoUpdater.autoDownload = false;

// huaquian-sac.com (apex, sin "www") no tiene registro DNS configurado — solo
// resuelve el subdominio www. (verificado: apex da "Could not resolve host",
// www. responde 200 vía Cloudflare, mismo frontend que sipapp-huaquian-frontend.pages.dev).
const LOGIN_URL = "https://www.huaquian-sac.com/#/login";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  const startUrl = isDev ? "http://localhost:5173" : LOGIN_URL;

  // offline.html existía en el proyecto pero nunca se cargaba desde acá — si
  // el servidor no respondía (o, en producción, si LOGIN_URL todavía no
  // resuelve — ver el TODO de arriba) Electron mostraba su página de error
  // de red por defecto en vez de esta pantalla. -3 = ERR_ABORTED: se dispara
  // en navegaciones canceladas normales (cerrar la ventana, un redirect
  // intencional), no es un fallo real de conexión — se ignora.
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return;
    mainWindow.loadFile(path.join(__dirname, "offline.html"), {
      query: { retry: validatedURL || startUrl },
    });
  });

  mainWindow.loadURL(startUrl);

  // Cerrar sesión al cerrar la ventana. El JWT/usuario ya viven en
  // sessionStorage (se borra solo al destruirse el proceso), pero esto queda
  // como respaldo explícito — y limpia cualquier token viejo que haya
  // quedado en localStorage de una versión anterior de la app. Hay que
  // esperar a que el script termine ANTES de destruir la ventana: si no,
  // executeJavaScript queda corriendo en segundo plano y el proceso se
  // destruye antes de que el borrado realmente ocurra.
  let cerrandoConLimpieza = false;
  mainWindow.on("close", (e) => {
    if (cerrandoConLimpieza) return;
    e.preventDefault();
    mainWindow.webContents
      .executeJavaScript("sessionStorage.clear(); localStorage.removeItem('token'); localStorage.removeItem('usuario');")
      .catch(() => {})
      .finally(() => {
        cerrandoConLimpieza = true;
        mainWindow.close();
      });
  });
}

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  }
});

autoUpdater.on("update-available", (info) => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Actualización disponible",
    message: `Versión ${info.version} disponible.\n¿Descargar e instalar ahora?`,
    buttons: ["Descargar", "Más tarde"],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.downloadUpdate();
  });
});

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Lista para instalar",
    message: "La actualización se descargó correctamente.\nLa aplicación se reiniciará para instalar.",
    buttons: ["Reiniciar ahora"],
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater:", err.message);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
