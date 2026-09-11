"use client";
import Link from "next/link";
import { useState } from "react";
import type { Imovel } from "@/lib/types";
import { fmtArea, fmtM2, fmtPct, fmtPreco, tituloCurto } from "@/lib/format";
import Foto from "./Foto";
import BotaoFavorito from "./BotaoFavorito";
import { Banho, Cama, Carro, Externo, Regua, Seta } from "./Icones";

interface Props {
  imovel: Imovel;
  fin?: string;
  modo?: "grade" | "lista";
  prioridade?: boolean;
  /** Posição na lista, para escalonar a animação de entrada. */
  indice?: number;
  destacado?: boolean;
  aoPassar?: (id: number | null) => void;
}

export function Badges({ i, fin }: { i: Imovel; fin: string }) {
  const badges: { texto: string; classe: string; titulo?: string }[] = [];
  if (i.status !== "disponivel") badges.push({ texto: "Saiu do ar", classe: "bg-neutral-700 text-white" });
  if (i.novo) badges.push({ texto: "Novo", classe: "bg-accent text-accent-fg" });
  if (i.variacao != null && i.variacao < 0)
    badges.push({ texto: `▼ ${fmtPct(i.variacao).replace("-", "")}`, classe: "bg-queda-soft text-queda", titulo: `Baixou de ${fmtPreco(i.preco_anterior)}` });
  if (i.variacao != null && i.variacao > 0)
    badges.push({ texto: `▲ ${fmtPct(i.variacao).replace("+", "")}`, classe: "bg-alerta-soft text-alerta", titulo: `Subiu de ${fmtPreco(i.preco_anterior)}` });
  if (i.desconto != null && i.desconto >= 0.05)
    badges.push({
      texto: `${fmtPct(i.desconto).replace("+", "")} abaixo ${i.ref_escopo === "bairro" ? "do bairro" : "da cidade"}`,
      classe: "bg-queda-soft text-queda",
      titulo: `R$/m² ${fmtPct(-i.desconto)} frente à mediana de ${fmtM2(i.ref_m2)} (${i.ref_n} anúncios parecidos)`,
    });
  if (fin === "todos" && i.finalidade)
    badges.push({
      texto: i.finalidade === "aluguel" ? "Aluguel" : i.finalidade === "venda_aluguel" ? "Venda ou aluguel" : "Venda",
      classe: "bg-card/90 text-fg border border-line",
    });
  if (!badges.length) return null;
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-[5] flex flex-wrap gap-1">
      {badges.map((b) => (
        <span key={b.texto} title={b.titulo} className={`pointer-events-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-sm ${b.classe}`}>
          {b.texto}
        </span>
      ))}
    </div>
  );
}

export function LinhaPreco({ i, fin, grande }: { i: Imovel; fin: string; grande?: boolean }) {
  const mostraVenda = fin !== "aluguel" && i.preco != null;
  const mostraAluguel = (fin === "aluguel" || (fin === "todos" && i.preco == null) || (fin === "venda" && i.preco == null)) && i.preco_aluguel != null;
  const m2 = mostraVenda ? i.preco_m2 : mostraAluguel ? i.aluguel_m2 : null;
  const tam = grande ? "text-2xl" : "text-lg";
  if (!mostraVenda && !mostraAluguel) {
    return <div className={`${tam} font-semibold text-muted`}>Sob consulta</div>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`${tam} font-semibold tracking-tight`}>
        {mostraVenda ? fmtPreco(i.preco) : fmtPreco(i.preco_aluguel)}
        {mostraAluguel && !mostraVenda && <span className="text-sm font-normal text-muted">/mês</span>}
      </span>
      {m2 != null && <span className="text-xs text-muted">{fmtM2(m2)}</span>}
      {mostraVenda && fin === "todos" && i.preco_aluguel != null && (
        <span className="text-xs text-muted">ou {fmtPreco(i.preco_aluguel)}/mês</span>
      )}
    </div>
  );
}

