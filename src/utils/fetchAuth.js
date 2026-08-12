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

export const imgUrl = (ruta) => `${BASE}${ruta}`;

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
