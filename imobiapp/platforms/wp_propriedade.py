"""Site WordPress com paginas /propriedade/{id}/ (Bissacot).

Template bem enxuto: o que da pra tirar vem do titulo, do texto do anuncio
e dos rotulos que existirem. Serve de base tolerante pra esse tipo de site.
"""
from __future__ import annotations

import re
from html import unescape

from .. import normalize as nz
from ..base import Scraper
from ..htmlx import parse, so_texto
from . import comum

ROTULOS = {
    "codigo": r"c[óo]digo|refer[êe]ncia",
    "preco": r"valor|pre[çc]o",
    "bairro": r"bairro",
    "cidade": r"cidade",
    "quartos": r"quartos?|dormit[óo]rios?",
    "suites": r"su[íi]tes?",
    "banheiros": r"banheiros?",
    "vagas": r"vagas?|garagens?",
    "area_util": r"[áa]rea [úu]til|[áa]rea constru[íi]da",
    "area_total": r"[áa]rea total|[áa]rea do terreno",
}


class WpPropriedade(Scraper):
    plataforma = "wordpress"
    max_paginas = 30

    def listar_urls(self):
        # A listagem vem primeiro: o sitemap desse site guarda anuncios ja
        # retirados, que respondem 200 com a pagina vazia.
        urls: list[str] = []
        vistos: set[str] = set()
        for pagina in range(1, self.max_paginas + 1):
            alvo = f"{self.site}/propriedades/" + ("" if pagina == 1 else f"page/{pagina}/")
            html = self.s.get(alvo)
            if not html:
                break
            novos = [u for u in comum.links(html, alvo, r"/propriedade/\d+") if u not in vistos]
            if not novos:
                break
            vistos.update(novos)
            urls += novos
        for u in comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/propriedade/\d+"):
            if u not in vistos:
                vistos.add(u)
                urls.append(u)
        return urls

    def extrair(self, url, html):
        doc = parse(html)
        meta = comum.metas(html)

        # "<li><b>Valor:</b> R$ 195.000,00</li>" e o formato da ficha aqui.
        pares = comum.pares_rotulados(html, "ul li")

        def par(*chaves):
            for k in chaves:
                for rotulo, valor in pares.items():
                    if re.fullmatch(k, rotulo, re.I):
                        return valor
            return None

        # O <h4> com o tipo e o bairro ("Terreno - Residencial Vista Verde")
        # e o unico titulo util: o <title> e o nome da imobiliaria.
        titulo = None
        for n in doc.select("h4"):
            t = n.text()
            if t and " - " in t and not re.search(r"contate|newsletter|R\$", t, re.I):
                titulo = t
                break

        # "Piranguinho - MG" abre o bloco de informacoes adicionais. Buscar
        # isso na pagina toda pegaria a lista de bairros do formulario.
        cidade = uf = None
        adicionais = _apos_titulo(html, r"Informa[çc][õo]es Adicionais")
        m = re.search(r"^\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ\s.'-]{2,30}?)\s*-\s*([A-Z]{2})\b",
                      adicionais or "")
        if m:
            cidade, uf = m.group(1), m.group(2)

        preco = nz.preco_estrito(par(r"valor", r"valor de venda", r"pre[çc]o"))
        aluguel = nz.preco_estrito(par(r"valor do aluguel", r"aluguel", r"loca[çc][ãa]o"))
        fin = (nz.finalidade(titulo or "", " ".join(pares))
               or ("aluguel" if aluguel else "venda" if preco else None))
        if fin == "aluguel" and preco and not aluguel:
            preco, aluguel = None, preco

        fotos = comum.fotos_por_regex(
            html, url, r"https?://[\w.-]+/(?:images/propriedades|wp-content/uploads)/[\w./-]+\.(?:jpe?g|png|webp)")
        return {
            "url": url,
            "codigo": _codigo_da_url(url),
            "finalidade": fin,
            "tipo": nz.tipo_imovel(titulo or "", par(r"tipo") or ""),
            "titulo": nz.titulo(titulo),
            "descricao": nz.limpa(adicionais),
            "preco": preco,
            "preco_aluguel": aluguel,
            "condominio": nz.preco_estrito(par(r"condom[íi]nio", r"valor do condom[íi]nio")),
            "iptu": nz.preco_estrito(par(r"iptu")),
            "area_total": nz.area(par(r"[áa]rea terreno", r"[áa]rea total", r"terreno")),
            "area_util": nz.area(par(r"[áa]rea [úu]til", r"[áa]rea constru[íi]da", r"[áa]rea")),
            "quartos": nz.inteiro(par(r"quartos?", r"dormit[óo]rios?")),
            "suites": nz.inteiro(par(r"su[íi]tes?")),
            "banheiros": nz.inteiro(par(r"banheiros?")),
            "vagas": nz.inteiro(par(r"vagas?", r"garagens?")),
            "endereco": nz.limpa(par(r"endere[çc]o", r"rua")),
            "bairro": nz.bairro(par(r"bairro")),
            "cidade": nz.cidade(cidade),
            "uf": nz.uf(uf or ""),
            "foto_capa": fotos[0] if fotos else meta.get("og:image"),
            "fotos": fotos,
        }


def _apos_titulo(html: str, padrao_titulo: str) -> str | None:
    """Texto que vem logo depois de um <h1..h4> com o titulo dado."""
    # O template escreve os titulos com entidades (Informa&ccedil;&otilde;es).
    html = unescape(html)
    m = re.search(rf"<h[1-4][^>]*>\s*{padrao_titulo}\s*</h[1-4]>(.*?)(?=<h[1-4]\b|</div>\s*</div>)",
                  html, re.S | re.I)
    return so_texto(m.group(1)) if m else None


def _codigo_da_url(url: str) -> str | None:
    m = re.search(r"/propriedade/(\d+)", url)
    return m.group(1) if m else None
