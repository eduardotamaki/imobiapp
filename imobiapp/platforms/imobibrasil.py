"""ImobiBrasil (imobibrasil.com.br / seusitebrasil).

Familia com dois templates bem diferentes convivendo:

* moderno  -> /imovel/{id}/{slug}, dados em og:title + blocos #desc_*
* legado   -> /?conteudo=fotografias&categoria={id} (ou /imobiliaria/imovel/{id}),
              layout em <table> com pares "Rotulo: valor"

Os dois casos caem no mesmo extrator: o og:title tem a ficha resumida
("Apartamento para Venda, Itajuba / MG, bairro Varginha, 2 dormitorios,
1 vaga") e o corpo complementa area, suites e valores.
"""
from __future__ import annotations

import re

from .. import normalize as nz
from ..base import Scraper
from ..htmlx import so_texto
from . import comum

ROTULOS = {
    "codigo": r"c[óo]digo(?: do im[óo]vel)?|refer[êe]ncia",
    "bairro": r"bairro",
    "cidade": r"cidade",
    "uf": r"estado|uf",
    "endereco": r"endere[çc]o|logradouro|rua",
    "area_total": r"[áa]rea total|[áa]rea do terreno|terreno",
    "area_util": r"[áa]rea [úu]til|[áa]rea constru[íi]da|[áa]rea privativa",
    "quartos": r"dormit[óo]rios?|quartos?",
    "suites": r"su[íi]tes?",
    "banheiros": r"banheiros?|wc",
    "vagas": r"vagas?(?: de garagem)?|garagens?",
    "condominio": r"condom[íi]nio",
    "iptu": r"iptu",
    "preco": r"valor(?: de venda| para venda| do im[óo]vel)?|pre[çc]o",
    "preco_aluguel": r"valor do aluguel|aluguel|loca[çc][ãa]o",
}

# "Apartamento para Venda, Itajuba / MG, bairro Varginha, 2 dormitorios, 1 vaga"
_RE_RESUMO = re.compile(
    r"^(?P<tipo>[^,]+?)\s+(?:para|-)\s+(?P<fin>Venda|Loca[çc][ãa]o|Aluguel|Venda e Loca[çc][ãa]o)"
    r"(?:\s*,\s*(?P<cidade>[^,/]+?)\s*/\s*(?P<uf>[A-Z]{2}))?"
    r"(?:\s*,\s*bairro\s+(?P<bairro>[^,]+))?",
    re.I,
)
# Template legado: "Apartamento - Venda - Sao Vicente - Itajuba/MG"
_RE_RESUMO_LEGADO = re.compile(
    r"^(?P<tipo>[^-]+?)\s*-\s*(?P<fin>Venda|Loca[çc][ãa]o|Aluguel)\s*-\s*"
    r"(?P<bairro>[^-]+?)\s*-\s*(?P<cidade>[^/]+?)\s*/\s*(?P<uf>[A-Z]{2})",
    re.I,
)
# Instalacao nao configurada devolve a pagina de vendas da propria
# ImobiBrasil no lugar do imovel; nao adianta tentar extrair nada dali.
_E_PAGINA_DA_PLATAFORMA = re.compile(
    r"IMOBIBRASIL|Site para Imobili[áa]rias", re.I)

_RE_FOTO = re.compile(
    r"https?://[\w.-]+/imagens/(?:imoveis|fotos)/(?!thumb)[\w./-]*[\w-]\.(?:jpe?g|png|webp)",
    re.I,
)


