import type { NextRequest } from "next/server";
import { buscar, csv, parseFiltros, porIds } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

function params(req: NextRequest): Record<string, string | string[] | undefined> {
  const o: Record<string, string | string[]> = {};
  for (const [k, v] of req.nextUrl.searchParams) o[k] = v;
  return o;
}

export function GET(req: NextRequest) {
  const sp = params(req);
  const ids = typeof sp.ids === "string" ? sp.ids.split(",").map(Number).filter(Number.isInteger).slice(0, 200) : null;
  if (ids) return Response.json({ itens: porIds(ids) });

  const filtros = parseFiltros(sp);
  if (sp.formato === "csv") {
    return new Response(csv(filtros), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="imoveis-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }
  return Response.json(buscar(filtros));
}
