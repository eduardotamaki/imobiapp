import type { NextRequest } from "next/server";
import { resumo } from "@/lib/catalogo";
import { norm } from "@/lib/normalize";
import type { Finalidade } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fin = sp.get("fin");
  return Response.json(
    resumo(norm(sp.get("cidade")), fin === "aluguel" || fin === "todos" ? (fin as Finalidade) : "venda"),
  );
}
