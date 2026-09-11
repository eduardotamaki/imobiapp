"use client";
import { useCallback, useEffect, useState } from "react";
import Foto from "./Foto";
import { Fechar, Seta } from "./Icones";

export default function Galeria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [i, setI] = useState(0);
  const [aberta, setAberta] = useState(false);
  const n = fotos.length;
  const ir = useCallback((d: number) => setI((x) => (n ? (x + d + n) % n : 0)), [n]);
  const abrir = (k: number) => {
    setI(k);
    setAberta(true);
  };

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [aberta, ir]);

  if (!n) {
    return <Foto src={null} alt={titulo} className="aspect-[16/10] w-full rounded-xl" />;
  }

  const botao = "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70";
  const mosaico = n >= 3;

  return (
    <div>
      {/* Mosaico no desktop (1 grande + 4 menores); carrossel simples abaixo de md. */}
      {mosaico && (
        <div className="hidden h-[420px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl md:grid">
          {fotos.slice(0, 5).map((f, k) => (
            <button
              key={f + k}
              type="button"
              onClick={() => abrir(k)}
              className={`group relative overflow-hidden bg-soft ${k === 0 ? "col-span-2 row-span-2" : ""}`}
              aria-label={`Abrir foto ${k + 1}`}
            >
              <Foto src={f} alt={`${titulo} – foto ${k + 1}`} prioridade={k === 0} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              {k === 4 && n > 5 && (
                <span className="absolute inset-0 grid place-items-center bg-black/45 text-lg font-semibold text-white">+{n - 5} fotos</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className={`relative overflow-hidden rounded-xl bg-soft ${mosaico ? "md:hidden" : ""}`}>
        <button type="button" onClick={() => abrir(i)} className="block w-full cursor-zoom-in" aria-label="Ampliar foto">
          <Foto key={fotos[i]} src={fotos[i]} alt={`${titulo} – foto ${i + 1}`} className="aspect-[16/10] w-full object-cover" prioridade />
        </button>
        {n > 1 && (
          <>
            <button type="button" onClick={() => ir(-1)} className={`${botao} left-2`} aria-label="Foto anterior">
              <Seta className="rotate-180" />
            </button>
            <button type="button" onClick={() => ir(1)} className={`${botao} right-2`} aria-label="Próxima foto">
              <Seta />
            </button>
            <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className={`rolagem mt-2 flex gap-2 overflow-x-auto pb-1 ${mosaico ? "md:hidden" : ""}`}>
          {fotos.map((f, k) => (
            <button
              key={f + k}
              type="button"
              onClick={() => setI(k)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${k === i ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}
              aria-label={`Foto ${k + 1}`}
            >
              <Foto src={f} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {aberta && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label="Galeria ampliada" onClick={() => setAberta(false)}>
          <button type="button" onClick={() => setAberta(false)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Fechar">
            <Fechar width={20} height={20} />
          </button>
          {n > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); ir(-1); }} className={`${botao} left-4`} aria-label="Foto anterior">
                <Seta className="rotate-180" width={22} height={22} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); ir(1); }} className={`${botao} right-4`} aria-label="Próxima foto">
                <Seta width={22} height={22} />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotos[i]} alt={`${titulo} – foto ${i + 1}`} referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] max-w-[94vw] object-contain" />
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {i + 1} / {n}
          </span>
          <div className="rolagem absolute bottom-10 left-1/2 hidden max-w-[90vw] -translate-x-1/2 gap-1.5 overflow-x-auto md:flex" onClick={(e) => e.stopPropagation()}>
            {fotos.map((f, k) => (
              <button key={f + k} type="button" onClick={() => setI(k)} className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 ${k === i ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`} aria-label={`Foto ${k + 1}`}>
                <Foto src={f} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
