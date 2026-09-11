"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CardImovel from "@/components/CardImovel";
import { useFavoritos } from "@/lib/favoritos";
import { limpaRecentes, useRecentes } from "@/lib/recentes";
import { fmtArea, fmtM2, fmtPreco, rotuloTipo } from "@/lib/format";
import type { Imovel } from "@/lib/types";

function Recentes({ excluir }: { excluir: number[] }) {
  const recentes = useRecentes();
  const ids = recentes.filter((id) => !excluir.includes(id)).slice(0, 8);
  const chave = ids.join(",");
  const [dados, setDados] = useState<{ chave: string; itens: Imovel[] } | null>(null);
  useEffect(() => {
    if (!chave) return;
    const ctl = new AbortController();
    fetch(`/api/imoveis?ids=${chave}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d: { itens: Imovel[] }) => setDados({ chave, itens: d.itens }))
      .catch(() => {});
    return () => ctl.abort();
  }, [chave]);
  if (!chave) return null;
  const itens = dados?.chave === chave ? dados.itens : null;
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Vistos recentemente</h2>
        <button type="button" onClick={limpaRecentes} className="text-xs text-muted hover:text-fg">limpar</button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {itens ? itens.map((i, k) => <CardImovel key={i.id} imovel={i} fin="todos" indice={k} />) : ids.map((id) => <div key={id} className="esqueleto aspect-[4/5] rounded-xl" />)}
      </div>
    </section>
  );
}

export default function Favoritos() {
  const { ids, remover, limpar } = useFavoritos();
  const [dados, setDados] = useState<{ chave: string; itens: Imovel[] } | null>(null);
  const chave = ids.join(",");
  const itens: Imovel[] | null = !chave ? [] : dados?.chave === chave ? dados.itens : null;

  useEffect(() => {
    if (!chave) return;
    const ctl = new AbortController();
    fetch(`/api/imoveis?ids=${chave}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d: { itens: Imovel[] }) => setDados({ chave, itens: d.itens }))
      .catch(() => {});
    return () => ctl.abort();
  }, [chave]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Favoritos</h1>
          <p className="text-sm text-muted">Guardados neste navegador. Compare lado a lado antes de ligar para a imobiliária.</p>
        </div>
        {ids.length > 0 && (
          <button type="button" onClick={limpar} className="text-sm text-muted hover:text-fg">Limpar lista</button>
        )}
      </div>

      {itens === null ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map((id) => <div key={id} className="esqueleto aspect-[4/5] rounded-xl" />)}
        </div>
      ) : itens.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">Nenhum favorito ainda.</p>
          <p className="mt-1 text-sm text-muted">Clique no coração de um imóvel para guardá-lo aqui.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">Ir para a busca</Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {itens.map((i, k) => <CardImovel key={i.id} imovel={i} fin="todos" indice={k} />)}
          </div>

          <section className="mt-8 rounded-xl border border-line bg-card p-4">
            <h2 className="text-lg font-semibold">Comparação</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-1 font-medium">Imóvel</th>
                    <th className="pb-1 text-right font-medium">Preço</th>
                    <th className="pb-1 text-right font-medium">R$/m²</th>
                    <th className="pb-1 text-right font-medium">Área</th>
                    <th className="pb-1 text-right font-medium">Quartos</th>
                    <th className="pb-1 text-right font-medium">Vagas</th>
                    <th className="pb-1 font-medium">Bairro</th>
                    <th className="pb-1 font-medium">Imobiliária</th>
                    <th className="pb-1" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.id} className={`border-t border-line ${i.status !== "disponivel" ? "opacity-60" : ""}`}>
                      <td className="py-1.5"><Link href={`/imovel/${i.id}`} className="hover:text-accent">{rotuloTipo(i.tipo)}{i.titulo ? ` · ${i.titulo.slice(0, 40)}${i.titulo.length > 40 ? "…" : ""}` : ""}</Link>{i.status !== "disponivel" && <span className="ml-1 text-xs text-muted">(saiu do ar)</span>}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtPreco(i.preco ?? i.preco_aluguel)}{i.preco == null && i.preco_aluguel != null ? "/mês" : ""}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted">{fmtM2(i.preco_m2 ?? i.aluguel_m2)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtArea(i.area)}</td>
                      <td className="py-1.5 text-right tabular-nums">{i.quartos ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{i.vagas ?? "—"}</td>
                      <td className="py-1.5">{i.bairro ?? "—"}</td>
                      <td className="py-1.5 text-muted">{i.imobiliaria}</td>
                      <td className="py-1.5 text-right"><button type="button" onClick={() => remover(i.id)} className="text-xs text-muted hover:text-rose-500">remover</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <Recentes excluir={ids} />
    </div>
  );
}
