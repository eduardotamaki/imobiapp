import { NextResponse, type NextRequest } from "next/server";

const COOKIE_SESSAO = "imobiapp_sessao";

/**
 * Sem cookie de sessão, nada do painel abre: manda para o login guardando o
 * destino. A validação de verdade (sessão existe e não venceu) acontece no
 * layout do painel, que tem acesso ao banco.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/painel/entrar") return NextResponse.next();
  if (!req.cookies.get(COOKIE_SESSAO)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/painel/entrar";
    url.search = `?destino=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*"],
};
