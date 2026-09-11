import type { Metadata } from "next";
import Link from "next/link";
import { descreveAuditoria } from "@/components/painel/auditoria";
import { PaginacaoLinks, Titulo, Vazio, cls } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { fmtDataHora } from "@/lib/format";
import { listaAuditoria } from "@/lib/painel";

export const metadata: Metadata = { title: "Atividade" };

export default async function Atividade({ searchParams }: PageProps<"/painel/atividade">) {
  const e = (await escopoAtual())!;
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const r = listaAuditoria(e.imobiliaria?.id ?? null, pagina);
  return (
    <>
      <Titulo sub="Tudo que foi feito pelo painel: quem, quando e o quê. A coleta automática não entra aqui.">Atividade</Titulo>
      {r.itens.length ? (
        <div className={`${cls.cartao} overflow-x-auto`}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-2 py-2 font-medium">Quem</th>
                {!e.imobiliaria && <th className="px-2 py-2 font-medium">Imobiliária</th>}
                <th className="px-2 py-2 font-medium">O quê</th>
                <th className="px-2 py-2 font-medium">Imóvel</th>
              </tr>
            </thead>
            <tbody>
              {r.itens.map((a) => (
                <tr key={a.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDataHora(a.criado_em)}</td>
                  <td className="px-2 py-2">{a.usuario ?? <span className="text-muted">sistema</span>}</td>
                  {!e.imobiliaria && <td className="px-2 py-2 text-muted">{a.imobiliaria ?? "—"}</td>}
                  <td className="px-2 py-2">{descreveAuditoria(a)}</td>
                  <td className="px-2 py-2">
                    {a.imovel_id ? (
                      <Link href={`/painel/imoveis/${a.imovel_id}`} className="text-accent hover:underline">
                        {a.imovel_codigo ? `ref. ${a.imovel_codigo}` : `#${a.imovel_id}`}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vazio>Nenhuma atividade registrada ainda.</Vazio>
      )}
      <PaginacaoLinks pagina={pagina} paginas={r.paginas} base={new URLSearchParams()} />
    </>
  );
}
