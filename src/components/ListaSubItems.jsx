import { useState } from "react";

const nuevoSubItem = () => ({ _subKey: Date.now() + Math.random(), texto: "" });

export default function ListaSubItems({ subItems, editable, onChange }) {
  const [arrastrando, setArrastrando] = useState(null);
  const [destino, setDestino] = useState(null);
  const [recienInsertado, setRecienInsertado] = useState(null);

  if (!subItems?.length) return null;

  const insertarDebajo = (idx) => {
    const nuevo = nuevoSubItem();
    setRecienInsertado(nuevo._subKey);
    onChange([...subItems.slice(0, idx + 1), nuevo, ...subItems.slice(idx + 1)]);
  };

  const mover = (desde, hasta) => {
    if (desde === hasta) return;
    const copia = [...subItems];
    const [movido] = copia.splice(desde, 1);
    copia.splice(hasta, 0, movido);
    onChange(copia);
  };

  const terminarArrastre = () => { setArrastrando(null); setDestino(null); };

  return (
    <ul className="mt-1.5 space-y-1">
      {subItems.map((sub, idx) => (
        <li key={sub._subKey}
          // El estado de arrastre es de esta lista: una fila de otro ítem nunca se acepta aquí.
          onDragOver={(e) => { if (arrastrando === null) return; e.preventDefault(); setDestino(idx); }}
          onDrop={(e) => { e.preventDefault(); if (arrastrando !== null) mover(arrastrando, idx); terminarArrastre(); }}
          className={`flex items-start gap-1.5 text-xs text-gray-600 rounded ${arrastrando === idx ? "opacity-40" : ""} ${destino === idx && arrastrando !== idx ? (arrastrando < idx ? "border-b-2" : "border-t-2") + " border-sky-400" : ""}`}>
          {editable ? (
            <>
              <span draggable title="Arrastrar para mover"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                  e.dataTransfer.setDragImage(e.currentTarget.parentElement, 0, 0);
                  setArrastrando(idx);
                }}
                onDragEnd={terminarArrastre}
                className="text-gray-300 hover:text-sky-500 cursor-grab active:cursor-grabbing select-none shrink-0 leading-5">⋮⋮</span>
              <input value={sub.texto} autoFocus={sub._subKey === recienInsertado}
                onChange={(e) => onChange(subItems.map((s) => (s._subKey === sub._subKey ? { ...s, texto: e.target.value } : s)))}
                className="flex-1 border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-300" />
              <button type="button" title="Insertar sub ítem debajo" onClick={() => insertarDebajo(idx)}
                className="text-gray-300 hover:text-sky-600 shrink-0 leading-5">+</button>
              <button type="button" title="Eliminar sub ítem" onClick={() => onChange(subItems.filter((s) => s._subKey !== sub._subKey))}
                className="text-gray-300 hover:text-red-500 shrink-0">✕</button>
            </>
          ) : (
            <>
              <span className="text-sky-400 shrink-0">•</span>
              <span className="flex-1">{sub.texto}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
