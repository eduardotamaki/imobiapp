import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import FormEntrar from "@/components/painel/FormEntrar";
import { Casa } from "@/components/Icones";
import { existeAlgumUsuario, sessaoAtual } from "@/lib/auth";
import { criarPrimeiroAdmin, entrar } from "../acoes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar no painel" };

export default async function Entrar({ searchParams }: PageProps<"/painel/entrar">) {
  const sp = await searchParams;
  if (await sessaoAtual()) redirect("/painel");
  const primeiro = !existeAlgumUsuario();
  const destino = typeof sp.destino === "string" ? sp.destino : undefined;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-semibold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-fg">
            <Casa width={20} height={20} />
          </span>
          imobiapp
        </Link>
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{primeiro ? "Primeiro acesso" : "Painel da imobiliária"}</h1>
          <p className="mb-5 mt-1 text-sm text-muted">
            {primeiro
              ? "Ainda não há usuários. Crie a conta do administrador, que depois cadastra as imobiliárias e seus usuários."
              : "Entre para gerenciar seus anúncios, leads e dados da imobiliária."}
          </p>
          <FormEntrar acao={primeiro ? criarPrimeiroAdmin : entrar} destino={destino} primeiroAcesso={primeiro} />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/" className="hover:text-fg">← voltar ao site</Link>
        </p>
      </div>
    </main>
  );
}
