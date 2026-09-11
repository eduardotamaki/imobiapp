import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BotaoFavorito from "@/components/BotaoFavorito";
import CardImovel, { LinhaPreco } from "@/components/CardImovel";
import Galeria from "@/components/Galeria";
import Compartilhar from "@/components/Compartilhar";
import RegistraVisita from "@/components/RegistraVisita";
import MapaImovel from "@/components/MapaImovel";
import { Externo, Pino } from "@/components/Icones";
import { detalhe } from "@/lib/catalogo";
import { fmtArea, fmtData, fmtDataHora, fmtM2, fmtPct, fmtPreco, rotuloTipo, tituloCurto } from "@/lib/format";

export const dynamic = "force-dynamic";

async function carrega(params: Promise<{ id: string }>) {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) ? detalhe(n) : null;
}

export async function generateMetadata({ params }: PageProps<"/imovel/[id]">): Promise<Metadata> {
  const i = await carrega(params);
  if (!i) return { title: "Imóvel não encontrado" };
  return { title: `${tituloCurto(i)} – ${fmtPreco(i.preco ?? i.preco_aluguel)}`, description: i.titulo ?? undefined };
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor == null || valor === "" || valor === "—") return null;
  return (
    <div className="rounded-lg bg-soft px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</div>
      <div className="font-medium">{valor}</div>
    </div>
  );
}

