import { Suspense } from "react";
import Busca from "@/components/Busca";
import { buscar, mapa, parseFiltros } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const filtros = parseFiltros(sp);
  const resultado = buscar(filtros);
  const pontos = filtros.vista === "mapa" ? mapa(filtros) : null;
  return (
    <Suspense>
      <Busca filtros={filtros} resultado={resultado} pontos={pontos} />
    </Suspense>
  );
}
