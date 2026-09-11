import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormImovel from "@/components/painel/FormImovel";
import { Aviso, BadgeLead, BadgeStatus, Titulo, cls } from "@/components/painel/ui";
import { Externo } from "@/components/Icones";
import { escopoAtual } from "@/lib/auth";
import { fmtData, fmtDataHora, fmtPct, fmtPreco, tituloCurto } from "@/lib/format";
import { bairrosConhecidos, caracteristicasComuns, imovelParaEdicao } from "@/lib/painel";
import { excluirImovel, salvarImovel } from "../../../acoes";
import { descreveAuditoria } from "@/components/painel/auditoria";

export const metadata: Metadata = { title: "Editar imóvel" };

export default async function EditarImovel({ params, searchParams }: PageProps<"/painel/imoveis/[id]">) {
  const e = (await escopoAtual())!;
  const { id } = await params;
  const sp = await searchParams;
  const n = Number(id);
  const i = Number.isInteger(n) ? imovelParaEdicao(n, e.imobiliaria?.id ?? (e.admin ? null : -1)) : null;
  if (!i) notFound();
  const externo = /^https?:\/\//i.test(i.url);

  return (
    <>
      <Titulo
        sub={
          <>
            {i.codigo && <span className="font-mono">ref. {i.codigo} · </span>}
            {i.origem === "manual" ? "cadastrado no painel" : `coletado do site${i.travado ? ", protegido da coleta" : ""}`} · {i.imobiliaria}
          </>
        }
        acao={
          <>
            <Link href={`/imovel/${i.id}`} target="_blank" className={`${cls.botao} ${cls.secundario}`}>
              Ver no site <Externo width={14} height={14} />
            </Link>
            {externo && (
              <a href={i.url} target="_blank" rel="noopener noreferrer" className={`${cls.botao} ${cls.secundario}`}>
                Anúncio original <Externo width={14} height={14} />
              </a>
            )}
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-2">
          {tituloCurto(i)} <BadgeStatus status={i.status} />
        </span>
      </Titulo>
      <p className="mb-4 text-sm text-muted">
        <Link href="/painel/imoveis" className="hover:text-fg">← voltar à lista</Link>
      </p>
      {sp.salvo === "novo" && <div className="mb-4"><Aviso tipo="ok">Imóvel cadastrado. Já está no site se o status for &quot;No ar&quot;.</Aviso></div>}
      {i.origem === "scraper" && !i.travado && (
        <div className="mb-4">
          <Aviso tipo="info">
            Este anúncio veio da coleta automática do site da imobiliária. Ao salvar, ele fica <strong>protegido</strong> se a opção estiver marcada; caso contrário a próxima coleta pode sobrescrever os campos.
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <FormImovel imovel={i} acao={salvarImovel} bairros={bairrosConhecidos()} caracteristicasSugeridas={caracteristicasComuns(i.imobiliaria_id)} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className={`${cls.cartao} p-4 text-sm`}>
            <h2 className="font-semibold">Ficha</h2>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-2"><dt className="text-muted">Id</dt><dd className="font-mono text-xs">{i.id}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Criado</dt><dd>{fmtData(i.criado_em)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Alterado</dt><dd>{fmtDataHora(i.atualizado_em)}</dd></div>
              {i.origem === "scraper" && <div className="flex justify-between gap-2"><dt className="text-muted">Visto na coleta</dt><dd>{fmtDataHora(i.visto_em)}</dd></div>}
            </dl>
          </section>

          <section className={`${cls.cartao} p-4 text-sm`}>
            <h2 className="font-semibold">Histórico de preço</h2>
            {i.historico.length ? (
              <ul className="mt-2 space-y-1">
                {i.historico.map((h, k) => {
                  const ant = k > 0 ? i.historico[k - 1] : null;
                  const campo = h.preco != null && ant?.preco != null ? "preco" : "preco_aluguel";
                  const d = ant && ant[campo] && h[campo] ? (h[campo]! - ant[campo]!) / ant[campo]! : null;
                  return (
                    <li key={h.data + k} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{fmtData(h.data)}</span>
                      <span>
                        {h.preco != null ? fmtPreco(h.preco) : h.preco_aluguel != null ? `${fmtPreco(h.preco_aluguel)}/mês` : "—"}
                        {d != null && <span className={`ml-1 text-xs ${d < 0 ? "text-queda" : "text-alerta"}`}>{fmtPct(d)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-muted">Sem registros.</p>
            )}
          </section>

          <section className={`${cls.cartao} p-4 text-sm`}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Leads deste anúncio</h2>
              <Link href="/painel/leads" className="text-xs text-muted hover:text-fg">todos →</Link>
            </div>
            {i.leads.length ? (
              <ul className="mt-2 space-y-2">
                {i.leads.map((l) => (
                  <li key={l.id} className="rounded-lg bg-soft px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{l.nome}</span>
                      <BadgeLead status={l.status} />
                    </div>
                    <div className="text-xs text-muted">{[l.telefone, l.email].filter(Boolean).join(" · ")} · {fmtData(l.criado_em)}</div>
                    {l.mensagem && <p className="mt-1 line-clamp-3 text-xs">{l.mensagem}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted">Nenhum contato ainda.</p>
            )}
          </section>

          <section className={`${cls.cartao} p-4 text-sm`}>
            <h2 className="font-semibold">Alterações</h2>
            {i.auditoria.length ? (
              <ul className="mt-2 space-y-2">
                {i.auditoria.map((a) => (
                  <li key={a.id} className="border-t border-line pt-2 first:border-0 first:pt-0">
                    <div className="text-xs text-muted">{fmtDataHora(a.criado_em)} · {a.usuario ?? "sistema"}</div>
                    <div className="text-xs">{descreveAuditoria(a)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted">Nenhuma edição pelo painel.</p>
            )}
          </section>

          {i.origem === "manual" && (
            <form action={excluirImovel} className={`${cls.cartao} p-4 text-sm`}>
              <input type="hidden" name="id" value={i.id} />
              <h2 className="font-semibold">Excluir</h2>
              <p className="mt-1 text-xs text-muted">Remove o anúncio e seus leads, sem volta. Para tirar do ar sem apagar, use o status &quot;Pausado&quot;.</p>
              <button type="submit" className={`${cls.botao} ${cls.perigo} mt-2`}>Excluir este imóvel</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
