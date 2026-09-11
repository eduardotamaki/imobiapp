"use client";
import { useState } from "react";
import type { FacetaItem, Facetas, Filtros as F, Histograma } from "@/lib/types";
import FaixaPreco from "./FaixaPreco";
import { fmtNum } from "@/lib/format";
import { norm } from "@/lib/normalize";
import { Fechar, Lupa } from "./Icones";

export type Atualizar = (patch: Record<string, string | null>) => void;

interface Props {
  filtros: F;
  facetas: Facetas;
  histograma: Histograma;
  atualizar: Atualizar;
  limpar: () => void;
  totalAtivos: number;
  fechar?: () => void;
}

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Segmento({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: string | null;
  opcoes: { v: string | null; r: string }[];
  aoMudar: (v: string | null) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-sm">
      {opcoes.map((o) => (
        <button
          key={o.r}
          type="button"
          onClick={() => aoMudar(o.v)}
          aria-pressed={valor === o.v}
          className={`flex-1 px-2 py-1.5 transition ${
            valor === o.v ? "bg-accent font-medium text-accent-fg" : "hover:bg-soft"
          }`}
        >
          {o.r}
        </button>
      ))}
    </div>
  );
}

function ContadorMinimo({ rotulo, chave, valor, atualizar }: { rotulo: string; chave: string; valor: number | null; atualizar: Atualizar }) {
  return (
    <div>
      <div className="mb-1 text-sm">{rotulo}</div>
      <Segmento
        valor={valor ? String(valor) : null}
        opcoes={[
          { v: null, r: "Todos" },
          { v: "1", r: "1+" },
          { v: "2", r: "2+" },
          { v: "3", r: "3+" },
          { v: "4", r: "4+" },
        ]}
        aoMudar={(v) => atualizar({ [chave]: v })}
      />
    </div>
  );
}

/** Campo numérico que só aplica ao sair ou apertar Enter. */
function Numero({ valor, placeholder, prefixo, sufixo, aoAplicar }: { valor: number | null; placeholder: string; prefixo?: string; sufixo?: string; aoAplicar: (v: string | null) => void }) {
  const [texto, setTexto] = useState(valor != null ? fmtNum(valor) : "");
  const [valorAnterior, setValorAnterior] = useState(valor);
  if (valor !== valorAnterior) {
    // A URL mudou por fora (chip removido, "limpar"): o campo acompanha.
    setValorAnterior(valor);
    setTexto(valor != null ? fmtNum(valor) : "");
  }
  const aplicar = () => {
    const n = Number(texto.replace(/\./g, "").replace(",", "."));
    const limpo = texto.trim() === "" || !isFinite(n) || n <= 0 ? null : String(Math.round(n));
    if ((limpo ?? null) !== (valor != null ? String(valor) : null)) aoAplicar(limpo);
  };
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-line bg-card px-2 text-sm focus-within:border-accent">
      {prefixo && <span className="text-muted">{prefixo}</span>}
      <input
        inputMode="numeric"
        value={texto}
        placeholder={placeholder}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={aplicar}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="w-full min-w-0 bg-transparent py-1.5 outline-none"
      />
      {sufixo && <span className="text-muted">{sufixo}</span>}
    </label>
  );
}

