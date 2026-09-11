import type { Metadata } from "next";
import Link from "next/link";
import { BadgeLead, Kpi, Titulo, Vazio, cls } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { fmtData, fmtDataHora, fmtNum, fmtPreco, rotuloTipo } from "@/lib/format";
import { leadsRecentes, listaImobiliarias, resumoPainel, STATUS_IMOVEL } from "@/lib/painel";

export const metadata: Metadata = { title: "Painel" };

function Barra({ v, max }: { v: number; max: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-soft">
      <div className="h-full rounded-full bg-accent" style={{ width: `${max ? Math.max(2, (v / max) * 100) : 0}%` }} />
    </div>
  );
}

export default async function Inicio() {
  const e = (await escopoAtual())!;
  const imobId = e.imobiliaria?.id ?? null;
  const r = resumoPainel(imobId);
  const leads = leadsRecentes(imobId, 6);
  const problemas = [
    { rotulo: "Sem foto", n: r.semFoto, chave: "sem_foto" },
    { rotulo: "Sem preço", n: r.semPreco, chave: "sem_preco" },
    { rotulo: "Sem localização no mapa", n: r.semLocal, chave: "sem_local" },
    { rotulo: "Descrição curta ou ausente", n: r.semDescricao, chave: "sem_descricao" },
  ];
  const totalProblemas = problemas.reduce((s, p) => s + p.n, 0);
  const maxTipo = Math.max(1, ...r.porTipo.map((t) => t.n));
  const primeiroNome = e.usuario.nome.split(" ")[0];

  return (
    <>
      <Titulo
        sub={
          e.imobiliaria
            ? `${e.imobiliaria.nome} · última coleta ${fmtDataHora(r.ultimaColeta)}`
            : `Visão geral de todas as imobiliárias · última coleta ${fmtDataHora(r.ultimaColeta)}`
        }
        acao={
          <>
            <Link href="/painel/imoveis/novo" className={`${cls.botao} ${cls.primario}`}>+ Novo imóvel</Link>
            <Link href={e.imobiliaria ? `/?imob=${e.imobiliaria.slug}&fin=todos` : "/"} className={`${cls.botao} ${cls.secundario}`}>Ver no site</Link>
          </>
        }
      >
        Olá, {primeiroNome}
      </Titulo>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Anúncios no ar" valor={fmtNum(r.ativos)} sub={`${fmtNum(r.pausados)} pausados`} href="/painel/imoveis" />
        <Kpi rotulo="Leads novos" valor={fmtNum(r.leadsNovos)} sub={`${fmtNum(r.leads30)} nos últimos 30 dias`} href="/painel/leads" tom={r.leadsNovos ? "ok" : "neutro"} />
        <Kpi rotulo="Entraram em 30 dias" valor={fmtNum(r.novos30)} sub="anúncios novos no ar" href="/painel/imoveis?ordem=criado" />
        <Kpi rotulo="Fechados em 30 dias" valor={fmtNum(r.fechados30)} sub="vendidos ou alugados" href="/painel/imoveis?status=vendido" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className={`${cls.cartao} p-4 lg:col-span-2`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Qualidade dos anúncios</h2>
            <span className={`text-xs ${totalProblemas ? "text-alerta" : "text-queda"}`}>
              {totalProblemas ? `${fmtNum(totalProblemas)} pendências` : "tudo em ordem"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">Anúncio completo aparece melhor na busca e no mapa. Clique para corrigir.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {problemas.map((p) => (
              <li key={p.chave}>
                <Link
                  href={`/painel/imoveis?problema=${p.chave}`}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:bg-soft ${p.n ? "border-alerta/40" : "border-line text-muted"}`}
                >
                  {p.rotulo}
                  <span className={`font-semibold ${p.n ? "text-alerta" : ""}`}>{fmtNum(p.n)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <Link href="/painel/imoveis?ordem=preco_desc" className="rounded-lg bg-soft px-3 py-2 hover:bg-line/60">
              <div className="text-xs text-muted">Baixaram de preço</div>
              <div className="font-semibold">{fmtNum(r.baixaram)}</div>
            </Link>
            <div className="rounded-lg bg-soft px-3 py-2">
              <div className="text-xs text-muted">Em destaque</div>
              <div className="font-semibold">{fmtNum(r.destaques)}</div>
            </div>
            <div className="rounded-lg bg-soft px-3 py-2">
              <div className="text-xs text-muted">Tempo médio no ar</div>
              <div className="font-semibold">{r.diasNoAr != null ? `${Math.round(r.diasNoAr)} dias` : "—"}</div>
            </div>
          </div>
        </section>

        <section className={`${cls.cartao} p-4`}>
          <h2 className="font-semibold">Carteira por tipo</h2>
          <ul className="mt-3 space-y-2">
            {r.porTipo.slice(0, 7).map((t) => (
              <li key={t.tipo}>
                <div className="flex justify-between text-sm">
                  <span>{rotuloTipo(t.tipo)}</span>
                  <span className="text-muted">{fmtNum(t.n)}</span>
                </div>
                <Barra v={t.n} max={maxTipo} />
              </li>
            ))}
            {!r.porTipo.length && <li className="text-sm text-muted">Nenhum anúncio no ar.</li>}
          </ul>
          <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Por status</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.porStatus.map((s) => (
              <li key={s.status}>
                <Link href={`/painel/imoveis?status=${s.status}`} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-soft">
                  {STATUS_IMOVEL[s.status] ?? s.status} · {fmtNum(s.n)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Últimos leads</h2>
          <Link href="/painel/leads" className="text-sm text-muted hover:text-fg">ver todos →</Link>
        </div>
        {leads.length ? (
          <ul className={`${cls.cartao} divide-y divide-line`}>
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <BadgeLead status={l.status} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{l.nome}</span>
                  {l.telefone && <span className="text-muted"> · {l.telefone}</span>}
                  {l.email && <span className="text-muted"> · {l.email}</span>}
                  {l.imovel_id && (
                    <div className="truncate text-xs text-muted">
                      <Link href={`/painel/imoveis/${l.imovel_id}`} className="hover:text-fg">
                        {rotuloTipo(l.imovel_tipo)}{l.imovel_bairro ? ` no ${l.imovel_bairro}` : ""}{l.imovel_codigo ? ` · ref. ${l.imovel_codigo}` : ""} · {fmtPreco(l.imovel_preco)}
                      </Link>
                      {!e.imobiliaria && ` · ${l.imobiliaria}`}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted">{fmtData(l.criado_em)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio>Nenhum lead ainda. O formulário de contato de cada anúncio no site cai aqui.</Vazio>
        )}
      </section>

      {e.admin && !e.imobiliaria && <TabelaImobiliarias />}
    </>
  );
}

function TabelaImobiliarias() {
  const lista = listaImobiliarias();
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Imobiliárias</h2>
        <Link href="/painel/imobiliaria" className="text-sm text-muted hover:text-fg">gerenciar →</Link>
      </div>
      <div className={`${cls.cartao} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Origem</th>
              <th className="px-4 py-2 text-right font-medium">No ar</th>
              <th className="px-4 py-2 text-right font-medium">Usuários</th>
              <th className="px-4 py-2 font-medium">Última coleta</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{m.nome}</td>
                <td className="px-4 py-2 text-muted">{m.plataforma ?? (m.status === "sem_scraper" ? "manual" : "—")}</td>
                <td className="px-4 py-2 text-right">{fmtNum(m.n_imoveis)}</td>
                <td className="px-4 py-2 text-right">{fmtNum(m.n_usuarios)}</td>
                <td className="px-4 py-2 text-muted">{fmtDataHora(m.ultima_coleta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
