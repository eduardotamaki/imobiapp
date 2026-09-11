"""Template "/detalhes_imovel/{id}" (Itajuba Imoveis, Uai Imoveis).

Os dados vem em secoes rotuladas (DESCRICAO / COMODOS / MEDIDAS), cada item
como "<span>Rotulo</span> <b>valor</b>", e o og:title resume tipo, finalidade,
bairro, cidade e codigo.
"""
from __future__ import annotations

import re

from .. import normalize as nz
from ..base import Scraper
from ..htmlx import parse
from . import comum

# "Locação - Casa (Sobrado Padrão) - Centro - Itajubá/MG - Cod. 1500"
_RE_TITULO = re.compile(
    r"^(?P<fin>Venda|Loca[çc][ãa]o|Aluguel)\s*-\s*(?P<tipo>[^-]+?)\s*-\s*"
    r"(?P<bairro>[^-]+?)\s*-\s*(?P<cidade>[^/]+?)\s*/\s*(?P<uf>[A-Z]{2})"
    r"(?:\s*-\s*Cod\.?\s*(?P<cod>\S+))?",
    re.I,
)
_CAMPOS = {
    "quartos": r"dormit[óo]rios?|quartos?",
    "suites": r"su[íi]tes?",
    "banheiros": r"banheiros?|lavabos?",
    "vagas": r"vagas?|garagens?",
    "area_total": r"[áa]rea (?:do )?terreno|[áa]rea total",
    "area_util": r"[áa]rea (?:[úu]til|constru[íi]da|privativa)",
}


class DetalheImovel(Scraper):
    plataforma = "detalhes_imovel"
    max_paginas = 40
    listagens = ("/imoveis/Venda", "/imoveis/Locacao")

    def listar_urls(self):
        vistos: list[str] = []
        for caminho in self.listagens:
            for pagina in range(1, self.max_paginas + 1):
                sep = "&" if "?" in caminho else "?"
                html = self.s.get(f"{self.site}{caminho}{sep}pagina={pagina}")
                if not html:
                    break
                achados = comum.links(html, self.site, r"/detalhes_imovel/\d+")
                novos = [u for u in achados if u not in vistos]
                if not novos:
                    break
                vistos += novos
        return vistos

    def extrair(self, url, html):
        meta = comum.metas(html)
        doc = parse(html)
        resumo = meta.get("og:title") or comum.titulo_pagina(html) or ""
        m = _RE_TITULO.match(resumo)
        g = m.groupdict() if m else {}

        # "<span>Dormitórios</span><b>7</b>" nas secoes CÔMODOS e MEDIDAS.
        pares: dict[str, str] = {}
        for span in doc.select("span"):
            rotulo = span.text()
            if not rotulo or len(rotulo) > 30:
                continue
            irmao = span.prox_irmao()
            if irmao is not None and irmao.tag == "b":
                pares[nz.sem_acento(rotulo).lower().strip(": ")] = irmao.text()

        def campo(nome):
            for chave, valor in pares.items():
                if re.fullmatch(nz.sem_acento(_CAMPOS[nome]), chave, re.I):
                    return valor
            return None

        texto = comum.textos_de(html, ".linha-corpo-grid") or ""
        preco = nz.preco(re.search(r"R\$\s?[\d.]+(?:,\d\d)?", texto).group(0)) if re.search(
            r"R\$\s?[\d.]+(?:,\d\d)?", texto) else None
        # Sem preco na ficha, tenta o destaque da pagina.
        if preco is None:
            mm = re.search(r"R\$\s?[\d.]+(?:,\d\d)?", comum.textos_de(html, ".box, .price, h3") or "")
            preco = nz.preco(mm.group(0)) if mm else None

        fin = nz.finalidade(g.get("fin") or "", resumo, url)
        aluguel = None
        if fin == "aluguel":
            preco, aluguel = None, preco

        desc = None
        for bloco in doc.select(".linha-corpo-grid"):
            t = bloco.text()
            if t.upper().startswith("DESCRI"):
                desc = re.sub(r"^DESCRI[ÇC][ÃA]O\s*", "", t, flags=re.I)
                break

        fotos = comum.fotos_por_regex(html, url, r"[\w./:-]+/(?:imoveis|fotos|uploads)/[\w./-]+\.(?:jpe?g|png|webp)")
        return {
            "url": url,
            "codigo": nz.limpa(g.get("cod")),
            "finalidade": fin,
            "tipo": nz.tipo_imovel(g.get("tipo") or "", resumo),
            "titulo": nz.titulo(resumo),
            "descricao": nz.limpa(desc or meta.get("description")),
            "preco": preco,
            "preco_aluguel": aluguel,
            "area_total": nz.area(campo("area_total")),
            "area_util": nz.area(campo("area_util")),
            "quartos": nz.inteiro(campo("quartos")),
            "suites": nz.inteiro(campo("suites")),
            "banheiros": nz.inteiro(campo("banheiros")),
            "vagas": nz.inteiro(campo("vagas")),
            "bairro": nz.bairro(g.get("bairro")),
            "cidade": nz.cidade(g.get("cidade")),
            "uf": nz.uf(g.get("uf") or resumo),
            "foto_capa": meta.get("og:image") or (fotos[0] if fotos else None),
            "fotos": fotos,
            "caracteristicas": [k for k, v in pares.items() if str(v).strip().lower() in ("sim", "x")],
        }
