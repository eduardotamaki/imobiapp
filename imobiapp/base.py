"""Contrato comum a todos os scrapers."""
from __future__ import annotations

import re
import traceback
from urllib.parse import urlsplit

from . import db
from .http import Sessao, absoluta


class Scraper:
    """Cada site vira uma subclasse.

    Implemente `listar_urls()` (enumera as paginas de imovel) e
    `extrair(url, html)` (devolve o dict de um imovel), ou sobrescreva
    `coletar()` quando o site entregar tudo de uma vez (ex.: uma API).
    """

    slug: str = ""
    nome: str = ""
    site: str = ""
    plataforma: str = ""
    status: str = "ativa"     # ativa | offline | sem_scraper
    obs: str | None = None

    def __init__(self, sessao: Sessao | None = None, limite: int | None = None):
        self.s = sessao or Sessao()
        self.limite = limite

    # -- a implementar --------------------------------------------------
    def listar_urls(self) -> list[str]:
        raise NotImplementedError

    def extrair(self, url: str, html: str) -> dict | None:
        raise NotImplementedError

    # -- fluxo padrao ---------------------------------------------------
    # Varios sites servem o mesmo imovel em mais de um caminho
    # (/imovel/123 e ?conteudo=fotografias&categoria=123). A URL canonica
    # declarada na propria pagina e o que impede o catalogo de duplicar.
    usar_canonica = True

    def coletar(self):
        """Gera dicts de imovel. Falha em um anuncio nao derruba a coleta."""
        urls = list(dict.fromkeys(self.listar_urls()))
        if self.limite:
            urls = urls[: self.limite]
        emitidas: set[str] = set()
        for url in urls:
            html = self.s.get(url)
            if not html:
                continue
            try:
                item = self.extrair(url, html)
            except Exception:
                if self.s.verbose:
                    traceback.print_exc()
                continue
            if not item:
                continue
            item.setdefault("url", url)
            if self.usar_canonica:
                item["url"] = self._canonica(html, item["url"])
            if item["url"] in emitidas:
                continue
            emitidas.add(item["url"])
            yield item

    @staticmethod
    def _canonica(html: str, padrao: str) -> str:
        m = re.search(
            r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', html, re.I
        ) or re.search(
            r'<meta[^>]+property=["\']og:url["\'][^>]*content=["\']([^"\']+)', html, re.I
        )
        if not m:
            return padrao
        alvo = absoluta(padrao, m.group(1).strip())
        a, b = urlsplit(alvo), urlsplit(padrao)
        # So aceita canonica do mesmo dominio e que aponte pra um imovel.
        if a.netloc.removeprefix("www.") != b.netloc.removeprefix("www.") or len(a.path) <= 1:
            return padrao
        # Nao deixa a canonica rebaixar https para http.
        if b.scheme == "https" and a.scheme == "http":
            alvo = alvo.replace("http://", "https://", 1)
        return alvo

    # -- execucao -------------------------------------------------------
    def executar(self, con) -> dict:
        with db.ESCRITA:
            imob_id = db.registra_imobiliaria(
                con, self.slug, self.nome, self.site, self.plataforma, self.status, self.obs
            )
            coleta_id, inicio = db.abre_coleta(con, imob_id)
            con.commit()
        contagem = {"encontrados": 0, "novos": 0, "atualizados": 0, "igual": 0, "removidos": 0}
        erro = None
        try:
            for item in self.coletar():
                # Transacao curta e por imovel: nada de segurar o banco
                # enquanto se espera a proxima pagina chegar da rede.
                with db.ESCRITA:
                    res = db.salva_imovel(con, imob_id, item)
                    con.commit()
                contagem["encontrados"] += 1
                contagem[{"novo": "novos", "atualizado": "atualizados"}.get(res, "igual")] += 1
            # So marca sumidos quando a coleta trouxe algo (evita zerar por site fora do ar).
            if contagem["encontrados"]:
                with db.ESCRITA:
                    contagem["removidos"] = db.marca_removidos(con, imob_id, inicio)
                    con.commit()
            ok = True
        except Exception as e:
            ok = False
            erro = f"{type(e).__name__}: {e}"
            if self.s.verbose:
                traceback.print_exc()

        with db.ESCRITA:
            db.fecha_coleta(con, coleta_id, ok, contagem["encontrados"], contagem["novos"],
                            contagem["atualizados"], contagem["removidos"], erro)
            con.execute("UPDATE imobiliarias SET ultima_coleta=? WHERE id=?",
                        (db.agora(), imob_id))
            con.commit()
        return {"slug": self.slug, "ok": ok, "erro": erro, **contagem}


class SemScraper(Scraper):
    """Site listado mas sem coleta possivel (fora do ar, sem catalogo online)."""

    status = "sem_scraper"

    def coletar(self):
        return iter(())
