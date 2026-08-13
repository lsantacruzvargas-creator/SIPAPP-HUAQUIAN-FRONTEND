import { createContext, useContext, useState, useEffect } from "react";

const SidebarContext = createContext(null);
const COLAPSADO_KEY = "sidebarColapsado";

function colapsadoInicial() {
  return localStorage.getItem(COLAPSADO_KEY) === "1";
}

export function SidebarProvider({ children }) {
  const [colapsado, setColapsado] = useState(colapsadoInicial);

  useEffect(() => {
    localStorage.setItem(COLAPSADO_KEY, colapsado ? "1" : "0");
  }, [colapsado]);

  return (
    <SidebarContext.Provider value={{ colapsado, setColapsado }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>");
  return ctx;
}
