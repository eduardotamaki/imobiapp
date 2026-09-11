"""Widesys Sistemas Web (Joomla). URLs /imoveis-venda/ e /imoveis-locacao/."""
from __future__ import annotations

import re

from .. import normalize as nz
from ..base import Scraper
from ..htmlx import parse
from . import comum

ROTULOS = {
    "codigo": r"c[óo]digo|refer[êe]ncia|ref",
    "area_total": r"[áa]rea (?:do )?terreno|[áa]rea total",
    "area_util": r"[áa]rea (?:[úu]til|constru[íi]da|privativa)",
    "quartos": r"dormit[óo]rios?|quartos?",
    "suites": r"su[íi]tes?",
    "banheiros": r"banheiros?",
    "vagas": r"vagas?|garagens?",
    "condominio": r"condom[íi]nio",
    "iptu": r"iptu",
}


class Widesys(Scraper):
    plataforma = "widesys"

    def listar_urls(self):
        return comum.urls_do_sitemap(
            self.s, f"{self.site}/sitemap.xml", r"/imoveis-(?:venda|locacao|aluguel)/\d+"
        )

    def extrair(self, url, html):
        doc = parse(html)
        meta = comum.metas(html)
        h1 = doc.select_one("h1")
        titulo = (h1.text() if h1 else None) or meta.get("og:title")

        # Preco fica num bloco com title="Valor Venda"/"Valor Locação".
        preco = aluguel = None
        for n in doc.select("[title*=Valor]"):
            valor = nz.preco(n.text())
            if not valor:
                continue
            if re.search(r"loca[çc][ãa]o|aluguel", n.attr("title", ""), re.I):
                aluguel = aluguel or valor
            else:
                preco = preco or valor

        # "Pinheirinho, Itajubá-MG, Minas Gerais" ao lado do pin do mapa.
        local = None
        for n in doc.select("span"):
            t = n.text()
            if re.search(r",\s*[\w\s]+-\s*[A-Z]{2}\b", t) and len(t) < 90:
                local = t
                break
        bairro = cidade = None
        if local:
            m = re.match(r"\s*([^,]+),\s*([^,-]+)\s*-\s*[A-Z]{2}", local)
            if m:
                bairro, cidade = m.group(1), m.group(2)

        if not (bairro and cidade):
            do_titulo = comum.local_do_titulo(titulo, meta.get("og:title"),
                                              meta.get("description"))
            bairro = bairro or do_titulo.get("bairro")
            cidade = cidade or do_titulo.get("cidade")
            local = local or do_titulo.get("cidade")

        ficha = comum.bloco_ficha(html, ROTULOS, 1200) or ""
        campos = comum.rotulos(ficha, ROTULOS)
        icones = comum.contadores_por_icone(html)

        fin = nz.finalidade(url, titulo or "")
        if fin == "aluguel" and preco and not aluguel:
            preco, aluguel = None, preco

        fotos = comum.fotos_por_regex(
            html, url, r"https?://storage\.widesys\.com\.br/[\w./+=-]+")
        return {
            "url": url,
            "codigo": nz.limpa(campos.get("codigo")) or _codigo_da_url(url),
            "finalidade": fin,
            "tipo": nz.tipo_imovel(titulo or "", url),
            "titulo": nz.titulo(titulo),
            "descricao": nz.limpa(comum.so_texto(meta.get("description") or "")),
            "preco": preco,
            "preco_aluguel": aluguel,
            "condominio": nz.preco_estrito(campos.get("condominio")),
            "iptu": nz.preco_estrito(campos.get("iptu")),
            "area_total": nz.area(campos.get("area_total")),
            "area_util": nz.area(campos.get("area_util")) or nz.area(icones.get("area_util")),
            "quartos": nz.inteiro(campos.get("quartos")) or icones.get("quartos"),
            "suites": nz.inteiro(campos.get("suites")),
            "banheiros": nz.inteiro(campos.get("banheiros")) or icones.get("banheiros"),
            "vagas": nz.inteiro(campos.get("vagas")) or icones.get("vagas"),
            "endereco": nz.limpa(local),
            "bairro": nz.bairro(bairro),
            "cidade": nz.cidade(cidade),
            "uf": nz.uf(local or ""),
            "foto_capa": meta.get("og:image") or (fotos[0] if fotos else None),
            "fotos": fotos,
        }


def _codigo_da_url(url: str) -> str | None:
    m = re.search(r"/imoveis-\w+/(\d+)", url)
    return m.group(1) if m else None
