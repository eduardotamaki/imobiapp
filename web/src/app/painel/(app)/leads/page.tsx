import type { Metadata } from "next";
import Link from "next/link";
import LeadItem from "@/components/painel/LeadItem";
import { PaginacaoLinks, Titulo, Vazio } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { fmtNum } from "@/lib/format";
import { listaLeads, STATUS_LEAD } from "@/lib/painel";
import { atualizarLead } from "../../acoes";

export const metadata: Metadata = { title: "Leads" };

export default async function Leads({ searchParams }: PageProps<"/painel/leads">) {
  const e = (await escopoAtual())!;
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const r = listaLeads(e.imobiliaria?.id ?? null, status, pagina);
  const base = new URLSearchParams();
  if (status) base.set("status", status);
  const volta = `/painel/leads${base.toString() ? `?${base}` : ""}${pagina > 1 ? `${base.toString() ? "&" : "?"}pagina=${pagina}` : ""}`;
  const abas: { v: string; r: string; n: number }[] = [
    { v: "", r: "Abertos", n: (r.contagem.novo ?? 0) + (r.contagem.em_contato ?? 0) },
    ...Object.entries(STATUS_LEAD).map(([v, rot]) => ({ v, r: rot, n: r.contagem[v] ?? 0 })),
    { v: "todos", r: "Todos", n: Object.values(r.contagem).reduce((s, n) => s + n, 0) },
  ];

  return (
    <>
      <Titulo sub="Contatos enviados pelo formulário de cada anúncio no site. Responda rápido: lead quente esfria em horas.">Leads</Titulo>
      <nav className="rolagem mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Situação">
        {abas.map((a) => (
          <Link
            key={a.v}
            href={a.v ? `/painel/leads?status=${a.v}` : "/painel/leads"}
            className={`-mb-px flex flex-none items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${status === a.v ? "border-accent font-medium" : "border-transparent text-muted hover:text-fg"}`}
          >
            {a.r}
            <span className="rounded-full bg-soft px-1.5 text-[11px] text-muted">{fmtNum(a.n)}</span>
          </Link>
        ))}
      </nav>
      {r.itens.length ? (
        <ul className="space-y-2">
          {r.itens.map((l) => (
            <LeadItem key={l.id} lead={l} acao={atualizarLead} volta={volta} mostraImobiliaria={!e.imobiliaria} />
          ))}
        </ul>
      ) : (
        <Vazio>Nenhum lead nesta situação.</Vazio>
      )}
      <PaginacaoLinks pagina={pagina} paginas={r.paginas} base={base} />
    </>
  );
}
