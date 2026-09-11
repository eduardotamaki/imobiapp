"use client";
import { useState } from "react";
import Foto from "@/components/Foto";
import { cls } from "./ui";

interface Props {
  iniciais: string[];
  capaInicial: string | null;
}

/**
 * Lista de fotos por URL: colar várias de uma vez, reordenar, escolher a capa.
 * O formulário recebe `fotos` (uma URL por linha) e `foto_capa`.
 */
export default function EditorFotos({ iniciais, capaInicial }: Props) {
  const [fotos, setFotos] = useState<string[]>(iniciais);
  const [capa, setCapa] = useState<string | null>(capaInicial ?? iniciais[0] ?? null);
  const [novo, setNovo] = useState("");

  const adicionar = () => {
    const urls = novo
      .split(/\s+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\/\S+$/i.test(u) && !fotos.includes(u));
    if (!urls.length) return;
    const lista = [...fotos, ...urls].slice(0, 60);
    setFotos(lista);
    if (!capa) setCapa(lista[0]);
    setNovo("");
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= fotos.length) return;
    const l = [...fotos];
    [l[i], l[j]] = [l[j], l[i]];
    setFotos(l);
  };
  const remover = (i: number) => {
    const l = fotos.filter((_, k) => k !== i);
    setFotos(l);
    if (capa === fotos[i]) setCapa(l[0] ?? null);
  };

  return (
    <div>
      <input type="hidden" name="fotos" value={fotos.join("\n")} />
      <input type="hidden" name="foto_capa" value={capa ?? ""} />
      {fotos.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((u, i) => (
            <li key={u} className={`group relative overflow-hidden rounded-lg border ${capa === u ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
              <Foto src={u} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {capa === u && <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">capa</span>}
              <div className="flex items-center justify-between gap-1 bg-card px-1.5 py-1 text-[11px]">
                <button type="button" onClick={() => setCapa(u)} className="text-muted hover:text-fg" disabled={capa === u}>
                  {capa === u ? "é a capa" : "usar como capa"}
                </button>
                <span className="flex gap-1">
                  <button type="button" onClick={() => mover(i, -1)} className="rounded px-1 hover:bg-soft" aria-label="Mover para antes" disabled={i === 0}>←</button>
                  <button type="button" onClick={() => mover(i, 1)} className="rounded px-1 hover:bg-soft" aria-label="Mover para depois" disabled={i === fotos.length - 1}>→</button>
                  <button type="button" onClick={() => remover(i)} className="rounded px-1 text-red-600 hover:bg-soft" aria-label="Remover foto">✕</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">Nenhuma foto. Cole os links abaixo.</p>
      )}
      <div className="mt-2 flex gap-2">
        <textarea
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          placeholder="Cole um ou mais links de imagem (https://…), um por linha"
          rows={2}
          className={`${cls.input} font-mono text-xs`}
        />
        <button type="button" onClick={adicionar} className={`${cls.botao} ${cls.secundario} self-start`}>Adicionar</button>
      </div>
      <p className="mt-1 text-xs text-muted">As fotos ficam hospedadas onde já estão (site da imobiliária, Google Drive público, etc.). Até 60 por anúncio; a primeira exibida é a capa.</p>
    </div>
  );
}
