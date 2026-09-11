import { detalhe } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/imoveis/[id]">) {
  const { id } = await params;
  const n = Number(id);
  const d = Number.isInteger(n) ? detalhe(n) : null;
  if (!d) return Response.json({ erro: "imóvel não encontrado" }, { status: 404 });
  return Response.json(d);
}
