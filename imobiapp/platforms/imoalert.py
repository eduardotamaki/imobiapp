"""ImoAlert / Ville Imob.

A pagina de detalhe embute o registro completo do imovel num `var imovel = {...}`,
entao nao ha parsing de HTML: le-se o JSON do proprio sistema.
"""
from __future__ import annotations

import json
import re

from .. import normalize as nz
from ..base import Scraper
from . import comum

_RE_BLOB = re.compile(r"var\s+imovel\s*=\s*(\{.*?\});\s*$", re.S | re.M)


class ImoAlert(Scraper):
    plataforma = "imoalert"

    def listar_urls(self):
        return comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imovel/\d+")

    def extrair(self, url, html):
        m = _RE_BLOB.search(html)
        if not m:
            return None
        try:
            d = json.loads(m.group(1))
        except json.JSONDecodeError:
            return None

        precos = {p.get("ttpr_nome", "").lower(): p for p in (d.get("tabeladepreco") or [])}
        venda = precos.get("venda") or {}
        locacao = precos.get("locação") or precos.get("locacao") or {}

        carac = {}
        for c in d.get("caracteristicas") or []:
            nome = (c.get("carac_nome") or c.get("cara_nome") or "").strip()
            if nome:
                carac[nz.slug(nome)] = c.get("imca_valor") or c.get("imoc_valor") or True

        def car(*chaves):
            for k in chaves:
                for slug_car, val in carac.items():
                    if k in slug_car:
                        return val
            return None

        fotos = []
        for cat in d.get("categoriafotografia") or []:
            for f in cat.get("fotos") or []:
                if f.get("fot_publicar") and f.get("fot_caminho"):
                    fotos.append(f["fot_caminho"])

        tipo_txt = " ".join(filter(None, [d.get("tic_nome"), d.get("ist_nome")]))
        preco_venda = nz.preco(d.get("valor_venda") or venda.get("imtp_valor"))
        preco_loc = nz.preco(d.get("valor_locacao") or locacao.get("imtp_valor"))

        texto = " ".join(filter(None, [tipo_txt, d.get("imo_detalheinformacoes"),
                                       d.get("imo_portaldescricao")]))

        def do_texto(padrao, conv=nz.inteiro):
            m = re.search(padrao, texto, re.I)
            return conv(m.group(1)) if m else None

        area_no_texto = _area_no_texto(texto)
        # Em terreno e chacara a metragem citada e a do terreno, nao a construida.
        e_terreno = nz.tipo_imovel(tipo_txt) in ("terreno", "chacara")

        return {
            "url": url,
            "codigo": _codigo(d),
            "finalidade": nz.finalidade(
                "venda" if preco_venda else "", "locacao" if preco_loc else ""
            ),
            "tipo": nz.tipo_imovel(tipo_txt),
            "titulo": nz.titulo(_primeiro_texto(
                d.get("imo_tituloportal"), d.get("imo_nome_site"),
                _nome_descritivo(d), tipo_txt)),
            "descricao": nz.limpa(d.get("imo_detalheinformacoes") or d.get("imo_portaldescricao")),
            "preco": preco_venda,
            "preco_aluguel": preco_loc,
            "condominio": nz.preco(d.get("valor_venda_condominio") or d.get("valor_locacao_condomionio")),
            "iptu": nz.preco(d.get("valor_venda_iptu") or d.get("valor_locacao_iptu")),
            # Boa parte das imobiliarias nessa plataforma nao preenche
            # `caracteristicas`; ai o numero so existe no titulo do tipo
            # ("Casa de 03 Dormitórios") e no texto do anuncio.
            "area_total": (nz.area(car("area-total", "area-do-terreno", "terreno"))
                           or (area_no_texto if e_terreno else None)),
            "area_util": (nz.area(car("area-util", "area-construida", "area-privativa"))
                          or (None if e_terreno else area_no_texto)),
            "quartos": nz.inteiro(car("dormitorio", "quarto")) or do_texto(r"(\d{1,2})\s*(?:dormit|quarto)"),
            "suites": nz.inteiro(car("suite")) or do_texto(r"(\d{1,2})\s*su[íi]te"),
            "banheiros": nz.inteiro(car("banheiro", "wc")) or do_texto(r"(\d{1,2})\s*banheiro"),
            "vagas": nz.inteiro(car("vaga", "garagem")) or do_texto(r"(\d{1,2})\s*vaga"),
            "endereco": nz.limpa(d.get("imo_endereco_completo") or d.get("imo_endereco")),
            "bairro": nz.bairro(d.get("imo_bairro")),
            "cidade": nz.cidade(d.get("cid_nome")),
            "uf": nz.uf(d.get("est_sigla")),
            "cep": nz.cep(d.get("imo_cep")),
            "latitude": nz.numero(d.get("imo_latitude")),
            "longitude": nz.numero(d.get("imo_longitude")),
            "foto_capa": d.get("fot_caminho") if str(d.get("fot_caminho") or "").startswith("http") else (fotos[0] if fotos else None),
            "fotos": fotos,
            "caracteristicas": [c.get("carac_nome") or c.get("cara_nome")
                                for c in (d.get("caracteristicas") or [])],
            # Guarda so o essencial: o blob original traz dados do proprietario.
            "bruto": {k: d.get(k) for k in (
                "imo_codigo", "imo_nome", "tic_nome", "ist_nome", "iper_nome",
                "imos_nome", "acessos", "imo_anoconstrucao", "imo_datacadastro")},
        }


def _area_no_texto(texto: str) -> float | None:
    """Maior metragem citada no anuncio ("309,54m2", "120 m²").

    Pega a maior porque o texto costuma citar comodos ("suite de 20m2")
    antes da area do imovel, e descarta numero fora de escala.
    """
    achados = []
    for m in re.finditer(r"([\d][\d.,]*)\s*m\s*[²2]\b", texto, re.I):
        v = nz.area(m.group(1))
        if v and 8 <= v <= 5_000_000:
            achados.append(v)
    return max(achados) if achados else None


def _primeiro_texto(*valores) -> str | None:
    """Primeiro valor que seja mesmo texto: campos opcionais dessa API
    alternam entre string e booleano."""
    for v in valores:
        if isinstance(v, str) and v.strip():
            return v
    return None


def _codigo(d: dict) -> str | None:
    """`imo_nome` guarda a referencia ("CA0218") em umas imobiliarias e o
    titulo do anuncio em outras. So vale como codigo se parecer um codigo."""
    nome = nz.limpa(d.get("imo_nome"))
    if nome and len(nome) <= 20 and " " not in nome:
        return nome
    return str(d["imo_codigo"]) if d.get("imo_codigo") else None


def _nome_descritivo(d: dict) -> str | None:
    nome = nz.limpa(d.get("imo_nome"))
    return nome if nome and " " in nome else None