function ListaMarcavel({
  itens,
  selecionados,
  aoAlternar,
  buscavel,
  limite = 8,
}: {
  itens: FacetaItem[];
  selecionados: string[];
  aoAlternar: (chave: string) => void;
  buscavel?: boolean;
  limite?: number;
}) {
  const [busca, setBusca] = useState("");
  const [tudo, setTudo] = useState(false);
  const filtro = norm(busca);
  const visiveis = itens.filter((i) => !filtro || (norm(i.nome) ?? "").includes(filtro));
  const mostrados = tudo || filtro ? visiveis : visiveis.slice(0, limite);
  return (
    <div>
      {buscavel && itens.length > limite && (
        <label className="mb-2 flex items-center gap-1 rounded-lg border border-line bg-card px-2 text-sm focus-within:border-accent">
          <Lupa width={14} height={14} className="text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar…" className="w-full bg-transparent py-1 outline-none" />
        </label>
      )}
      <ul className="rolagem max-h-64 space-y-0.5 overflow-y-auto pr-1">
        {mostrados.map((i) => {
          const ativo = selecionados.includes(i.chave);
          return (
            <li key={i.chave}>
              <label className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-soft ${i.n === 0 && !ativo ? "opacity-50" : ""}`}>
                <input type="checkbox" checked={ativo} onChange={() => aoAlternar(i.chave)} className="accent-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate">{i.nome}</span>
                <span className="text-xs tabular-nums text-muted">{fmtNum(i.n)}</span>
              </label>
            </li>
          );
        })}
        {!mostrados.length && <li className="px-1.5 py-1 text-sm text-muted">Nada encontrado</li>}
      </ul>
      {!filtro && visiveis.length > limite && (
        <button type="button" onClick={() => setTudo(!tudo)} className="mt-1 text-xs font-medium text-accent hover:underline">
          {tudo ? "Mostrar menos" : `Mostrar todos (${visiveis.length})`}
        </button>
      )}
    </div>
  );
}

export default function Filtros({ filtros: f, facetas, histograma, atualizar, limpar, totalAtivos, fechar }: Props) {
  const alternarLista = (chave: "tipo" | "cidade" | "bairro" | "imob", valor: string) => {
    const atual = f[chave];
    const novo = atual.includes(valor) ? atual.filter((x) => x !== valor) : [...atual, valor];
    atualizar({ [chave]: novo.length ? novo.join(",") : null });
  };
  const marcar = (chave: string, ativo: boolean) => atualizar({ [chave]: ativo ? "1" : null });
  const aluguel = f.fin === "aluguel";

  return (
    <div className="text-fg">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Filtros{totalAtivos ? ` (${totalAtivos})` : ""}</h2>
        <div className="flex items-center gap-2">
          {totalAtivos > 0 && (
            <button type="button" onClick={limpar} className="text-xs font-medium text-accent hover:underline">
              Limpar tudo
            </button>
          )}
          {fechar && (
            <button type="button" onClick={fechar} aria-label="Fechar filtros" className="rounded-full p-1 hover:bg-soft lg:hidden">
              <Fechar />
            </button>
          )}
        </div>
      </div>

      <Secao titulo="Tipo de imóvel">
        <div className="flex flex-wrap gap-1.5">
          {facetas.tipo.map((t) => {
            const ativo = f.tipo.includes(t.chave);
            return (
              <button
                key={t.chave}
                type="button"
                onClick={() => alternarLista("tipo", t.chave)}
                aria-pressed={ativo}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  ativo ? "border-accent bg-accent text-accent-fg" : "border-line hover:bg-soft"
                } ${t.n === 0 && !ativo ? "opacity-50" : ""}`}
              >
                {t.nome} <span className={ativo ? "opacity-80" : "text-muted"}>{fmtNum(t.n)}</span>
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo={aluguel ? "Aluguel mensal" : "Preço"}>
        <FaixaPreco
          histograma={histograma}
          pmin={f.pmin}
          pmax={f.pmax}
          aoAplicar={(a, b) => atualizar({ pmin: a != null ? String(a) : null, pmax: b != null ? String(b) : null })}
        />
        <div className="mt-2 flex items-center gap-2">
          <Numero valor={f.pmin} placeholder="mín." prefixo="R$" aoAplicar={(v) => atualizar({ pmin: v })} />
          <span className="text-muted">–</span>
          <Numero valor={f.pmax} placeholder="máx." prefixo="R$" aoAplicar={(v) => atualizar({ pmax: v })} />
        </div>
        {!aluguel && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ["até 300 mil", null, "300000"],
              ["300–600 mil", "300000", "600000"],
              ["600 mil–1 mi", "600000", "1000000"],
              ["acima de 1 mi", "1000000", null],
            ].map(([r, a, b]) => {
              const ativo = (f.pmin ?? null) === (a ? Number(a) : null) && (f.pmax ?? null) === (b ? Number(b) : null);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => atualizar(ativo ? { pmin: null, pmax: null } : { pmin: a, pmax: b })}
                  className={`rounded-full border px-2 py-0.5 text-xs ${ativo ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-soft"}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        )}
      </Secao>

      <Secao titulo="Cidade">
        <ListaMarcavel itens={facetas.cidade} selecionados={f.cidade} aoAlternar={(c) => alternarLista("cidade", c)} buscavel limite={6} />
      </Secao>

      <Secao titulo="Bairro">
        <ListaMarcavel itens={facetas.bairro} selecionados={f.bairro} aoAlternar={(b) => alternarLista("bairro", b)} buscavel limite={8} />
      </Secao>

      <Secao titulo="Cômodos e vagas">
        <div className="space-y-3">
          <ContadorMinimo rotulo="Quartos" chave="quartos" valor={f.quartos} atualizar={atualizar} />
          <ContadorMinimo rotulo="Suítes" chave="suites" valor={f.suites} atualizar={atualizar} />
          <ContadorMinimo rotulo="Banheiros" chave="banheiros" valor={f.banheiros} atualizar={atualizar} />
          <ContadorMinimo rotulo="Vagas" chave="vagas" valor={f.vagas} atualizar={atualizar} />
        </div>
      </Secao>

      <Secao titulo="Área">
        <div className="flex items-center gap-2">
          <Numero valor={f.amin} placeholder="mín." sufixo="m²" aoAplicar={(v) => atualizar({ amin: v })} />
          <span className="text-muted">–</span>
          <Numero valor={f.amax} placeholder="máx." sufixo="m²" aoAplicar={(v) => atualizar({ amax: v })} />
        </div>
      </Secao>

      <Secao titulo="Imobiliária">
        <ListaMarcavel itens={facetas.imob} selecionados={f.imob} aoAlternar={(i) => alternarLista("imob", i)} buscavel limite={6} />
      </Secao>

      <Secao titulo="Mais opções">
        <ul className="space-y-1 text-sm">
          {[
            ["foto", f.foto, "Só com fotos"],
            ["preco", f.comPreco, "Só com preço informado"],
            ["oportunidade", f.oportunidade, "Abaixo da mediana de R$/m² do bairro"],
            ["baixou", f.baixou, "Baixou de preço"],
            ["novos", f.novos, "Novos no catálogo (7 dias)"],
            ["removidos", f.removidos, "Incluir anúncios que saíram do ar"],
          ].map(([chave, ativo, rotulo]) => (
            <li key={chave as string}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-soft">
                <input type="checkbox" checked={ativo as boolean} onChange={(e) => marcar(chave as string, e.target.checked)} className="accent-[var(--accent)]" />
                {rotulo as string}
              </label>
            </li>
          ))}
        </ul>
      </Secao>
    </div>
  );
}