class ImobiBrasil(Scraper):
    plataforma = "imobibrasil"

    # Sites que nao publicam sitemap sao varridos pela pagina de listagem.
    paginas_listagem: tuple[str, ...] = ()
    padrao_detalhe = r"/imovel/\d+|conteudo=fotografias&categoria=\d+|/imobiliaria/imovel/\d+"

    def listar_urls(self):
        urls = comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imovel/\d+")
        for caminho in self.paginas_listagem:
            html = self.s.get(self.site + caminho)
            if html:
                urls += comum.links(html, self.site + caminho, self.padrao_detalhe)
        return urls

    def extrair(self, url, html):
        meta = comum.metas(html)
        resumo = meta.get("og:title") or meta.get("description") or comum.titulo_pagina(html) or ""
        if _E_PAGINA_DA_PLATAFORMA.search(resumo):
            return None   # instalacao sem conteudo: o site serve o anuncio da ImobiBrasil

        # O padrao legado e mais especifico, entao tenta antes do moderno.
        cab = _RE_RESUMO_LEGADO.match(resumo) or _RE_RESUMO.match(resumo)
        g = cab.groupdict() if cab else {}

        # A ficha tecnica fica num bloco pequeno; varrer a pagina inteira
        # pegaria o endereco do rodape e os filtros da busca como se fossem
        # dados do imovel.
        ficha = comum.textos_de(html, "#desc_info", ".imovel_cx_caracteristicas")
        if "digo" not in ficha:
            ficha = comum.bloco_ficha(html, ROTULOS) or ficha
        campos = comum.rotulos(ficha, ROTULOS) if ficha else {}

        corpo_desc = (comum.bloco_texto(html, "#desc_descricao")
                      or comum.bloco_texto(html, "#dadosdoimovel")
                      or comum.bloco_texto(html, ".descricao"))
        if corpo_desc:
            corpo_desc = re.sub(r"^Descri[çc][ãa]o do Im[óo]vel\s*", "", corpo_desc, flags=re.I)

        fin = nz.finalidade(g.get("fin") or "", resumo, url)
        preco = nz.preco_estrito(campos.get("preco")) or self._preco_destacado(html)
        aluguel = nz.preco_estrito(campos.get("preco_aluguel"))
        if fin == "aluguel" and preco and not aluguel:
            preco, aluguel = None, preco

        # og:title traz a ficha resumida e e a fonte mais confiavel desses
        # sites; o bloco de rotulos entra so pra completar o que faltar.
        r = _do_resumo(resumo)
        icones = comum.contadores_por_icone(html)

        def campo(nome, conv):
            for origem in (r.get(nome), campos.get(nome), icones.get(nome)):
                v = conv(origem)
                if v:
                    return v
            return None

        fotos = comum.fotos_por_regex(html, url, _RE_FOTO.pattern)
        return {
            "url": url,
            "codigo": _codigo_valido(campos.get("codigo")),
            "finalidade": fin,
            "tipo": nz.tipo_imovel(g.get("tipo") or "", resumo),
            "titulo": nz.titulo(resumo),
            "descricao": nz.limpa(corpo_desc),
            "preco": preco,
            "preco_aluguel": aluguel,
            "condominio": nz.preco_estrito(campos.get("condominio")),
            "iptu": nz.preco_estrito(campos.get("iptu")),
            "area_total": campo("area_total", nz.area),
            "area_util": campo("area_util", nz.area),
            "quartos": campo("quartos", nz.inteiro),
            "suites": campo("suites", nz.inteiro),
            "banheiros": campo("banheiros", nz.inteiro),
            "vagas": campo("vagas", nz.inteiro),
            "endereco": nz.limpa(campos.get("endereco")),
            "bairro": nz.bairro(g.get("bairro") or campos.get("bairro")),
            "cidade": nz.cidade(g.get("cidade") or campos.get("cidade")),
            "uf": nz.uf(g.get("uf") or campos.get("uf") or resumo),
            "foto_capa": next(
                (u for u in [meta.get("og:image"), *fotos] if comum.foto_util(u or "")), None
            ),
            "fotos": fotos,
        }

    @staticmethod
    def _preco_destacado(html: str) -> float | None:
        """Pega "Valor: R$ 450.000,00" dos titulos/caixa de valor.

        So aceita valor com rotulo explicito: nesses templates o texto livre
        costuma citar preco por m2 e valores de imoveis parecidos.
        """
        alvos = [so_texto(x) for x in re.findall(r"<h[123][^>]*>(.*?)</h[123]>", html, re.S | re.I)]
        alvos += [comum.textos_de(html, ".info__valor")]
        for t in alvos:
            if not t:
                continue
            m = re.search(r"(?:valor|pre[çc]o|por)\s*:?\s*(R\$\s*[\d.]+(?:,\d{2})?)", t, re.I)
            if m:
                return nz.preco(m.group(1))
            if re.fullmatch(r"\s*R\$\s*[\d.]+(?:,\d{2})?\s*", t):
                return nz.preco(t)
        return None


def _codigo_valido(v: str | None) -> str | None:
    """Descarta o lixo que entra quando o bloco da ficha nao foi encontrado."""
    v = nz.limpa(v)
    if not v or len(v) > 24 or re.search(r"[@()]|whats|http", v, re.I):
        return None
    return v


def _do_resumo(resumo: str) -> dict:
    """Extrai numeros do og:title: "3 dormitorios, sendo 1 suite, 2 vagas,
    area total 2 Hectares, area util 3400 m2"."""
    def acha(padrao):
        m = re.search(padrao, resumo, re.I)
        return m.group(1) if m else None

    return {
        "quartos": acha(r"(\d+)\s*(?:dormit|quarto)"),
        "suites": acha(r"(\d+)\s*su[íi]te"),
        "banheiros": acha(r"(\d+)\s*banheiro"),
        "vagas": acha(r"(\d+)\s*vaga"),
        "area_total": acha(r"[áa]rea total\s*([\d.,]+\s*\w+²?)"),
        "area_util": acha(r"[áa]rea (?:[úu]til|constru[íi]da|privativa)\s*([\d.,]+\s*\w+²?)"),
    }
