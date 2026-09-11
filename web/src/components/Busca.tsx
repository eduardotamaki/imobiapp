"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Filtros as F, Ponto, Resultado, Sugestao } from "@/lib/types";
import { fmtM2, fmtNum, fmtPreco, ORDENS, rotuloTipo } from "@/lib/format";
import BuscaTexto from "./BuscaTexto";
import CardImovel from "./CardImovel";
import Filtros from "./Filtros";
import Paginacao from "./Paginacao";
import { Baixar, Fechar, Filtro, Grade, Lista, Mapa } from "./Icones";
import type { Bbox } from "./MapaLeaflet";

const MapaLeaflet = dynamic(() => import("./MapaLeaflet"), {
  ssr: false,
  loading: () => <div className="esqueleto h-full w-full" />,
});

interface Props {
  filtros: F;
  resultado: Resultado;
  pontos: Ponto[] | null;
}

const ATALHOS: { rotulo: string; qs: string }[] = [
  { rotulo: "Casas até R$ 500 mil", qs: "tipo=casa&pmax=500000" },
  { rotulo: "Apartamentos no Centro", qs: "tipo=apartamento&bairro=centro" },
  { rotulo: "3+ quartos com vaga", qs: "quartos=3&vagas=1" },
  { rotulo: "Terrenos", qs: "tipo=terreno" },
  { rotulo: "Chácaras e sítios", qs: "tipo=chacara" },
  { rotulo: "Abaixo da mediana do bairro", qs: "oportunidade=1&ordem=oportunidade" },
  { rotulo: "Baixaram de preço", qs: "fin=todos&baixou=1&ordem=baixou" },
  { rotulo: "Alugar até R$ 1.500", qs: "fin=aluguel&pmax=1500" },
];

function contaAtivos(f: F): number {
  let n = f.tipo.length + f.cidade.length + f.bairro.length + f.imob.length;
  for (const v of [f.pmin, f.pmax, f.quartos, f.suites, f.banheiros, f.vagas, f.amin, f.amax]) if (v != null) n++;
  for (const b of [f.foto, f.comPreco, f.baixou, f.novos, f.removidos, f.oportunidade, !!f.bbox]) if (b) n++;
  return n;
}

