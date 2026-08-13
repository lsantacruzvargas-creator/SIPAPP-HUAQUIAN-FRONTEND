import { useState, useEffect } from "react";
import { fetchUpload } from "../utils/fetchAuth";

// <img> autenticado contra /uploads sin exponer el token en la URL (ni en
// logs del servidor ni en el historial del navegador): trae el archivo con
// fetchUpload() (header Authorization) y renderiza una Object URL de blob
// como src. La Object URL se revoca al desmontar / cambiar de imagen.
export default function ImagenProtegida({ src, alt = "", className, onClick }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    let cancelado = false;
    let url;
    fetchUpload(src)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelado || !blob) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      });
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (!blobUrl) return <div className={`${className} bg-gray-100 animate-pulse`} />;
  return <img src={blobUrl} alt={alt} className={className} onClick={onClick} />;
}