export default async function PaginaImovel({ params }: PageProps<"/imovel/[id]">) {
  const i = await carrega(params);
  if (!i) notFound();

  const fin = i.finalidade === "aluguel" ? "aluguel" : "venda";
  const precoRef = fin === "aluguel" ? i.preco_aluguel : i.preco;
  const m2Ref = fin === "aluguel" ? i.aluguel_m2 : i.preco_m2;
  const titulo = tituloCurto(i);
  const local = [i.endereco, i.bairro, i.cidade && `${i.cidade}${i.uf ? `/${i.uf}` : ""}`].filter(Boolean).join(" · ");
  const buscaBairro = i.bairro ? `/?bairro=${encodeURIComponent(i.bairro)}${i.tipo ? `&tipo=${i.tipo}` : ""}${fin === "aluguel" ? "&fin=aluguel" : ""}` : "/";

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <RegistraVisita id={i.id} />
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted" aria-label="Navegação">
        <Link href="/" className="hover:text-fg">Buscar</Link>
        <span>/</span>
        {i.cidade && (
          <>
            <Link href={`/?cidade=${encodeURIComponent(i.cidade)}`} className="hover:text-fg">{i.cidade}</Link>
            <span>/</span>
          </>
        )}
        {i.bairro && (
          <>
            <Link href={buscaBairro} className="hover:text-fg">{i.bairro}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-fg">{rotuloTipo(i.tipo)}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Galeria fotos={i.fotos} titulo={titulo} />

          <div className="mt-5 flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
              {i.titulo && i.titulo !== titulo && <p className="mt-1 text-muted">{i.titulo}</p>}
              {local && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <Pino width={14} height={14} /> {local}
                </p>
              )}
            </div>
            <Compartilhar titulo={titulo} texto={`${titulo} – ${fmtPreco(precoRef)}${fin === "aluguel" ? "/mês" : ""} (${i.imobiliaria})`} />
            {i.status !== "disponivel" && (
              <span className="rounded-md bg-neutral-700 px-2 py-1 text-xs font-semibold text-white">Saiu do ar em {fmtData(i.atualizado_em)}</span>
            )}
            {i.novo === 1 && <span className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-fg">Novo no catálogo</span>}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            <Campo rotulo="Quartos" valor={i.quartos} />
            <Campo rotulo="Suítes" valor={i.suites} />
            <Campo rotulo="Banheiros" valor={i.banheiros} />
            <Campo rotulo="Vagas" valor={i.vagas} />
            <Campo rotulo="Área útil" valor={i.area_util != null ? fmtArea(i.area_util) : null} />
            <Campo rotulo="Área total" valor={i.area_total != null ? fmtArea(i.area_total) : null} />
            <Campo rotulo="Tipo" valor={rotuloTipo(i.tipo)} />
            <Campo rotulo="Finalidade" valor={i.finalidade === "venda_aluguel" ? "Venda ou aluguel" : i.finalidade === "aluguel" ? "Aluguel" : i.finalidade === "venda" ? "Venda" : null} />
          </div>

          {i.descricao && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">Descrição</h2>
              <p className="descricao text-[15px] leading-relaxed">{i.descricao}</p>
            </section>
          )}

          {i.caracteristicas.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">Características</h2>
              <ul className="flex flex-wrap gap-1.5">
                {i.caracteristicas.map((c) => (
                  <li key={c} className="rounded-full border border-line px-2.5 py-1 text-sm">{c}</li>
                ))}
              </ul>
            </section>
          )}

          {i.contexto.length > 0 && precoRef != null && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">Como se compara</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {i.contexto.map((c) => {
                  const delta = m2Ref != null && c.mediana_m2 ? m2Ref / c.mediana_m2 - 1 : null;
                  const deltaP = c.mediana_preco ? precoRef / c.mediana_preco - 1 : null;
                  return (
                    <div key={c.escopo} className="rounded-xl border border-line bg-card p-4">
                      <div className="text-sm text-muted">
                        {rotuloTipo(i.tipo)}{i.tipo ? "s" : ""} {fin === "aluguel" ? "para alugar" : "à venda"} {c.escopo === "bairro" ? "no bairro" : "em"} <strong className="text-fg">{c.nome}</strong> · {c.n} anúncios
                      </div>
                      <dl className="mt-2 space-y-1 text-sm">
                        {c.mediana_m2 != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted">Mediana R$/m²</dt>
                            <dd className="font-medium">
                              {fmtM2(c.mediana_m2)}
                              {delta != null && (
                                <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-semibold ${delta <= 0 ? "bg-queda-soft text-queda" : "bg-alerta-soft text-alerta"}`}>
                                  este: {fmtPct(delta)}
                                </span>
                              )}
                            </dd>
                          </div>
                        )}
                        {c.mediana_preco != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted">Mediana de preço</dt>
                            <dd className="font-medium">
                              {fmtPreco(c.mediana_preco)}
                              {deltaP != null && (
                                <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-semibold ${deltaP <= 0 ? "bg-queda-soft text-queda" : "bg-alerta-soft text-alerta"}`}>
                                  este: {fmtPct(deltaP)}
                                </span>
                              )}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {i.lat != null && i.lng != null && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">Localização</h2>
              <div className="h-72 overflow-hidden rounded-xl border border-line">
                <MapaImovel lat={i.lat} lng={i.lng} rotulo={fmtPreco(precoRef)} />
              </div>
              <p className="mt-1 text-xs text-muted">Posição informada pela imobiliária; pode ser aproximada.</p>
            </section>
          )}

          {i.historico.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">Histórico de preço</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-1 font-medium">Data</th>
                    <th className="py-1 font-medium">Venda</th>
                    <th className="py-1 font-medium">Aluguel</th>
                    <th className="py-1 font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {i.historico.map((h, k) => {
                    const ant = k > 0 ? i.historico[k - 1] : null;
                    const campo = h.preco != null && ant?.preco != null ? "preco" : "preco_aluguel";
                    const d = ant && ant[campo] && h[campo] ? (h[campo]! - ant[campo]!) / ant[campo]! : null;
                    return (
                      <tr key={h.data + k} className="border-t border-line">
                        <td className="py-1.5">{fmtData(h.data)}</td>
                        <td className="py-1.5">{h.preco != null ? fmtPreco(h.preco) : "—"}</td>
                        <td className="py-1.5">{h.preco_aluguel != null ? `${fmtPreco(h.preco_aluguel)}/mês` : "—"}</td>
                        <td className={`py-1.5 font-medium ${d == null ? "text-muted" : d < 0 ? "text-queda" : "text-alerta"}`}>
                          {d == null ? (k === 0 ? "primeiro registro" : "—") : fmtPct(d)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-muted">Só entra linha quando o preço muda entre coletas.</p>
            </section>
          )}
        </div>

        {/* Coluna lateral */}
        <aside className="lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-xl border border-line bg-card p-4">
            <LinhaPreco i={i} fin={fin} grande />
            {i.variacao != null && i.preco_anterior != null && (
              <p className={`mt-1 text-sm ${i.variacao < 0 ? "text-queda" : "text-alerta"}`}>
                {i.variacao < 0 ? "Baixou" : "Subiu"} {fmtPct(Math.abs(i.variacao))} · era {fmtPreco(i.preco_anterior)}
              </p>
            )}
            {i.desconto != null && Math.abs(i.desconto) >= 0.05 && i.ref_m2 != null && (
              <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-sm ${i.desconto > 0 ? "bg-queda-soft text-queda" : "bg-alerta-soft text-alerta"}`}>
                R$/m² <strong>{fmtPct(-i.desconto).replace("+", "")} {i.desconto > 0 ? "abaixo" : "acima"}</strong> da mediana {i.ref_escopo === "bairro" ? "do bairro" : "da cidade"} ({fmtM2(i.ref_m2)}, {i.ref_n} anúncios parecidos)
              </p>
            )}
            {i.finalidade === "venda_aluguel" && i.preco != null && i.preco_aluguel != null && (
              <p className="mt-1 text-sm text-muted">ou {fmtPreco(i.preco_aluguel)}/mês no aluguel</p>
            )}
            <dl className="mt-3 space-y-1 text-sm">
              {i.condominio != null && (
                <div className="flex justify-between"><dt className="text-muted">Condomínio</dt><dd>{fmtPreco(i.condominio)}/mês</dd></div>
              )}
              {i.iptu != null && (
                <div className="flex justify-between"><dt className="text-muted">IPTU</dt><dd>{fmtPreco(i.iptu)}</dd></div>
              )}
              {i.codigo && (
                <div className="flex justify-between"><dt className="text-muted">Referência</dt><dd className="font-mono text-xs">{i.codigo}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-muted">Visto pela última vez</dt><dd>{fmtDataHora(i.visto_em)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">No catálogo desde</dt><dd>{fmtData(i.criado_em)}</dd></div>
            </dl>
            <a
              href={i.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg transition hover:opacity-90"
            >
              Ver anúncio na {i.imobiliaria} <Externo />
            </a>
            <div className="mt-2 flex items-center justify-between gap-2">
              <a href={i.imobiliaria_site} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted hover:text-fg">
                {i.imobiliaria_site.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
              <BotaoFavorito id={i.id} grande />
            </div>
          </div>
          {i.bairro && (
            <Link href={buscaBairro} className="mt-3 block rounded-xl border border-line bg-card p-3 text-sm hover:border-accent/60">
              Ver outros {rotuloTipo(i.tipo).toLowerCase()}s {fin === "aluguel" ? "para alugar" : "à venda"} no {i.bairro} →
            </Link>
          )}
        </aside>
      </div>

      {i.similares.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Parecidos com este</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {i.similares.map((s) => (
              <CardImovel key={s.id} imovel={s} fin={fin} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
