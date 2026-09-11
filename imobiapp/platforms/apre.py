"""Apre (apre.me) - o site da Colibri roda nessa plataforma.

Tem JSON-LD de RealEstateListing e ainda uma ficha tecnica em texto com os
campos que o JSON-LD deixa de fora.
"""
from __future__ import annotations

from .. import normalize as nz
from ..base import Scraper
from . import comum, schemaorg

ROTULOS = {
    "codigo": r"refer[êe]ncia",
    "area_total": r"[áa]rea total|[áa]rea do terreno",
    "area_util": r"[áa]rea [úu]til|[áa]rea privativa|[áa]rea constru[íi]da",
    "quartos": r"quartos?|dormit[óo]rios?",
    "suites": r"su[íi]tes?",
    "banheiros": r"banheiros?",
    "vagas": r"vagas?|garagens?",
    "condominio": r"condom[íi]nio",
    "iptu": r"iptu",
    "_outros": r"sala|mob[íi]lias?|tipo de im[óo]vel|[úu]ltima atualiza",
}


class Apre(Scraper):
    plataforma = "apre"
    max_paginas = 40

    def listar_urls(self):
        # O sitemap lista as paginas de busca por tipo; cada uma pagina os
        # anuncios e devolve os links no proprio HTML.
        buscas = comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imoveis/")
        urls: list[str] = []
        vistos: set[str] = set()
        for busca in buscas:
            for pagina in range(1, self.max_paginas + 1):
                alvo = busca if pagina == 1 else f"{busca}?pagina={pagina}"
                html = self.s.get(alvo)
                if not html:
                    break
                achados = [
                    u for u in comum.links(html, alvo, r"-venda-|-aluguel-|-locacao-|/imovel/")
                    if "whatsapp" not in u and "?" not in u
                ]
                novos = [u for u in achados if u not in vistos]
                if not novos:
                    break
                vistos.update(novos)
                urls += novos
        return urls

    def extrair(self, url, html):
        d = schemaorg.acha_listing(html)
        item = (schemaorg.para_imovel(d, url, html) if d
                else {"url": url, "titulo": nz.titulo(comum.metas(html).get("og:title"))})

        ficha = comum.bloco_ficha(html, ROTULOS, 1200) or ""
        campos = comum.rotulos(ficha, ROTULOS)
        if campos.get("codigo"):
            item["codigo"] = nz.limpa(campos["codigo"].split()[0])
        for campo, conv in (("area_total", nz.area), ("area_util", nz.area),
                            ("quartos", nz.inteiro), ("suites", nz.inteiro),
                            ("banheiros", nz.inteiro), ("vagas", nz.inteiro),
                            ("condominio", nz.preco_estrito), ("iptu", nz.preco_estrito)):
            if not item.get(campo) and campos.get(campo):
                item[campo] = conv(campos[campo])

        item.setdefault("finalidade", nz.finalidade(url, item.get("titulo") or ""))
        return schemaorg.completa_pelo_texto(item, html)