export default function Busca({ filtros: f, resultado: r, pontos }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, startTransition] = useTransition();
  const [gaveta, setGaveta] = useState(false);
  const [texto, setTexto] = useState(f.q);
  const [qAnterior, setQAnterior] = useState(f.q);
  const [destacado, setDestacado] = useState<number | null>(null);
  const [seguirMapa, setSeguirMapa] = useState(true);
  const topo = useRef<HTMLDivElement>(null);
  if (f.q !== qAnterior) {
    setQAnterior(f.q);
    setTexto(f.q);
  }

  const navegar = useCallback(
    (p: URLSearchParams) => {
      const qs = p.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname],
  );

  const atualizar = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      if (!("pagina" in patch)) p.delete("pagina");
      navegar(p);
    },
    [sp, navegar],
  );

  const limpar = useCallback(() => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.fin !== "venda") p.set("fin", f.fin);
    if (f.vista !== "grade") p.set("vista", f.vista);
    navegar(p);
  }, [f.q, f.fin, f.vista, navegar]);

  // Busca por texto com pequeno atraso, sem apagar o que o usuário digita.
  const aplicarTexto = useCallback(() => {
    if (texto.trim() !== f.q) atualizar({ q: texto.trim() || null });
  }, [texto, f.q, atualizar]);
  useEffect(() => {
    if (texto.trim() === f.q) return;
    const t = setTimeout(aplicarTexto, 400);
    return () => clearTimeout(t);
  }, [texto, f.q, aplicarTexto]);

  // Sugestão escolhida vira filtro estruturado (bairro, cidade…), não texto.
  const escolherSugestao = (s: Sugestao) => {
    const adiciona = (lista: string[], v: string) => (lista.includes(v) ? lista : [...lista, v]).join(",");
    setTexto("");
    switch (s.tipo) {
      case "bairro":
        atualizar({ q: null, bairro: adiciona(f.bairro, s.chave) });
        break;
      case "cidade":
        atualizar({ q: null, cidade: adiciona(f.cidade, s.chave) });
        break;
      case "tipo":
        atualizar({ q: null, tipo: adiciona(f.tipo, s.chave) });
        break;
      case "imob":
        atualizar({ q: null, imob: adiciona(f.imob, s.chave) });
        break;
      case "codigo":
        router.push(`/imovel/${s.chave}`);
        break;
      default:
        setTexto(s.nome);
        atualizar({ q: s.nome });
    }
  };

  const irPara = (p: number) => {
    atualizar({ pagina: p > 1 ? String(p) : null });
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const aoMoverMapa = useCallback(
    (b: Bbox) => {
      if (!seguirMapa) return;
      atualizar({ bbox: b.map((x) => x.toFixed(5)).join(",") });
    },
    [seguirMapa, atualizar],
  );
  const aoClicarMarcador = (id: number) => {
    setDestacado(id);
    document.getElementById(`imovel-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const ativos = contaAtivos(f);
  const chips = useMemo(() => {
    const nome = (lista: { chave: string; nome: string }[], chave: string) => lista.find((x) => x.chave === chave)?.nome ?? chave;
    const c: { rotulo: string; remover: Record<string, string | null> }[] = [];
    const semItem = (lista: string[], item: string) => {
      const n = lista.filter((x) => x !== item);
      return n.length ? n.join(",") : null;
    };
    for (const t of f.tipo) c.push({ rotulo: rotuloTipo(t), remover: { tipo: semItem(f.tipo, t) } });
    for (const x of f.cidade) c.push({ rotulo: nome(r.facetas.cidade, x), remover: { cidade: semItem(f.cidade, x) } });
    for (const x of f.bairro) c.push({ rotulo: nome(r.facetas.bairro, x), remover: { bairro: semItem(f.bairro, x) } });
    for (const x of f.imob) c.push({ rotulo: nome(r.facetas.imob, x), remover: { imob: semItem(f.imob, x) } });
    if (f.pmin != null || f.pmax != null)
      c.push({
        rotulo: f.pmin != null && f.pmax != null ? `${fmtPreco(f.pmin)} – ${fmtPreco(f.pmax)}` : f.pmin != null ? `a partir de ${fmtPreco(f.pmin)}` : `até ${fmtPreco(f.pmax)}`,
        remover: { pmin: null, pmax: null },
      });
    if (f.quartos) c.push({ rotulo: `${f.quartos}+ quartos`, remover: { quartos: null } });
    if (f.suites) c.push({ rotulo: `${f.suites}+ suítes`, remover: { suites: null } });
    if (f.banheiros) c.push({ rotulo: `${f.banheiros}+ banheiros`, remover: { banheiros: null } });
    if (f.vagas) c.push({ rotulo: `${f.vagas}+ vagas`, remover: { vagas: null } });
    if (f.amin != null || f.amax != null)
      c.push({ rotulo: `${f.amin != null ? `${fmtNum(f.amin)}` : "0"} – ${f.amax != null ? fmtNum(f.amax) : "∞"} m²`, remover: { amin: null, amax: null } });
    if (f.foto) c.push({ rotulo: "com fotos", remover: { foto: null } });
    if (f.comPreco) c.push({ rotulo: "com preço", remover: { preco: null } });
    if (f.baixou) c.push({ rotulo: "baixou de preço", remover: { baixou: null } });
    if (f.oportunidade) c.push({ rotulo: "abaixo da mediana do bairro", remover: { oportunidade: null } });
    if (f.novos) c.push({ rotulo: "novos", remover: { novos: null } });
    if (f.removidos) c.push({ rotulo: "incluindo removidos", remover: { removidos: null } });
    if (f.bbox) c.push({ rotulo: "área do mapa", remover: { bbox: null } });
    return c;
  }, [f, r.facetas]);

  const csvHref = `/api/imoveis?${sp.toString()}${sp.toString() ? "&" : ""}formato=csv`;
  const modoMapa = f.vista === "mapa";
  const e = r.estatisticas;

  const painelFiltros = (
    <Filtros filtros={f} facetas={r.facetas} histograma={r.histograma} atualizar={atualizar} limpar={limpar} totalAtivos={ativos} fechar={() => setGaveta(false)} />
  );

  const cards = (modo: "grade" | "lista") =>
    r.itens.map((i, k) => (
      <CardImovel
        key={i.id}
        imovel={i}
        fin={f.fin}
        modo={modo}
        prioridade={k < 4}
        indice={k}
        destacado={destacado === i.id}
        aoPassar={modoMapa ? setDestacado : undefined}
      />
    ));

  const vazio = (
    <div className="rounded-xl border border-dashed border-line p-10 text-center">
      <p className="font-medium">Nenhum imóvel com esses critérios.</p>
      <p className="mt-1 text-sm text-muted">Tente ampliar a faixa de preço, remover um bairro ou desmarcar filtros.</p>
      {ativos > 0 && (
        <button type="button" onClick={limpar} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
          Limpar filtros
        </button>
      )}
    </div>
  );

  const mapa = (
    <div className="relative h-full w-full">
      <MapaLeaflet
        pontos={pontos ?? []}
        fin={f.fin}
        bbox={f.bbox}
        destacado={destacado}
        aoPassar={setDestacado}
        aoClicar={aoClicarMarcador}
        aoMover={aoMoverMapa}
      />
      <div className="absolute left-2 top-2 z-[400] flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow">
          <input type="checkbox" checked={seguirMapa} onChange={(ev) => setSeguirMapa(ev.target.checked)} className="accent-[var(--accent)]" />
          Buscar ao mover o mapa
        </label>
        {f.bbox && (
          <button type="button" onClick={() => atualizar({ bbox: null })} className="rounded-lg border border-line bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow hover:bg-soft">
            Ver todos os pontos
          </button>
        )}
      </div>
      <div className="absolute bottom-2 left-2 z-[400] rounded-lg bg-card/95 px-2.5 py-1.5 text-[11px] text-muted shadow">
        {fmtNum(r.comCoordenadas)} de {fmtNum(r.total)} com localização
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Barra de busca */}
      <div ref={topo} className="scroll-mt-16 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex overflow-hidden rounded-xl border border-line bg-card text-sm shadow-sm">
          {(
            [
              ["venda", "Comprar"],
              ["aluguel", "Alugar"],
              ["todos", "Tudo"],
            ] as const
          ).map(([v, rot]) => (
            <button
              key={v}
              type="button"
              onClick={() => atualizar({ fin: v === "venda" ? null : v, pmin: null, pmax: null })}
              aria-pressed={f.fin === v}
              className={`px-4 py-2.5 font-medium transition ${f.fin === v ? "bg-accent text-accent-fg" : "hover:bg-soft"}`}
            >
              {rot}
            </button>
          ))}
        </div>
        <BuscaTexto valor={texto} aoMudar={setTexto} aoEscolher={escolherSugestao} aoSubmeter={aplicarTexto} />
        <button
          type="button"
          onClick={() => setGaveta(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium lg:hidden"
        >
          <Filtro /> Filtros{ativos ? ` (${ativos})` : ""}
        </button>
      </div>

      {ativos === 0 && !f.q && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Atalhos:</span>
          {ATALHOS.map((a) => (
            <Link key={a.qs} href={`/?${a.qs}`} className="rounded-full border border-line bg-card px-3 py-1 text-xs transition hover:border-accent hover:text-accent">
              {a.rotulo}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-6">
        {/* Filtros: coluna fixa no desktop, gaveta no celular */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto rolagem rounded-xl border border-line bg-card p-4">
            {painelFiltros}
          </div>
        </aside>
        {gaveta && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
            <div className="absolute inset-0 bg-black/40" onClick={() => setGaveta(false)} />
            <div className="absolute inset-y-0 left-0 w-[88%] max-w-sm overflow-y-auto bg-card p-4 shadow-2xl">
              {painelFiltros}
              <button type="button" onClick={() => setGaveta(false)} className="mt-4 w-full rounded-xl bg-accent py-2.5 font-medium text-accent-fg">
                Ver {fmtNum(r.total)} imóveis
              </button>
            </div>
          </div>
        )}

        {/* Resultados */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm">
              <strong className="text-base">{fmtNum(r.total)}</strong> {r.total === 1 ? "imóvel" : "imóveis"}
              {f.q && (
                <>
                  {" "}para <em>“{f.q}”</em>
                </>
              )}
              {pendente && <span className="ml-2 text-muted">atualizando…</span>}
            </p>
            <label className="flex items-center gap-1 text-sm text-muted">
              <span className="hidden sm:inline">Ordenar:</span>
              <select
                value={f.ordem}
                onChange={(ev) => atualizar({ ordem: ev.target.value === "relevancia" ? null : ev.target.value })}
                className="max-w-[220px] rounded-lg border border-line bg-card px-2 py-1.5 text-fg"
                aria-label="Ordenar por"
              >
                {ORDENS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Modo de exibição">
              {(
                [
                  ["grade", Grade, "Grade"],
                  ["lista", Lista, "Lista"],
                  ["mapa", Mapa, "Mapa"],
                ] as const
              ).map(([v, Icone, rot]) => (
                <button
                  key={v}
                  type="button"
                  title={rot}
                  aria-label={rot}
                  aria-pressed={f.vista === v}
                  onClick={() => atualizar({ vista: v === "grade" ? null : v })}
                  className={`p-2 transition ${f.vista === v ? "bg-accent text-accent-fg" : "bg-card hover:bg-soft"}`}
                >
                  <Icone />
                </button>
              ))}
            </div>
            <a
              href={csvHref}
              className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-2 text-sm text-muted hover:text-fg"
              title="Baixar estes resultados em CSV"
            >
              <Baixar /> <span className="hidden sm:inline">CSV</span>
            </a>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.rotulo}
                  type="button"
                  onClick={() => atualizar(c.remover)}
                  className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:opacity-80"
                >
                  {c.rotulo} <Fechar width={12} height={12} />
                </button>
              ))}
              <button type="button" onClick={limpar} className="px-2 text-xs text-muted hover:text-fg">
                limpar
              </button>
            </div>
          )}

          {e.n > 0 && (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-soft px-3 py-2 text-xs text-muted">
              <div>
                <dt className="inline">Mediana </dt>
                <dd className="inline font-semibold text-fg">{fmtPreco(e.mediana_preco)}{f.fin === "aluguel" ? "/mês" : ""}</dd>
              </div>
              {e.mediana_m2 != null && (
                <div>
                  <dt className="inline">Mediana </dt>
                  <dd className="inline font-semibold text-fg">{fmtM2(e.mediana_m2)}</dd>
                </div>
              )}
              <div>
                <dt className="inline">Faixa </dt>
                <dd className="inline font-semibold text-fg">{fmtPreco(e.minimo)} – {fmtPreco(e.maximo)}</dd>
              </div>
              {e.n < r.total && <div className="ml-auto">{fmtNum(r.total - e.n)} sem preço</div>}
            </dl>
          )}

          <div className={`mt-4 transition-opacity ${pendente ? "opacity-60" : ""}`}>
            {modoMapa ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="order-2 min-w-0 lg:order-1">
                  {r.itens.length === 0 ? vazio : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{cards("grade")}</div>}
                  <div className="mt-6">
                    <Paginacao pagina={r.pagina} paginas={r.paginas} aoMudar={irPara} />
                  </div>
                </div>
                <div className="order-1 h-[55vh] overflow-hidden rounded-xl border border-line lg:sticky lg:top-16 lg:order-2 lg:h-[calc(100vh-5rem)]">
                  {mapa}
                </div>
              </div>
            ) : r.itens.length === 0 ? (
              vazio
            ) : f.vista === "lista" ? (
              <div className="space-y-3">{cards("lista")}</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{cards("grade")}</div>
            )}
          </div>

          {!modoMapa && (
            <div className="mt-6">
              <Paginacao pagina={r.pagina} paginas={r.paginas} aoMudar={irPara} />
              {r.total > 0 && (
                <p className="mt-2 text-center text-xs text-muted">
                  Página {r.pagina} de {r.paginas}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
