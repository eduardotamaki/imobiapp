import { redirect } from "next/navigation";
import Sidebar, { type ItemNav } from "@/components/painel/Sidebar";
import SeletorImobiliaria from "@/components/painel/SeletorImobiliaria";
import { escopoAtual } from "@/lib/auth";
import { conexao } from "@/lib/db";
import { listaImobiliarias } from "@/lib/painel";
import { escolherImobiliaria, sair } from "../acoes";

export const dynamic = "force-dynamic";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const e = await escopoAtual();
  if (!e) redirect("/painel/entrar");
  const imobId = e.imobiliaria?.id ?? null;
  const leadsNovos = (
    conexao()
      .prepare(`SELECT COUNT(*) AS n FROM leads WHERE status = 'novo' ${imobId == null ? "" : "AND imobiliaria_id = ?"}`)
      .get(...(imobId == null ? [] : [imobId])) as { n: number }
  ).n;

  const itens: ItemNav[] = [
    { href: "/painel", rotulo: "Início", icone: "inicio" },
    { href: "/painel/imoveis", rotulo: "Imóveis", icone: "imoveis" },
    { href: "/painel/leads", rotulo: "Leads", icone: "leads", badge: leadsNovos },
    { href: "/painel/imobiliaria", rotulo: e.admin && !e.imobiliaria ? "Imobiliárias" : "Imobiliária", icone: "imobiliaria" },
    { href: "/painel/usuarios", rotulo: "Usuários", icone: "usuarios" },
    { href: "/painel/atividade", rotulo: "Atividade", icone: "atividade" },
  ];

  const seletor = e.admin ? (
    <SeletorImobiliaria opcoes={listaImobiliarias().map((m) => ({ id: m.id, nome: m.nome }))} atual={imobId} acao={escolherImobiliaria} />
  ) : null;

  const botaoSair = (
    <form action={sair}>
      <button type="submit" className="rounded-full border border-line px-2.5 py-1.5 text-xs text-muted transition hover:bg-soft hover:text-fg">
        Sair
      </button>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <Sidebar
        itens={itens}
        usuario={{ nome: e.usuario.nome, email: e.usuario.email }}
        contexto={e.imobiliaria?.nome ?? "Todas as imobiliárias"}
        seletor={seletor}
        sair={botaoSair}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-5 lg:px-8 lg:py-7">{children}</div>
      </div>
    </div>
  );
}
