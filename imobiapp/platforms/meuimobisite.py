"""MeuImobiSite (meuimobisite.com.br) - usado pela Real Tiengo.

Sem dado estruturado: os campos ficam num bloco de texto corrido
(".boxrightinfo") no formato "Rotulo: valor" misturado com "Dependencias:
2 Quartos (1 Suite), 2 Banheiros".
"""
from __future__ import annotations

import re

from .. import normalize as nz
from ..base import Scraper
from ..htmlx import parse
from . import comum

ROTULOS = {
    "endereco": r"endere[çc]o",
    "preco": r"venda",
    "preco_aluguel": r"loca[çc][ãa]o|aluguel",
    "condominio": r"condom[íi]nio",
    "iptu": r"iptu",
    "area_util": r"[áa]rea [úu]til|[áa]rea constru[íi]da",
    "area_total": r"[áa]rea total|[áa]rea do terreno",
    "_outros": r"depend[êe]ncias|detalhes|c[óo]digo do im[óo]vel|ver no mapa",
}


class MeuImobiSite(Scraper):
    plataforma = "meuimobisite"

    def listar_urls(self):
        return comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imovel/\d+")

    def extrair(self, url, html):
        doc = parse(html)
        meta = comum.metas(html)
        h1 = doc.select_one("h1")
        titulo = (h1.text() if h1 else None) or meta.get("og:title")

        info = (doc.select_one(".boxrightinfo").text()
                if doc.select_one(".boxrightinfo") else "")
        campos = comum.rotulos(info, ROTULOS)

        def conta(padrao):
            m = re.search(padrao, info, re.I)
            return nz.inteiro(m.group(1)) if m else None

        detalhes = doc.select_one(".boxfora")
        caracteristicas = []
        if detalhes:
            bruto = re.sub(r"^Detalhes:\s*", "", detalhes.text(), flags=re.I)
            caracteristicas = [c for c in re.split(r"\s{2,}|,", bruto) if 2 < len(c) < 40]

        fin = nz.finalidade(titulo or "", url)
        fotos = comum.fotos_por_regex(
            html, url, r"https?://[\w.-]*meuimobisite[\w.-]*/[\w./-]+\.(?:jpe?g|png|webp)")

        # "Praia Grande, Ubatuba - SP" na segunda linha do bloco.
        bairro = cidade = None
        m = re.search(r"([^,\n]+),\s*([^,\n-]+?)\s*-\s*[A-Z]{2}", info)
        if m:
            # Vem colado no cabecalho ("APARTAMENTO A VENDA Praia Grande").
            bairro = re.sub(r"^.*?(?:VENDA|LOCA[ÇC][ÃA]O|ALUGUEL)\s+", "", m.group(1))
            cidade = m.group(2)

        return {
            "url": url,
            "codigo": _codigo_da_url(url),
            "finalidade": fin,
            "tipo": nz.tipo_imovel(titulo or "", url),
            "titulo": nz.titulo(titulo),
            "descricao": nz.limpa(meta.get("og:description") or meta.get("description")),
            "preco": nz.preco_estrito(campos.get("preco")),
            "preco_aluguel": nz.preco_estrito(campos.get("preco_aluguel")),
            "condominio": nz.preco_estrito(campos.get("condominio")),
            "iptu": nz.preco_estrito(campos.get("iptu")),
            "area_total": nz.area(campos.get("area_total")),
            "area_util": nz.area(campos.get("area_util")),
            "quartos": conta(r"(\d+)\s*Quartos?"),
            "suites": conta(r"\((\d+)\s*Su[íi]te"),
            "banheiros": conta(r"(\d+)\s*Banheiros?"),
            "vagas": conta(r"(\d+)\s*(?:Vagas?|Garagens?)"),
            "endereco": _sem_consulte(campos.get("endereco")),
            "bairro": nz.bairro(bairro),
            "cidade": nz.cidade(cidade),
            "uf": nz.uf(info),
            "foto_capa": meta.get("og:image") or (fotos[0] if fotos else None),
            "fotos": fotos,
            "caracteristicas": caracteristicas,
        }


def _sem_consulte(v):
    """O template escreve "Consulte-nos!" onde o dado nao e publico."""
    v = nz.limpa(v)
    return None if not v or re.search(r"consulte|sob consulta|a combinar", v, re.I) else v


def _codigo_da_url(url: str) -> str | None:
    m = re.search(r"/imovel/(\d+)", url)
    return m.group(1) if m else None
