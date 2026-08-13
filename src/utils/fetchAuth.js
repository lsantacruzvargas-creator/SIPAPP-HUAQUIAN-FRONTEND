const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BASE = API.replace(/\/api$/, "");

// El token y el usuario viven en sessionStorage (no localStorage) a propósito:
// sessionStorage se borra solo al cerrar la pestaña/ventana, así que el
// cliente siempre tiene que volver a loguearse en una sesión nueva. El tema
// y el timestamp de notificaciones sí siguen en localStorage — esas sí deben
// persistir entre sesiones.
export function getToken() {
  return sessionStorage.getItem("token");
}

export function getUsuario() {
  const u = sessionStorage.getItem("usuario");
  return u ? JSON.parse(u) : null;
}

export function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("usuario");
}

// /uploads exige auth (authMiddleware, igual que /api) pero vive fuera de
// /api — por eso no se puede reusar fetchAuth() tal cual (prependea /api).
// NUNCA pasar el token por query string: queda en logs del servidor,
// historial del navegador y se puede filtrar por Referer — por eso esto
// siempre manda el token por header, nunca en la URL. Como <img src>/
// <a href>/window.open() no pueden mandar headers, los consumidores de
// /uploads usan el componente ImagenProtegida o abrirArchivoProtegido()
// (ambos hacen el fetch acá y arman una Object URL de blob, nunca exponen
// la URL real con el token).
export const fetchUpload = (ruta) => {
  const token = getToken();
  return fetch(`${BASE}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
};

// Para "ver en pestaña nueva" (click en una miniatura, un PDF, etc.): trae el
// archivo con el header de auth y recién ahí genera una Object URL de un solo
// uso para pasarle al navegador — la URL real con el token nunca se expone.
export const abrirArchivoProtegido = async (ruta) => {
  const res = await fetchUpload(ruta);
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const uploadAuth = (endpoint, formData) => {
  const token = sessionStorage.getItem("token");
  return fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
};

const METODOS_ESCRITURA = ["POST", "PUT", "PATCH", "DELETE"];

export const fetchAuth = async (endpoint, options = {}) => {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    sessionStorage.clear();
    window.location.hash = "/login";
  }
  // Avisa al Navbar que hubo un guardado exitoso para que refresque la
  // campana de notificaciones al instante, sin esperar el polling de 60s.
  if (res.ok && METODOS_ESCRITURA.includes(options.method)) {
    window.dispatchEvent(new Event("app:cambio-guardado"));
  }
  return res;
};
