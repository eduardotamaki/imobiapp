"use client";
import { useState } from "react";
import { cls } from "./ui";

interface Props {
  nome: string;
  iniciais: string[];
  sugestoes: string[];
}

/** Características como etiquetas; envia `nome` com uma por linha. */
export default function EditorTags({ nome, iniciais, sugestoes }: Props) {
  const [tags, setTags] = useState<string[]>(iniciais);
  const [texto, setTexto] = useState("");
  const add = (t: string) => {
    const s = t.trim().slice(0, 60);
    if (s && !tags.some((x) => x.toLowerCase() === s.toLowerCase())) setTags([...tags, s]);
    setTexto("");
  };
  const faltam = sugestoes.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 18);
  return (
    <div>
      <input type="hidden" name={nome} value={tags.join("\n")} />
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-sm">
            {t}
            <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted hover:text-fg" aria-label={`Remover ${t}`}>✕</button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === ",") {
              ev.preventDefault();
              add(texto);
            } else if (ev.key === "Backspace" && !texto && tags.length) setTags(tags.slice(0, -1));
          }}
          onBlur={() => texto && add(texto)}
          placeholder="Digite e aperte Enter"
          className="min-w-40 flex-1 rounded-full border border-dashed border-line bg-transparent px-3 py-1 text-sm outline-none focus:border-accent"
        />
      </div>
      {faltam.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-xs text-muted">Sugestões:</span>
          {faltam.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full bg-soft px-2 py-0.5 text-xs text-muted hover:text-fg">
              + {s}
            </button>
          ))}
        </div>
      )}
      <span className={`${cls.rotulo} sr-only`}>Características</span>
    </div>
  );
}
