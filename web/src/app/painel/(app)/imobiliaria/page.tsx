import type { Metadata } from "next";
import Link from "next/link";
import FormImobiliaria from "@/components/painel/FormImobiliaria";
import FormSimples from "@/components/painel/FormSimples";
import { Campo, Titulo, cls } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { fmtDataHora, fmtNum } from "@/lib/format";
import { imobiliariaCompleta, listaImobiliarias } from "@/lib/painel";
import { criarImobiliaria, salvarImobiliaria } from "../../acoes";

export const metadata: Metadata = { title: "Imobiliária" };

export default async function Imobiliaria() {
  const e = (await escopoAtual())!;
  if (e.imobiliaria) {
    const imob = imobiliariaCompleta(e.imobiliaria.id)!;
    return (
      <>
        <Titulo sub={`${fmtNum(imob.n_imoveis)} anúncios no ar · ${fmtNum(imob.n_usuarios)} usuários · ${imob.plataforma ? `coleta via ${imob.plataforma}` : "sem coleta automática"}`}>
          {imob.nome}
        </Titulo>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <FormImobiliaria imob={imob} acao={salvarImobiliaria} />
          <aside className={`${cls.cartao} h-fit p-4 text-sm`}>
            <h2 className="font-semibold">Como aparece no site</h2>
            <p className="mt-1 text-muted">O WhatsApp e o telefone viram botões de contato em cada anúncio seu. O formulário de contato cai em Leads.</p>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-2"><dt className="text-muted">Identificador</dt><dd className="font-mono text-xs">{imob.slug}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Última coleta</dt><dd>{fmtDataHora(imob.ultima_coleta)}</dd></div>
            </dl>
            <Link href={`/?imob=${imob.slug}&fin=todos`} className={`${cls.botao} ${cls.secundario} mt-3 w-full`}>Ver meus anúncios no site</Link>
          </aside>
        </div>
      </>
    );
  }

  const lista = listaImobiliarias();
  return (
    <>
      <Titulo sub="Escolha uma imobiliária no seletor da barra lateral para editar os dados dela.">Imobiliárias</Titulo>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${cls.cartao} overflow-x-auto`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">Contato</th>
                <th className="px-2 py-2 text-right font-medium">No ar</th>
                <th className="px-2 py-2 text-right font-medium">Usuários</th>
                <th className="px-2 py-2 font-medium">Coleta</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <div className="font-medium">{m.nome}</div>
                    <div className="font-mono text-[11px] text-muted">{m.slug}</div>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted">{[m.whatsapp && `WhatsApp ${m.whatsapp}`, m.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-2 py-2 text-right">{fmtNum(m.n_imoveis)}</td>
                  <td className="px-2 py-2 text-right">{fmtNum(m.n_usuarios)}</td>
                  <td className="px-2 py-2 text-xs text-muted">{m.plataforma ?? (m.status === "sem_scraper" ? "manual" : m.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className={`${cls.cartao} h-fit p-4`}>
          <h2 className="font-semibold">Nova imobiliária</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">Para quem não tem site coletado: os anúncios são cadastrados pelo painel.</p>
          <FormSimples acao={criarImobiliaria} rotuloBotao="Criar" limparAoSalvar>
            <Campo rotulo="Nome"><input name="nome" required className={cls.input} maxLength={120} /></Campo>
            <Campo rotulo="Site (opcional)"><input name="site" className={cls.input} placeholder="https://" maxLength={300} /></Campo>
          </FormSimples>
        </section>
      </div>
    </>
  );
}
