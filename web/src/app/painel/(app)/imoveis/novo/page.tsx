import type { Metadata } from "next";
import Link from "next/link";
import FormImovel from "@/components/painel/FormImovel";
import { Aviso, Titulo } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { bairrosConhecidos, caracteristicasComuns } from "@/lib/painel";
import { salvarImovel } from "../../../acoes";

export const metadata: Metadata = { title: "Novo imóvel" };

export default async function NovoImovel() {
  const e = (await escopoAtual())!;
  if (e.admin && !e.imobiliaria) {
    return (
      <>
        <Titulo>Novo imóvel</Titulo>
        <Aviso tipo="info">Escolha uma imobiliária no seletor da barra lateral para cadastrar um anúncio em nome dela.</Aviso>
      </>
    );
  }
  return (
    <>
      <Titulo sub={`Anúncio cadastrado manualmente em nome de ${e.imobiliaria!.nome}. Fica no ar assim que salvar com status "No ar".`}>
        Novo imóvel
      </Titulo>
      <p className="mb-4 text-sm text-muted">
        <Link href="/painel/imoveis" className="hover:text-fg">← voltar à lista</Link>
      </p>
      <FormImovel imovel={null} acao={salvarImovel} bairros={bairrosConhecidos()} caracteristicasSugeridas={caracteristicasComuns(e.imobiliaria!.id)} imobiliariaId={e.imobiliaria!.id} />
    </>
  );
}
