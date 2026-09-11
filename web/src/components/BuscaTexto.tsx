"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Sugestao } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { Casa, Fechar, Lupa, Pino } from "./Icones";

interface Props {
  valor: string;
  aoMudar: (texto: string) => void;
  aoEscolher: (s: Sugestao) => void;
  aoSubmeter: () => void;
}

const ROTULO: Record<Sugestao["tipo"], string> = {
  bairro: "Bairro",
  cidade: "Cidade",
  tipo: "Tipo",
  imob: "Imobiliária",
  codigo: "Código",
  texto: "Buscar",
};

export default function BuscaTexto({ valor, aoMudar, aoEscolher, aoSubmeter }: Props) {
  const [itens, setItens] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const idLista = useId();

  // Sugestões enquanto digita.
  useEffect(() => {
    const q = valor.trim();
    if (q.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/sugestoes?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { sugestoes: Sugestao[] }) => {
          setItens(d.sugestoes);
          setIndice(-1);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [valor]);

  // "/" foca a busca de qualquer lugar da página; clique fora fecha.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    window.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fora);
    return () => {
      window.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fora);
    };
  }, []);

  const visiveis = aberto && valor.trim().length >= 2 ? itens : [];
  const escolher = (s: Sugestao) => {
    setAberto(false);
    aoEscolher(s);
  };

  return (
    <div ref={caixa} className="relative flex-1">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 shadow-sm transition focus-within:border-accent focus-within:shadow-md">
        <Lupa className="shrink-0 text-muted" />
        <input
          ref={input}
          type="search"
          value={valor}
          onChange={(e) => {
            aoMudar(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && visiveis.length) {
              e.preventDefault();
              setIndice((i) => (i + 1) % visiveis.length);
            } else if (e.key === "ArrowUp" && visiveis.length) {
              e.preventDefault();
              setIndice((i) => (i - 1 + visiveis.length) % visiveis.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (indice >= 0 && visiveis[indice]) escolher(visiveis[indice]);
              else {
                setAberto(false);
                aoSubmeter();
              }
            } else if (e.key === "Escape") {
              setAberto(false);
              if (!valor) input.current?.blur();
            }
          }}
          role="combobox"
          aria-expanded={visiveis.length > 0}
          aria-controls={idLista}
          aria-autocomplete="list"
          placeholder="Bairro, cidade, código do anúncio ou palavras da descrição…"
          className="w-full bg-transparent py-2.5 outline-none"
          aria-label="Buscar imóveis"
        />
        {valor ? (
          <button type="button" onClick={() => { aoMudar(""); input.current?.focus(); }} aria-label="Limpar busca" className="text-muted hover:text-fg">
            <Fechar />
          </button>
        ) : (
          <kbd className="hidden rounded border border-line px-1.5 text-[11px] text-muted sm:inline">/</kbd>
        )}
      </label>

      {visiveis.length > 0 && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl"
        >
          {visiveis.map((s, k) => (
            <li
              key={`${s.tipo}:${s.chave}`}
              role="option"
              aria-selected={k === indice}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(s)}
              onMouseEnter={() => setIndice(k)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${k === indice ? "bg-soft" : ""}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                {s.tipo === "bairro" || s.tipo === "cidade" ? <Pino width={14} height={14} /> : s.tipo === "codigo" ? <span className="text-[10px] font-bold">#</span> : <Casa width={14} height={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.nome}</span>
                <span className="block truncate text-xs text-muted">
                  {ROTULO[s.tipo]}
                  {s.detalhe ? ` · ${s.detalhe}` : ""}
                </span>
              </span>
              {s.n != null && <span className="text-xs tabular-nums text-muted">{fmtNum(s.n)}</span>}
            </li>
          ))}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setAberto(false); aoSubmeter(); }}
            className="flex cursor-pointer items-center gap-3 border-t border-line px-3 py-2 text-sm text-muted hover:bg-soft"
          >
            <Lupa width={14} height={14} /> Buscar “{valor.trim()}” nas descrições
          </li>
        </ul>
      )}
    </div>
  );
}
