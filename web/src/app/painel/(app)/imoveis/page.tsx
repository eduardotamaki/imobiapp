import type { Metadata } from "next";
import Link from "next/link";
import TabelaImoveis from "@/components/painel/TabelaImoveis";
import { PaginacaoLinks, Titulo, Vazio, cls } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { fmtNum, TIPOS } from "@/lib/format";
import { listaImoveis, parseFiltrosPainel, PROBLEMAS, STATUS_IMOVEL } from "@/lib/painel";
import { acaoEmMassa } from "../../acoes";

export const metadata: Metadata = { title: "Imóveis" };

export default async function Imoveis({ searchParams }: PageProps<"/painel/imoveis">) {
  const e = (await escopoAtual())!;
  const sp = await searchParams;
  const f = parseFiltrosPainel(sp);
  const r = listaImoveis(e.imobiliaria?.id ?? null, f);
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "pagina") base.set(k, v);
  const volta = `/painel/imoveis${base.toString() ? `?${base}` : ""}${f.pagina > 1 ? `${base.toString() ? "&" : "?"}pagina=${f.pagina}` : ""}`;
  const csv = e.imobiliaria ? `/api/imoveis?imob=${e.imobiliaria.slug}&fin=todos&removidos=1&formato=csv` : "/api/imoveis?fin=todos&removidos=1&formato=csv";
  const filtrando = !!(f.q || f.status || f.tipo || f.fin || f.problema || f.origem);

  return (
    <>
      <Titulo
        sub={`${fmtNum(r.total)} ${r.total === 1 ? "anúncio" : "anúncios"}${filtrando ? " com os filtros atuais" : " (sem os que saíram do site)"}`}
        acao={
          <>
            <a href={csv} className={`${cls.botao} ${cls.secundario}`}>Exportar CSV</a>
            <Link href="/painel/imoveis/novo" className={`${cls.botao} ${cls.primario}`}>+ Novo imóvel</Link>
          </>
        }
      >
        Imóveis
      </Titulo>

      <form method="get" className={`${cls.cartao} mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-7`}>
        <input name="q" defaultValue={f.q} placeholder="Código, título, bairro, endereço ou id" className={`${cls.input} lg:col-span-2`} aria-label="Buscar" />
        <select name="status" defaultValue={f.status} className={cls.select} aria-label="Status">
          <option value="">Ativos e pausados</option>
          {Object.entries(STATUS_IMOVEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
          <option value="todos">Todos</option>
        </select>
        <select name="tipo" defaultValue={f.tipo} className={cls.select} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="fin" defaultValue={f.fin} className={cls.select} aria-label="Finalidade">
          <option value="">Venda e aluguel</option>
          <option value="venda">Venda</option>
          <option value="aluguel">Aluguel</option>
        </select>
        <select name="problema" defaultValue={f.problema} className={cls.select} aria-label="Pendência">
          <option value="">Qualquer situação</option>
          {Object.entries(PROBLEMAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="ordem" defaultValue={f.ordem} className={cls.select} aria-label="Ordem">
          <option value="atualizado">Última alteração</option>
          <option value="criado">Mais recentes</option>
          <option value="leads">Mais leads</option>
          <option value="preco_desc">Maior preço</option>
          <option value="preco_asc">Menor preço</option>
          <option value="codigo">Código</option>
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-7">
          <select name="origem" defaultValue={f.origem} className={`${cls.select} w-auto`} aria-label="Origem">
            <option value="">Coletados e cadastrados</option>
            <option value="scraper">Só coletados do site</option>
            <option value="manual">Só cadastrados aqui</option>
          </select>
          <button type="submit" className={`${cls.botao} ${cls.primario}`}>Filtrar</button>
          {filtrando && (
            <Link href="/painel/imoveis" className={`${cls.botao} ${cls.secundario}`}>Limpar</Link>
          )}
        </div>
      </form>

      {r.itens.length ? (
        <TabelaImoveis itens={r.itens} volta={volta} acao={acaoEmMassa} mostraImobiliaria={!e.imobiliaria} />
      ) : (
        <Vazio>
          Nenhum anúncio com esses filtros.{" "}
          <Link href="/painel/imoveis/novo" className="text-accent underline-offset-2 hover:underline">Cadastrar um imóvel</Link>
        </Vazio>
      )}
      <PaginacaoLinks pagina={f.pagina} paginas={r.paginas} base={base} />
    </>
  );
}
