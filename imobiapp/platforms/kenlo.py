"""Kenlo / inGaia.

Site renderizado no cliente: nao ha link de imovel no HTML. O caminho e o
sitemap, que lista as paginas de busca, e cada busca traz um ItemList em
JSON-LD com os anuncios daquela pagina.
"""
from __future__ import annotations

from .. import normalize as nz
from ..base import Scraper
from . import comum, schemaorg


class Kenlo(Scraper):
    plataforma = "kenlo"
    max_paginas = 25

    def listar_urls(self):
        buscas = comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imoveis/")
        urls: list[str] = []
        vistos: set[str] = set()
        for busca in buscas:
            for pagina in range(1, self.max_paginas + 1):
                alvo = busca if pagina == 1 else f"{busca}?pagina={pagina}"
                html = self.s.get(alvo)
                if not html:
                    break
                lista = comum.jsonld_tipo(html, "ItemList")
                itens = (lista or {}).get("itemListElement") or []
                novos = []
                for e in itens:
                    u = ((e or {}).get("item") or {}).get("url")
                    if u and u not in vistos:
                        vistos.add(u)
                        novos.append(u)
                urls += novos
                if not novos:
                    break
        return urls

    def extrair(self, url, html):
        d = schemaorg.acha_listing(html)
        if not d:
            return None
        item = schemaorg.para_imovel(d, d.get("url") or url, html)
        if not item.get("bairro"):
            item["bairro"] = _bairro_do_breadcrumb(html, item.get("cidade"))
        return schemaorg.completa_pelo_texto(item, html)


def _bairro_do_breadcrumb(html: str, cidade: str | None) -> str | None:
    """O JSON-LD do imovel nao traz bairro, mas a trilha traz:
    Home > Imoveis > A venda > Loft > Itajuba > Cruzeiro > <titulo>.

    So aceita o ultimo nivel como bairro quando o anterior e a cidade do
    anuncio; sem isso, uma trilha curta faria a cidade virar bairro.
    """
    trilha = comum.jsonld_tipo(html, "BreadcrumbList")
    if not trilha or not cidade:
        return None
    nomes = [nz.limpa((e.get("item") or {}).get("name")) for e in trilha.get("itemListElement") or []]
    nomes = [n for n in nomes if n][:-1]      # o ultimo e o titulo do anuncio
    if len(nomes) >= 2 and nz.slug(nomes[-2]) == nz.slug(cidade):
        return nz.bairro(nomes[-1])
    return None
