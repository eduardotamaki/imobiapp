"""Arbo Imoveis (api-site.arboimoveis.com.br).

Next.js: a pagina e montada no servidor e carrega o registro completo do
imovel no `__NEXT_DATA__`, entao da pra ler tudo sem executar JavaScript.

Atencao ao dominio: o apex responde com certificado invalido (o certificado
so cobre o www), e por isso o site parecia fora do ar. `site` precisa vir
com "www.".
"""
from __future__ import annotations

import json
import re

from .. import normalize as nz
from ..base import Scraper
from . import comum

_RE_NEXT = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


class Arbo(Scraper):
    plataforma = "arbo"

    def listar_urls(self):
        return comum.urls_do_sitemap(self.s, f"{self.site}/sitemap.xml", r"/imovel/")

    def extrair(self, url, html):
        m = _RE_NEXT.search(html)
        if not m:
            return None
        try:
            pagina = json.loads(m.group(1))["props"]["pageProps"]
        except (json.JSONDecodeError, KeyError):
            return None
        d = pagina.get("imovel")
        if not isinstance(d, dict) or not d.get("imv_cod_gaia"):
            return None

        negocio = (d.get("tipo_negocio") or {}).get("tpng_nome") or ""
        venda = nz.preco(d.get("imv_preco_venda"))
        locacao = nz.preco(d.get("imv_preco_locacao"))
        # `imv_ocultar_preco` marca o anuncio "sob consulta".
        if d.get("imv_ocultar_preco"):
            venda = locacao = None

        fotos = [f["imvft_url"] for f in (d.get("fotos") or [])
                 if isinstance(f, dict) and f.get("imvft_url")]

        return {
            "url": nz.limpa(d.get("url_amiga")) and _https(d["url_amiga"]) or url,
            "codigo": nz.limpa(d.get("imv_cod_gaia")),
            "finalidade": nz.finalidade(negocio, url),
            "tipo": nz.tipo_imovel((d.get("tipo_imovel") or {}).get("timv_nome") or "", url),
            "titulo": nz.titulo(d.get("imv_titulo")),
            "descricao": nz.limpa(d.get("imv_obs")),
            "preco": venda,
            "preco_aluguel": locacao,
            "condominio": nz.preco(d.get("imv_preco_cond")),
            "iptu": nz.preco(d.get("imv_preco_iptu")),
            "area_total": nz.area(d.get("imv_area_total") or d.get("imv_area_terreno")),
            "area_util": nz.area(d.get("imv_area_util") or d.get("imv_area_construida")),
            "quartos": nz.inteiro(d.get("imv_qtd_dorm")),
            "suites": nz.inteiro(d.get("imv_qtd_suite")),
            "banheiros": nz.inteiro(d.get("imv_qtd_banheiros")),
            "vagas": nz.inteiro(d.get("imv_qtd_vagas")),
            "bairro": nz.bairro(d.get("imv_bairro")),
            "cidade": nz.cidade(d.get("imv_cidade")),
            "uf": nz.uf(d.get("imv_estado") or ""),
            "latitude": nz.numero(d.get("imv_latitude")),
            "longitude": nz.numero(d.get("imv_longitude")),
            "foto_capa": fotos[0] if fotos else None,
            "fotos": fotos[:40],
            "caracteristicas": [c.get("cmd_nome") for c in (d.get("comodidades") or [])
                                if isinstance(c, dict) and c.get("cmd_nome")],
            "bruto": {"imv_id": d.get("imv_id"), "status": (d.get("status_imovel") or {}).get("nome"),
                      "tipo": (d.get("tipo_imovel") or {}).get("timv_nome")},
        }


def _https(u: str) -> str:
    """`url_amiga` vem sem esquema em parte dos registros."""
    u = u.strip()
    return u if u.startswith("http") else "https://" + u.lstrip("/")