export function Specs({ i, classe = "" }: { i: Imovel; classe?: string }) {
  const itens: { Icone: typeof Cama; v: string; t: string }[] = [];
  if (i.quartos != null) itens.push({ Icone: Cama, v: String(i.quartos), t: `${i.quartos} quarto(s)${i.suites ? `, ${i.suites} suíte(s)` : ""}` });
  if (i.banheiros != null) itens.push({ Icone: Banho, v: String(i.banheiros), t: `${i.banheiros} banheiro(s)` });
  if (i.vagas != null) itens.push({ Icone: Carro, v: String(i.vagas), t: `${i.vagas} vaga(s)` });
  if (i.area != null) itens.push({ Icone: Regua, v: fmtArea(i.area), t: `área ${fmtArea(i.area)}` });
  if (!itens.length) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted ${classe}`}>
      {itens.map(({ Icone, v, t }) => (
        <li key={t} className="flex items-center gap-1" title={t}>
          <Icone width={14} height={14} />
          <span>{v}</span>
        </li>
      ))}
    </ul>
  );
}

/** Fotos do card: passa uma a uma com setas, sem sair da lista. */
function Carrossel({ fotos, alt, prioridade, aspecto }: { fotos: string[]; alt: string; prioridade?: boolean; aspecto: string }) {
  const [k, setK] = useState(0);
  const n = fotos.length;
  if (!n) return <Foto src={null} alt={alt} className={`${aspecto} w-full`} />;
  const ir = (d: number) => setK((x) => (x + d + n) % n);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Foto key={fotos[k]} src={fotos[k]} alt={alt} prioridade={prioridade && k === 0} className={`${aspecto} h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]`} />
      {n > 1 && (
        <>
          <button type="button" aria-label="Foto anterior" className="carrossel-seta left-1.5" onClick={(e) => { e.preventDefault(); ir(-1); }}>
            <Seta className="rotate-180" width={14} height={14} />
          </button>
          <button type="button" aria-label="Próxima foto" className="carrossel-seta right-1.5" onClick={(e) => { e.preventDefault(); ir(1); }}>
            <Seta width={14} height={14} />
          </button>
          <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden>
            {fotos.map((_, j) => (
              <span key={j} className={`h-1.5 w-1.5 rounded-full shadow ${j === k ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CardImovel({ imovel: i, fin = "venda", modo = "grade", prioridade, indice = 0, destacado, aoPassar }: Props) {
  const alt = i.titulo ?? tituloCurto(i);
  const local = [i.bairro, i.cidade].filter(Boolean).join(", ") || "Local não informado";
  const fotos = i.fotos?.length ? i.fotos : i.capa ? [i.capa] : [];
  // O card inteiro é clicável por um link "esticado" (pseudo-elemento cobrindo o
  // <article>); botões e link externo ficam acima dele. Assim não há
  // <a> nem <button> dentro de <a>, que o HTML proíbe.
  const esticado = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";
  const borda = destacado ? "border-accent shadow-lg ring-2 ring-accent/30" : "border-line hover:border-accent/60 hover:shadow-md";
  const eventos = {
    onMouseEnter: () => aoPassar?.(i.id),
    onMouseLeave: () => aoPassar?.(null),
  };
  const linkExterno = (
    <a
      href={i.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative z-10 flex shrink-0 items-center gap-1 hover:text-accent"
      title="Abrir anúncio original"
    >
      <Externo width={13} height={13} /> anúncio
    </a>
  );

  if (modo === "lista") {
    return (
      <article
        id={`imovel-${i.id}`}
        {...eventos}
        style={{ "--i": Math.min(indice, 12) } as React.CSSProperties}
        className={`group animar-entrada relative flex gap-4 rounded-xl border bg-card p-3 transition focus-within:border-accent ${borda}`}
      >
        <div className="relative w-40 shrink-0 overflow-hidden rounded-lg sm:w-56">
          <Carrossel fotos={fotos} alt={alt} prioridade={prioridade} aspecto="aspect-[4/3]" />
          <Badges i={i} fin={fin} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <LinhaPreco i={i} fin={fin} />
              <h3 className="mt-0.5 truncate font-medium">
                <Link href={`/imovel/${i.id}`} className={esticado}>
                  {tituloCurto(i)}
                </Link>
              </h3>
              <p className="truncate text-sm text-muted">{local}</p>
            </div>
            <div className="relative z-10">
              <BotaoFavorito id={i.id} />
            </div>
          </div>
          {i.titulo && <p className="mt-1 line-clamp-2 text-sm text-muted">{i.titulo}</p>}
          <Specs i={i} classe="mt-auto pt-2" />
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate">
              {i.imobiliaria}
              {i.codigo ? ` · ref. ${i.codigo}` : ""}
              {i.n_fotos > 1 ? ` · ${i.n_fotos} fotos` : ""}
            </span>
            {linkExterno}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      id={`imovel-${i.id}`}
      {...eventos}
      style={{ "--i": Math.min(indice, 12) } as React.CSSProperties}
      className={`group animar-entrada relative flex flex-col overflow-hidden rounded-xl border bg-card transition focus-within:border-accent ${borda}`}
    >
      <div className="relative">
        <Carrossel fotos={fotos} alt={alt} prioridade={prioridade} aspecto="aspect-[4/3]" />
        <Badges i={i} fin={fin} />
        <div className="absolute right-2 top-2 z-10">
          <BotaoFavorito id={i.id} />
        </div>
        {i.n_fotos > 1 && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {i.n_fotos} fotos
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <LinhaPreco i={i} fin={fin} />
        <h3 className="truncate font-medium" title={alt}>
          <Link href={`/imovel/${i.id}`} className={esticado}>
            {tituloCurto(i)}
          </Link>
        </h3>
        <p className="truncate text-sm text-muted">{local}</p>
        <Specs i={i} classe="mt-1" />
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted">
          <span className="truncate">{i.imobiliaria}</span>
          {linkExterno}
        </div>
      </div>
    </article>
  );
}
