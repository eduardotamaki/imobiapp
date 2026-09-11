"""Tecimob. Next.js com JSON-LD completo na pagina de detalhe."""
from __future__ import annotations

import re

from .. import normalize as nz
from ..base import Scraper
from . import comum, schemaorg

ROTULOS_FICHA = {
    "area_total": r"[áa]rea total|[áa]rea do terreno",
    "area_util": r"[áa]rea [úu]til|[áa]rea privativa|[áa]rea constru[íi]da",
    "quartos": r"dormit[óo]rios?|quartos?",
    "suites": r"su[íi]tes?",
    "banheiros": r"banheiros?",
    "vagas": r"vagas?|garagens?",
    "condominio": r"condom[íi]nio",
    "iptu": r"iptu",
}


class Tecimob(Scraper):
    plataforma = "tecimob"

    def listar_urls(self):
        return comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imovel/")

    def extrair(self, url, html):
        d = schemaorg.acha_listing(html)
        item = (schemaorg.para_imovel(d, url, html) if d
                else {"url": url, "titulo": nz.titulo(comum.metas(html).get("og:title"))})

        # A "Ficha do imóvel" tem o que o JSON-LD nao traz (area, vagas, IPTU).
        ficha = comum.bloco_ficha(html, ROTULOS_FICHA, 1200) or ""
        campos = comum.rotulos(ficha, ROTULOS_FICHA)
        for campo, conv in (("area_total", nz.area), ("area_util", nz.area),
                            ("quartos", nz.inteiro), ("suites", nz.inteiro),
                            ("banheiros", nz.inteiro), ("vagas", nz.inteiro),
                            ("condominio", nz.preco_estrito), ("iptu", nz.preco_estrito)):
            if not item.get(campo) and campos.get(campo):
                item[campo] = conv(campos[campo])

        item.setdefault("finalidade", nz.finalidade(url, item.get("titulo") or ""))
        return schemaorg.completa_pelo_texto(item, html)
