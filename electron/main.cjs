const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

autoUpdater.autoDownload = false;

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
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadURL("https://alcoin-sac.com/#/login");
  }

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
