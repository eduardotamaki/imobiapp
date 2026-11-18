"""Universal Software.

O site e renderizado no navegador, mas a busca chama um endpoint JSON
documentado no proprio busca.js: POST /imoveis/ajax/ com o objeto `imovel`.
Coletar por ali e mais rapido e mais confiavel do que raspar a tela.
"""
from __future__ import annotations

import json
import time
import re

from .. import normalize as nz
from ..base import Scraper

BASE_CONSULTA = {
    "codigounidade": "", "codigosimoveis": "", "codigoTipo[codigo]": "",
    "codigocidade": 0, "codigoregiao": 0, "valorde": 0, "valorate": 0,
    "areade": 0, "areaate": 0, "extras": 0, "destaque": 0, "opcaoimovel": 4,
    "retornomapa": "false", "retornomapaapp": "false",
    "ordenacao": "valordesc", "codigocondominio": "0",
}
POR_PAGINA = 50   # limite do proprio endpoint

# Tema novo (2026): POST /retornar-imoveis-disponiveis com os campos soltos,
# sem o prefixo imovel[...]. O PHP reclama de qualquer campo ausente e, se
# faltar codigoOpcaoimovel, o backend devolve 500. Pagina maxima de 20.
BASE_CONSULTA_NOVA = {
    "codigounidade": "", "codigocondominio": 0, "codigocidade": 0,
    "codigoregiao": 0, "endereco": "", "edificio": "", "numeroquartos": 0,
    "numerovagas": 0, "numerobanhos": 0, "numerosuite": 0, "numerovaranda": 0,
    "numeroelevador": 0, "valorde": 0, "valorate": 0, "areade": 0, "areaate": 0,
    "areaexternade": 0, "areaexternaate": 0, "extras": "",
    "codigoOpcaoimovel": 0, "ordenacao": "valordesc", "codigosimoveis": "",
    "codigoproprietario": 0, "codigocaptador": 0,
}
POR_PAGINA_NOVA = 20


def _fotos(r: dict) -> list[str]:
    """A API nomeia as fotos por tamanho (urlp/urlg/urlfotoprincipalp).

    Prefere-se a maior versao disponivel de cada foto.
    """
    candidatas: list[str] = [r.get("urlfotoprincipalg") or r.get("urlfotoprincipalp") or ""]
    for foto in r.get("fotos") or []:
        if isinstance(foto, dict):
            candidatas.append(foto.get("urlg") or foto.get("urlp") or foto.get("url") or "")
        elif isinstance(foto, str):
            candidatas.append(foto)

    vistas, saida = set(), []
    for u in candidatas:
        if isinstance(u, str) and u.startswith("http") and u not in vistas:
            vistas.add(u)
            saida.append(u)
    return saida


