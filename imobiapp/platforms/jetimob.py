"""Jetimob.

Next.js sem HTML renderizado no servidor: o conteudo chega no payload de
hidratacao (React Server Components), onde o JSON-LD aparece com as aspas
escapadas. Basta desescapar e recortar o objeto.
"""
from __future__ import annotations

import json
import re

from ..base import Scraper
from . import comum, schemaorg


class Jetimob(Scraper):
    plataforma = "jetimob"

    def listar_urls(self):
        return comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imovel/")

    def extrair(self, url, html):
        d = schemaorg.acha_listing(html) or _do_payload(html)
        if not d:
            return None
        item = schemaorg.para_imovel(d, url, html)
        return schemaorg.completa_pelo_texto(item, html)


# O objeto do imovel nem sempre declara "@type": no Jetimob ele se
# identifica por "additionalType": ".../OfferCatalog". Entao ancora-se em
# campos que so existem num anuncio.
_ANCORAS = (
    r'"@type"\s*:\s*"(?:RealEstateListing|Product|Residence|House|Apartment)"',
    r'"numberOfBedrooms"\s*:',
    r'"offers"\s*:\s*\{\s*"@type"\s*:\s*"Offer"',
)


def _do_payload(html: str) -> dict | None:
    texto = html.replace('\\"', '"')
    for m in re.finditer("|".join(_ANCORAS), texto):
        bruto = _objeto_em_volta(texto, m.start())
        if not bruto:
            continue
        try:
            d = json.loads(bruto)
        except json.JSONDecodeError:
            continue
        if d.get("offers") or d.get("numberOfBedrooms") is not None:
            return d
    return None


def _objeto_em_volta(texto: str, pos: int) -> str | None:
    """Recorta o objeto JSON balanceado que contem a posicao dada."""
    ini = texto.rfind("{", 0, pos)
    while ini >= 0:
        profundidade, dentro_str, escapa = 0, False, False
        for i in range(ini, min(len(texto), ini + 200_000)):
            c = texto[i]
            if escapa:
                escapa = False
            elif c == "\\":
                escapa = True
            elif c == '"':
                dentro_str = not dentro_str
            elif not dentro_str:
                if c == "{":
                    profundidade += 1
                elif c == "}":
                    profundidade -= 1
                    if profundidade == 0:
                        return texto[ini:i + 1] if i > pos else None
        ini = texto.rfind("{", 0, ini)
    return None
