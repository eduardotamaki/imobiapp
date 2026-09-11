import type { NextRequest } from "next/server";
import { sugestoes } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return Response.json({ sugestoes: sugestoes(q.slice(0, 80)) });
}
