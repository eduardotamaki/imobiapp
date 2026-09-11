import type { Metadata } from "next";
import Link from "next/link";
import CardImovel from "@/components/CardImovel";
import SeletorPanorama from "@/components/SeletorPanorama";
import { cidades, resumo } from "@/lib/catalogo";
import { fmtDataHora, fmtM2, fmtNum, fmtPreco, rotuloTipo } from "@/lib/format";
import { norm } from "@/lib/normalize";
import type { Finalidade } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panorama do mercado" };

function Barra({ v, max, classe = "bg-accent" }: { v: number; max: number; classe?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
      <div className={`h-full rounded-full ${classe}`} style={{ width: `${max ? Math.max(2, (v / max) * 100) : 0}%` }} />
    </div>
  );
}

function Kpi({ rotulo, valor, sub, href }: { rotulo: string; valor: string; sub?: string; href?: string }) {
  const corpo = (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{valor}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{corpo}</Link> : corpo;
}

export default async function Panorama({ searchParams }: PageProps<"/panorama">) {
  const sp = await searchParams;
  const finBruta = typeof sp.fin === "string" ? sp.fin : "venda";
  const fin: Finalidade = finBruta === "aluguel" ? "aluguel" : "venda";
  const lista = cidades();
  const cidadeChave = (typeof sp.cidade === "string" ? norm(sp.cidade) : null) ?? "itajuba";
  const r = resumo(cidadeChave, fin);
  const nomeCidade = lista.find((c) => c.chave === cidadeChave)?.nome ?? cidadeChave;
  const qsBase = `${fin === "aluguel" ? "fin=aluguel&" : ""}cidade=${encodeURIComponent(cidadeChave)}`;
  const maxBairro = Math.max(...r.porBairro.map((b) => b.n), 1);
  const maxFaixa = Math.max(...r.faixas.map((f) => f.n), 1);
  const maxTipo = Math.max(...r.porTipo.map((t) => t.n), 1);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panorama do mercado</h1>
          <p className="text-sm text-muted">
            {fmtNum(r.geral.disponiveis)} anúncios ativos em {r.geral.imobiliarias} imobiliárias · última coleta {fmtDataHora(r.geral.ultimaColeta)}
          </p>
        </div>
        <SeletorPanorama cidades={lista} cidade={cidadeChave} fin={fin} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi rotulo="Anúncios ativos" valor={fmtNum(r.geral.disponiveis)} sub={`${fmtNum(r.geral.comPreco)} com preço`} href="/?fin=todos" />
        <Kpi rotulo="Baixaram de preço" valor={fmtNum(r.geral.quedas)} sub="desde a coleta anterior" href="/?fin=todos&baixou=1&ordem=baixou" />
        <Kpi rotulo="Abaixo da mediana" valor={fmtNum(r.geral.oportunidades)} sub="R$/m² 10% ou mais abaixo do bairro" href={`/?${qsBase}&oportunidade=1&ordem=oportunidade`} />
        <Kpi rotulo="Novos (7 dias)" valor={fmtNum(r.geral.novos)} sub="entraram no catálogo" href="/?fin=todos&novos=1" />
        <Kpi rotulo="Já catalogados" valor={fmtNum(r.geral.total)} sub="incluindo os que saíram do ar" href="/?fin=todos&removidos=1" />
      </div>

      {r.quedas.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Maiores quedas de preço</h2>
            <Link href="/?fin=todos&baixou=1&ordem=baixou" className="text-sm text-accent hover:underline">ver todas</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {r.quedas.slice(0, 4).map((i) => (
              <CardImovel key={i.id} imovel={i} fin="todos" />
            ))}
          </div>
        </section>
      )}

      {r.oportunidades.length > 0 && (
        <section className="mt-8">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Abaixo da mediana do bairro</h2>
            <Link href={`/?${qsBase}&oportunidade=1&ordem=oportunidade`} className="text-sm text-accent hover:underline">ver todos</Link>
          </div>
          <p className="mb-3 text-xs text-muted">R$/m² pelo menos 10% abaixo da mediana de anúncios do mesmo tipo no mesmo bairro. Vale conferir área e estado do imóvel no anúncio.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {r.oportunidades.slice(0, 4).map((i, k) => (
              <CardImovel key={i.id} imovel={i} fin={fin} indice={k} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">Por tipo · {nomeCidade}, {fin === "aluguel" ? "aluguel" : "venda"}</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="pb-1 font-medium">Tipo</th><th className="pb-1 font-medium">Anúncios</th><th className="pb-1 text-right font-medium">Mediana</th><th className="pb-1 text-right font-medium">R$/m²</th></tr>
            </thead>
            <tbody>
              {r.porTipo.map((t) => (
                <tr key={t.tipo} className="border-t border-line">
                  <td className="py-1.5"><Link href={`/?${qsBase}${t.tipo !== "outro" ? `&tipo=${t.tipo}` : ""}`} className="hover:text-accent">{rotuloTipo(t.tipo === "outro" ? null : t.tipo)}</Link></td>
                  <td className="w-1/3 py-1.5"><div className="flex items-center gap-2"><Barra v={t.n} max={maxTipo} /><span className="w-10 text-right tabular-nums">{fmtNum(t.n)}</span></div></td>
                  <td className="py-1.5 text-right tabular-nums">{t.mediana != null ? fmtPreco(t.mediana) : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{t.mediana_m2 != null ? fmtM2(t.mediana_m2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">Faixas de preço</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {r.faixas.map((f) => (
              <li key={f.rotulo} className="grid grid-cols-[130px_1fr_48px] items-center gap-2">
                <span className="text-muted">{f.rotulo}</span>
                <Barra v={f.n} max={maxFaixa} />
                <span className="text-right tabular-nums">{fmtNum(f.n)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Por bairro · {nomeCidade}</h2>
        <p className="text-xs text-muted">Mediana de preço e de R$/m² entre os anúncios com valor informado. Clique para abrir a busca no bairro.</p>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-1 font-medium">Bairro</th>
                <th className="pb-1 font-medium">Anúncios</th>
                <th className="pb-1 text-right font-medium">Casas</th>
                <th className="pb-1 text-right font-medium">Aptos</th>
                <th className="pb-1 text-right font-medium">Terrenos</th>
                <th className="pb-1 text-right font-medium">Mediana</th>
                <th className="pb-1 text-right font-medium">R$/m²</th>
              </tr>
            </thead>
            <tbody>
              {r.porBairro.map((b) => (
                <tr key={b.chave} className="border-t border-line">
                  <td className="py-1.5"><Link href={`/?${qsBase}&bairro=${encodeURIComponent(b.chave)}`} className="hover:text-accent">{b.nome}</Link></td>
                  <td className="w-1/4 py-1.5"><div className="flex items-center gap-2"><Barra v={b.n} max={maxBairro} /><span className="w-10 text-right tabular-nums">{fmtNum(b.n)}</span></div></td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{b.casas || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{b.aptos || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{b.terrenos || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.mediana != null ? fmtPreco(b.mediana) : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.mediana_m2 != null ? fmtM2(b.mediana_m2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {r.novos.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Novos no catálogo</h2>
            <Link href="/?fin=todos&novos=1" className="text-sm text-accent hover:underline">ver todos</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {r.novos.slice(0, 4).map((i) => (
              <CardImovel key={i.id} imovel={i} fin="todos" />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Imobiliárias</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-1 font-medium">Imobiliária</th>
                <th className="pb-1 font-medium">Plataforma</th>
                <th className="pb-1 text-right font-medium">Ativos</th>
                <th className="pb-1 text-right font-medium">Com preço</th>
                <th className="pb-1 text-right font-medium">Última coleta</th>
              </tr>
            </thead>
            <tbody>
              {r.porImobiliaria.map((m) => (
                <tr key={m.slug} className="border-t border-line">
                  <td className="py-1.5">
                    {m.disponiveis ? <Link href={`/?fin=todos&imob=${m.slug}`} className="hover:text-accent">{m.nome}</Link> : <span className="text-muted">{m.nome}</span>}
                    {m.status !== "ativa" && <span className="ml-2 rounded bg-soft px-1.5 text-[11px] text-muted">{m.status}</span>}
                  </td>
                  <td className="py-1.5 text-muted">{m.plataforma ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtNum(m.disponiveis ?? 0)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{fmtNum(m.comPreco ?? 0)}</td>
                  <td className="py-1.5 text-right text-muted">{fmtDataHora(m.ultimaColeta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
