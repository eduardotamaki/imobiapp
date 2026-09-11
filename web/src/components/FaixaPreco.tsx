"use client";
import { useEffect, useRef, useState } from "react";
import type { Histograma } from "@/lib/types";
import { fmtPrecoCurto } from "@/lib/format";

interface Props {
  histograma: Histograma;
  pmin: number | null;
  pmax: number | null;
  aoAplicar: (pmin: number | null, pmax: number | null) => void;
}

function indiceMin(limites: number[], v: number | null): number {
  if (v == null) return 0;
  let k = 0;
  for (let i = 0; i < limites.length; i++) if (limites[i] <= v) k = i;
  return k;
}
function indiceMax(limites: number[], v: number | null): number {
  const n = limites.length - 1;
  if (v == null) return n;
  for (let i = 0; i <= n; i++) if (limites[i] >= v) return i;
  return n;
}

/** Histograma de preços com dois cursores em escala logarítmica ("redonda"). */
export default function FaixaPreco({ histograma: h, pmin, pmax, aoAplicar }: Props) {
  const { limites, contagens } = h;
  const n = limites.length - 1;
  const [a, setA] = useState(() => indiceMin(limites, pmin));
  const [b, setB] = useState(() => indiceMax(limites, pmax));
  const chaveExterna = `${limites.join(",")}|${pmin}|${pmax}`;
  const [chaveAnterior, setChaveAnterior] = useState(chaveExterna);
  if (chaveExterna !== chaveAnterior) {
    setChaveAnterior(chaveExterna);
    setA(indiceMin(limites, pmin));
    setB(indiceMax(limites, pmax));
  }
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pendente.current) clearTimeout(pendente.current); }, []);

  if (n < 1) return null;

  const agenda = (na: number, nb: number) => {
    if (pendente.current) clearTimeout(pendente.current);
    pendente.current = setTimeout(() => {
      const novoMin = na <= 0 ? null : limites[na];
      const novoMax = nb >= n ? null : limites[nb];
      if (novoMin !== pmin || novoMax !== pmax) aoAplicar(novoMin, novoMax);
    }, 350);
  };
  const mudaA = (v: number) => {
    const na = Math.min(v, b - 1);
    setA(na);
    agenda(na, b);
  };
  const mudaB = (v: number) => {
    const nb = Math.max(v, a + 1);
    setB(nb);
    agenda(a, nb);
  };
  const maxC = Math.max(...contagens, 1);

  return (
    <div>
      <div className="flex h-14 items-end gap-px px-2" aria-hidden>
        {contagens.map((c, k) => (
          <div
            key={k}
            title={`${fmtPrecoCurto(limites[k])} – ${fmtPrecoCurto(limites[k + 1])}: ${c}`}
            className={`flex-1 rounded-t-sm transition-colors ${k >= a && k < b ? "bg-accent" : "bg-line"}`}
            style={{ height: `${Math.max(3, Math.sqrt(c / maxC) * 100)}%` }}
          />
        ))}
      </div>
      <div className="faixa px-2">
        <div className="trilho">
          <div style={{ left: `${(a / n) * 100}%`, right: `${100 - (b / n) * 100}%` }} />
        </div>
        <input type="range" min={0} max={n} step={1} value={a} onChange={(e) => mudaA(Number(e.target.value))} aria-label="Preço mínimo" />
        <input type="range" min={0} max={n} step={1} value={b} onChange={(e) => mudaB(Number(e.target.value))} aria-label="Preço máximo" />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{a <= 0 ? "sem mínimo" : fmtPrecoCurto(limites[a])}</span>
        <span>{b >= n ? "sem máximo" : fmtPrecoCurto(limites[b])}</span>
      </div>
    </div>
  );
}