class Universal(Scraper):
    plataforma = "universal"
    max_paginas = 30
    caminho_ajax = "/imoveis/ajax/"
    api_nova = False   # tema de 2026 (ver BASE_CONSULTA_NOVA)

    def coletar(self):
        emitidos = 0
        por_pagina = POR_PAGINA_NOVA if self.api_nova else POR_PAGINA
        paginas = self.max_paginas * (POR_PAGINA // POR_PAGINA_NOVA + 1 if self.api_nova else 1)
        for finalidade in ("venda", "aluguel"):
            for pagina in range(1, paginas + 1):
                dados = self._consulta(finalidade, pagina)
                lista = (dados or {}).get("lista") or []
                if not lista:
                    break
                for reg in lista:
                    item = self._converte(reg, finalidade)
                    if item:
                        emitidos += 1
                        yield item
                        if self.limite and emitidos >= self.limite:
                            return
                if len(lista) < por_pagina:
                    break

    def _consulta(self, finalidade: str, pagina: int):
        if self.api_nova:
            return self._consulta_nova(finalidade, pagina)
        consulta = {**BASE_CONSULTA, "finalidade": finalidade,
                    "numeropagina": pagina, "pagina": pagina,
                    "numeroregistros": POR_PAGINA}
        return self.s.get(
            self.site + self.caminho_ajax,
            dados={f"imovel[{k}]": v for k, v in consulta.items()},
            headers={"X-Requested-With": "XMLHttpRequest",
                     "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                     "Referer": f"{self.site}/{finalidade}/imoveis"},
            json_resp=True,
        )

    def _consulta_nova(self, finalidade: str, pagina: int):
        consulta = {**BASE_CONSULTA_NOVA, "finalidade": finalidade,
                    "numeropagina": pagina, "numeroregistros": POR_PAGINA_NOVA}
        # O backend devolve 500 de vez em quando para a mesma consulta; uma
        # pagina vazia por erro encerraria a paginacao no meio. As novas
        # tentativas ignoram o cache, que pode ter guardado a resposta de erro.
        usar_cache = self.s.usar_cache
        try:
            for tentativa in range(6):
                if tentativa:
                    self.s.usar_cache = False
                    time.sleep(2 * tentativa)
                dados = self._le_resposta_nova(self.s.get(
                    self.site + "/retornar-imoveis-disponiveis",
                    dados=consulta,
                    headers={"X-Requested-With": "XMLHttpRequest",
                             "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                             "Referer": f"{self.site}/{finalidade}"},
                ))
                if dados is not None:
                    return dados
        finally:
            self.s.usar_cache = usar_cache
        raise RuntimeError(f"{self.slug}: backend falhou na página {pagina} de {finalidade}")

    @staticmethod
    def _le_resposta_nova(texto: str | None) -> dict | None:
        # A resposta vem precedida de warnings do PHP em HTML.
        m = re.search(r'\{"(?:quantidade|error)"', texto or "")
        if not m:
            return None
        try:
            dados = json.loads(texto[m.start():])
        except json.JSONDecodeError:
            return None
        return None if dados.get("error") else dados

    def _converte(self, r: dict, finalidade: str) -> dict | None:
        codigo = r.get("codigo")
        if not codigo:
            return None
        if r.get("url_amigavel"):
            url = f"{self.site}/imovel/{r['url_amigavel']}/{codigo}"
        else:
            slug = r.get("titulo") or "imovel"
            url = f"{self.site}/{finalidade}/imovel/{codigo}/{slug}"

        valor = nz.preco(r.get("valor"))
        fotos = _fotos(r)

        return {
            "url": url,
            "codigo": str(codigo),
            "finalidade": "aluguel" if finalidade == "aluguel" else "venda",
            "tipo": nz.tipo_imovel(r.get("tipo") or "", r.get("tipo2") or ""),
            "titulo": nz.titulo(
                " ".join(filter(None, [r.get("tipo"), "em", r.get("bairro"), "-", r.get("cidade")]))
            ),
            "descricao": nz.limpa(r.get("descricao") or r.get("observacao")),
            "preco": valor if finalidade == "venda" else None,
            "preco_aluguel": valor if finalidade == "aluguel" else None,
            "condominio": nz.preco(r.get("valorcondominio")),
            "iptu": nz.preco(r.get("valoriptu")),
            "area_total": nz.area(r.get("areatotal") or r.get("areaterreno") or r.get("arealote")),
            "area_util": nz.area(r.get("areaprincipal") or r.get("areautil")
                                 or r.get("areainterna")),
            "quartos": nz.inteiro(r.get("numeroquartos")),
            "suites": nz.inteiro(r.get("numerosuites")),
            "banheiros": nz.inteiro(r.get("numerobanhos")),
            "vagas": nz.inteiro(r.get("numerovagas")),
            "endereco": nz.limpa(" ".join(filter(None, [r.get("endereco"),
                                                        (r.get("numero") or "").strip("*")]))),
            "bairro": nz.bairro(r.get("bairro")),
            "cidade": nz.cidade(r.get("cidade")),
            "uf": nz.uf(r.get("estado") or ""),
            "cep": nz.cep(r.get("cep")),
            "latitude": nz.numero(r.get("latitude")),
            "longitude": nz.numero(r.get("longitude")),
            "foto_capa": fotos[0] if fotos else None,
            "fotos": fotos,
            "bruto": {k: r.get(k) for k in
                      ("codigo", "tipo", "finalidade", "valoranterior", "aceitapermuta")},
        }
