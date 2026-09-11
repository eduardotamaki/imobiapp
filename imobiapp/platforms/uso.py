"""Plataforma USO (cdn.uso.com.br) - usada como "Union Imobiliarias".

Pagina de detalhe bem estruturada por classes proprias, e ainda expoe o
historico de valores num <input hidden> ("valores_grafico_venda"), que e
justamente o que interessa a quem esta caçando queda de preco.
"""
from __future__ import annotations

import re

from .. import normalize as nz
from ..base import Scraper
from ..htmlx import parse
from . import comum

_RE_DETALHE = r"/(?:comprar|alugar|temporada)/[a-z]{2}/[^/]+/[^/]+/[^/]+/\d+"


class Uso(Scraper):
    plataforma = "uso"
    max_paginas = 60

    def listar_urls(self):
        urls = comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", _RE_DETALHE)
        # O sitemap so lista o que esta a venda; a locacao sai da paginacao.
        vistos = set(urls)
        for pagina in range(1, self.max_paginas + 1):
            html = self.s.get(f"{self.site}/imoveis/pagina-{pagina}/")
            if not html:
                break
            achados = comum.links(html, self.site, _RE_DETALHE)
            novos = [u for u in achados if u not in vistos]
            if not achados:
                break
            vistos.update(novos)
            urls += novos
            if not novos:      # paginacao deu a volta
                break
        return urls

    def extrair(self, url, html):
        doc = parse(html)
        ocultos = dict(re.findall(r'<input id="([\w]+)"[^>]*value="([^"]*)"', html))

        # A plataforma tem mais de uma geracao de tema; os seletores abaixo
        # cobrem as variantes vistas nos sites de Itajuba.
        info = _texto(doc, ".bloco_info_imovel") or _texto(doc, ".dados")
        titulo = (_texto(doc, "h1.titulo") or _texto(doc, "h1")
                  or comum.metas(html).get("og:title"))
        local = (_texto(doc, "h2.localizacao") or _texto(doc, ".info_imovel span")
                 or _linha_de_local(doc))

        # "Venda R$ 160.000,00" / "Locação R$ 1.200,00" podem coexistir.
        preco = aluguel = None
        for bloco in doc.select(".valor-imovel, .alinha_valores, .valor_imovel"):
            t = bloco.text()
            valor = nz.preco(t)
            if not valor:
                continue
            if re.search(r"loca[çc][ãa]o|aluguel", t, re.I):
                aluguel = aluguel or valor
            elif re.search(r"venda", t, re.I):
                preco = preco or valor

        bairro = cidade = uf = None
        if local:
            # "Bairro - Cidade/UF" (as vezes com rua e numero antes)
            m = re.search(r"([^-,]+)\s*-\s*([^-/,]+)\s*/\s*([A-Z]{2})\s*$", local)
            if m:
                bairro, cidade, uf = m.group(1), m.group(2), m.group(3)

        valor_antes = _valor_vem_antes(info)

        def num(rotulo, unidade=False):
            texto = info or ""
            valor = r"([\d.,]+)\s*m²?" if unidade else r"(\d{1,3})\b"
            # O valor antes do rotulo so conta quando nao estiver grudado em
            # letras: senao o codigo "AP00133" vira "133 dormitorios".
            padrao = (rf"(?<![A-Za-z0-9]){valor}\s*(?:{rotulo})" if valor_antes
                      else rf"(?:{rotulo})[^\d]{{0,4}}{valor}")
            m = re.search(padrao, texto, re.I)
            return m.group(1) if m else None

        # A plataforma espalha as fotos entre cdn2/cdn5.uso.com.br, cdnuso.com
        # e o bucket S3 do grupo, dependendo da conta.
        fotos = comum.fotos_por_regex(
            html, url,
            r"https?://(?:cdn\d*\.uso\.com\.br|cdnuso\.com|[\w.-]*\.s3\.amazonaws\.com)"
            r"/[\w./+=-]+\.(?:jpe?g|png|webp)")
        tipo_txt = (info or "").split()[0] if info else ""

        return {
            "url": url,
            "codigo": nz.limpa(ocultos.get("referencia_imovel_ficha")) or num(r"Refer[êe]ncia:\s*(\S+)"),
            "finalidade": nz.finalidade(url, titulo or ""),
            "tipo": nz.tipo_imovel(tipo_txt, titulo or "", url),
            "titulo": nz.titulo(titulo),
            "descricao": nz.limpa(_texto(doc, ".descricao_imovel") or _texto(doc, "#descricao")),
            "preco": preco,
            "preco_aluguel": aluguel,
            "condominio": nz.preco_estrito(_apos(info, r"condom[íi]nio")),
            "iptu": nz.preco_estrito(_apos(info, r"iptu")),
            "area_total": nz.area(num(r"[áa]rea total", unidade=True)
                                  or _antes(info, r"m²?\s*total")),
            "area_util": nz.area(num(r"[áa]rea [úu]til", unidade=True)
                                 or _antes(info, r"m²?\s*[úu]til")),
            "quartos": nz.inteiro(num(r"dormit[óo]rios?|quartos?")),
            "suites": nz.inteiro(num(r"su[íi]tes?")),
            "banheiros": nz.inteiro(num(r"banheiros?")),
            "vagas": nz.inteiro(num(r"vagas?")),
            "endereco": nz.limpa(local),
            "bairro": nz.bairro(bairro),
            "cidade": nz.cidade(cidade),
            "uf": nz.uf(uf or local or ""),
            "foto_capa": fotos[0] if fotos else None,
            "fotos": fotos,
            "bruto": {"historico_site": ocultos.get("valores_grafico_venda"),
                      "meses_site": ocultos.get("meses_grafico_venda")},
        }


_CAMPOS_FICHA = r"dormit[óo]rios?|quartos?|banheiros?|vagas?|su[íi]tes?"


_RE_LOCAL = re.compile(r"^[^-,]{2,40}\s*-\s*[^-/,]{2,40}\s*/\s*[A-Z]{2}\s*$")


def _linha_de_local(doc):
    """Acha a linha "Bairro - Cidade/UF" quando o tema nao a marca com classe."""
    for n in doc.select("h2, h3, .localizacao, .endereco"):
        t = n.text()
        if _RE_LOCAL.match(t):
            return t
    return None


def _valor_vem_antes(info: str | None) -> bool:
    """Decide o layout da ficha: "2 dormitórios" ou "Dormitórios 2".

    Nao da pra olhar um campo so: em "Suítes 2 Banheiros 4" o 2 fica colado
    no rotulo seguinte e parece o outro layout. Entao conta-se qual das duas
    leituras explica melhor a ficha inteira; no empate vale o formato mais
    comum em portugues ("2 dormitorios").
    """
    texto = info or ""
    antes = len(re.findall(rf"\b\d{{1,3}}\s*(?:{_CAMPOS_FICHA})", texto, re.I))
    depois = len(re.findall(rf"(?:{_CAMPOS_FICHA})\s*\d{{1,3}}\b", texto, re.I))
    return antes >= depois


def _antes(texto: str | None, rotulo: str) -> str | None:
    """"48,00 m² total" -> "48,00" """
    m = re.search(rf"([\d.,]+)\s*{rotulo}", texto or "", re.I)
    return m.group(1) if m else None


def _apos(texto: str | None, rotulo: str) -> str | None:
    m = re.search(rf"{rotulo}[^\d]{{0,12}}(R\$ ?[\d.,]+)", texto or "", re.I)
    return m.group(1) if m else None


def _texto(doc, seletor):
    n = doc.select_one(seletor)
    return n.text() if n else None
