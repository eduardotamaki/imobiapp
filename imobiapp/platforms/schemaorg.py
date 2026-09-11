"""Leitura de anuncios publicados como schema.org/RealEstateListing.

Kenlo, Tecimob e Jetimob descrevem o imovel inteiro em JSON-LD. Vale a pena
tratar isso num lugar so: e a fonte mais confiavel que existe nesses sites,
porque e o mesmo dado que eles mandam para o Google.
"""
from __future__ import annotations

import re

from .. import normalize as nz
from . import comum

TIPOS = ("RealEstateListing", "Product", "Residence", "Apartment", "House",
         "SingleFamilyResidence", "Offer", "Accommodation")


def acha_listing(html: str) -> dict | None:
    itens = comum.jsonld(html)
    for alvo in TIPOS:
        d = comum.jsonld_tipo(itens, alvo)
        if d and (d.get("offers") or d.get("name")):
            return d
    return None


def _n(v):
    """Aceita 42, "42", {"value": 42} e {"minValue": 42}."""
    if isinstance(v, dict):
        v = v.get("value") or v.get("minValue") or v.get("maxValue")
    return v


def para_imovel(d: dict, url: str, html: str = "") -> dict:
    ofertas = d.get("offers") or {}
    if isinstance(ofertas, list):
        ofertas = ofertas[0] if ofertas else {}
    end = d.get("address") or {}
    if isinstance(end, list):
        end = end[0] if end else {}

    nome = nz.limpa(d.get("name"))
    desc = nz.limpa(d.get("description"))
    preco = nz.preco(_n(ofertas.get("price")) or _n(ofertas.get("lowPrice")))

    # O schema nao separa venda de locacao; o texto do anuncio separa.
    fin = nz.finalidade(nome or "", url, ofertas.get("businessFunction") or "")
    aluguel = None
    if fin == "aluguel":
        preco, aluguel = None, preco

    # Anuncio duplo ("venda por R$ 800.000,00 e aluguel por R$ 2.800,00"):
    # `offers` traz so uma das pontas, e nao da pra saber qual. O titulo diz.
    dois = _venda_e_aluguel(nome or "")
    if dois:
        preco, aluguel = dois
        fin = "venda_aluguel"

    fotos = [i for i in _lista(d.get("image")) if isinstance(i, str)]
    return {
        "url": url,
        "codigo": nz.limpa(d.get("identifier") or d.get("sku") or d.get("productID")),
        "finalidade": fin,
        "tipo": nz.tipo_imovel(nome or "", url, str(d.get("@type"))),
        "titulo": nz.titulo(nome),
        "descricao": desc,
        "preco": preco,
        "preco_aluguel": aluguel,
        "area_total": nz.area(_n(d.get("lotSize"))),
        "area_util": nz.area(_n(d.get("floorSize"))),
        "quartos": nz.inteiro(_n(d.get("numberOfBedrooms") or d.get("numberOfRooms"))),
        "suites": nz.inteiro(_n(d.get("numberOfSuites"))),
        "banheiros": nz.inteiro(
            _n(d.get("numberOfBathroomsTotal") or d.get("numberOfFullBathrooms"))),
        "vagas": nz.inteiro(_n(d.get("numberOfParkingSpaces") or d.get("parkingSpaces"))),
        "endereco": nz.limpa(end.get("streetAddress")),
        "bairro": nz.bairro(end.get("addressNeighborhood") or end.get("streetAddress")),
        "cidade": nz.cidade(end.get("addressLocality")),
        "uf": nz.uf(end.get("addressRegion") or ""),
        "cep": nz.cep(end.get("postalCode")),
        "latitude": nz.numero((d.get("geo") or {}).get("latitude")),
        "longitude": nz.numero((d.get("geo") or {}).get("longitude")),
        "foto_capa": fotos[0] if fotos else None,
        "fotos": fotos[:40],
        "caracteristicas": [
            nz.limpa(a.get("name")) for a in _lista(d.get("amenityFeature"))
            if isinstance(a, dict) and a.get("name")
        ],
    }


def _venda_e_aluguel(titulo: str) -> tuple[float, float] | None:
    venda = re.search(r"(?:[àa]\s*venda|venda)\s*(?:por)?\s*(R\$\s*[\d.]+(?:,\d\d)?)", titulo, re.I)
    loc = re.search(r"(?:aluguel|loca[çc][ãa]o|alugar)\s*(?:por)?\s*(R\$\s*[\d.]+(?:,\d\d)?)", titulo, re.I)
    if venda and loc:
        return nz.preco(venda.group(1)), nz.preco(loc.group(1))
    return None


def _lista(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def completa_pelo_texto(item: dict, html: str) -> dict:
    """Preenche o que o JSON-LD deixou em branco usando o texto do anuncio.

    O titulo desses sites costuma ser descritivo ("Casa com 3 quartos a venda
    e 1 vaga"), e a meta description repete quartos, banheiros e vagas.
    """
    fonte = " ".join(filter(None, [
        item.get("titulo") or "", comum.metas(html).get("description") or ""
    ]))

    def acha(padrao):
        m = re.search(padrao, fonte, re.I)
        return nz.inteiro(m.group(1)) if m else None

    if not (item.get("bairro") and item.get("cidade")):
        for campo, valor in comum.local_do_titulo(
                item.get("titulo"), comum.metas(html).get("description")).items():
            item.setdefault(campo, None)
            item[campo] = item[campo] or valor

    for campo, padrao in (
        ("quartos", r"(\d+)\s*(?:quartos?|dormit)"),
        ("suites", r"(\d+)\s*su[íi]te"),
        ("banheiros", r"(\d+)\s*banheiro"),
        ("vagas", r"(\d+)\s*vaga"),
    ):
        if not item.get(campo):
            item[campo] = acha(padrao)
    if not item.get("area_util"):
        m = re.search(r"([\d.,]+)\s*m²", fonte)
        if m:
            item["area_util"] = nz.area(m.group(1))
    return item
