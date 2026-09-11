import type { NextRequest } from "next/server";
import { mapa, parseFiltros } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const o: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams) o[k] = v;
  return Response.json({ pontos: mapa(parseFiltros(o)) });
}
