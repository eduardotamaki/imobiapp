"""Waysoft (waysoft.net.br/apiapp/API-IMOB).

Site renderizado no navegador: o HTML vem praticamente vazio. Foi preciso
abrir num browser de verdade para descobrir de onde vinham os dados - e a
resposta e uma API JSON limpa, que o scraper consome direto.

Paginacao: o endpoint de busca devolve o proprio SQL na resposta
("LIMIT 12 OFFSET n"), o que deixa claro que o campo chamado `LIMIT` no
corpo e na verdade o OFFSET, com pagina fixa de 12, e que `totalItens`
traz o total. E o que se usa aqui.
"""
from __future__ import annotations

from .. import normalize as nz
from ..base import Scraper

API = "https://waysoft.net.br/apiapp/API-IMOB/api"
POR_PAGINA = 12

# 0 = venda, 1 = locacao (nomenclatura da propria API)
VENDA, LOCACAO = 0, 1


class Waysoft(Scraper):
    plataforma = "waysoft"
    token: str = ""          # cada imobiliaria tem o seu
    max_paginas = 40

    def coletar(self):
        emitidos = 0
        for operacao in (VENDA, LOCACAO):
            for cidade in self._cidades(operacao):
                for registro in self._busca(operacao, cidade):
                    item = self._converte(registro, operacao)
                    if not item:
                        continue
                    emitidos += 1
                    yield item
                    if self.limite and emitidos >= self.limite:
                        return

    # -- API ------------------------------------------------------------
    def _cidades(self, operacao: int) -> list[str]:
        dados = self.s.get(f"{API}/listar/cidade/{self.token}/{operacao}/N", json_resp=True)
        return [c["cidade_im"] for c in (dados or []) if c.get("cidade_im", "").strip()]

    def _busca(self, operacao: int, cidade: str):
        offset = 0
        for _ in range(self.max_paginas):
            resposta = self.s.get(
                f"{API}/buscar-im/{self.token}",
                dados={
                    "FOR_SALE_OR_LOCATION": operacao, "TYPE": "Todos", "CITY": cidade,
                    "NEIGHBORHOOD": "Todos", "QUARTO": "Todos", "GARAGEM": "Todos",
                    "MIN_VALUE_FOR_SALE": "Todos", "MAX_VALUE_FOR_SALE": "Todos",
                    "MIN_VALUE_LOCATION": "Todos", "MAX_VALUE_LOCATION": "Todos",
                    "LIMIT": offset,     # sim, e o offset
                },
                headers={"Content-Type": "application/json", "Origin": self.site},
                json_resp=True,
            )
            lote = (resposta or {}).get("data") or []
            if not lote:
                return
            yield from lote
            offset += POR_PAGINA
            if offset >= int((resposta or {}).get("totalItens") or 0):
                return

    def _fotos(self, codigo: str, r: dict) -> list[str]:
        """A busca traz so a foto de capa; a galeria completa e outro endpoint."""
        nomes = []
        galeria = self.s.get(f"{API}/galery/{self.token}/{codigo}", json_resp=True)
        for foto in galeria or []:
            if isinstance(foto, dict) and foto.get("nome_foto"):
                nomes.append(foto["nome_foto"])
        if not nomes and nz.limpa(r.get("nome_foto")):
            nomes = [r["nome_foto"]]
        host = self.site.replace("https://", "https://www.").replace("www.www.", "www.")
        return [f"{host}/fotos/{n}" for n in nomes[:40]]

    # -- conversao ------------------------------------------------------
    def _converte(self, r: dict, operacao: int) -> dict | None:
        codigo = nz.limpa(r.get("id_im"))
        # A API devolve uma linha vazia de cabecalho em algumas contas.
        if not codigo or len(codigo) < 4 or not nz.limpa(r.get("tipo_imovel")):
            return None

        valor = nz.preco(r.get("valor"))
        endereco = nz.limpa((r.get("end_im") or "").strip(" ,"))
        fotos = self._fotos(codigo, r)

        return {
            "url": f"{self.site}/resultado/{codigo}",
            "codigo": nz.limpa(r.get("chave_im")) or codigo,
            "finalidade": "aluguel" if operacao == LOCACAO else "venda",
            "tipo": nz.tipo_imovel(r.get("tipo_imovel") or "", r.get("finalidade_im") or ""),
            "titulo": nz.titulo(" ".join(filter(None, [
                r.get("finalidade_im") or r.get("tipo_imovel"),
                "em", nz.bairro(r.get("bairro_im")) or "", "-", nz.cidade(r.get("cidade_im")) or ""]))),
            "descricao": nz.limpa(r.get("carac_moradia") or r.get("carac_lote") or r.get("carac_rural")),
            "preco": valor if operacao == VENDA else None,
            "preco_aluguel": valor if operacao == LOCACAO else None,
            **_areas(r),
            "quartos": nz.inteiro(r.get("quarto")),
            "suites": nz.inteiro(r.get("suite")),
            "banheiros": nz.inteiro(r.get("banheiro")),
            "vagas": nz.inteiro(r.get("garagem")),
            "endereco": endereco,
            "bairro": nz.bairro(r.get("bairro_im")),
            "cidade": nz.cidade(r.get("cidade_im")),
            "uf": "MG",
            "latitude": nz.numero(r.get("lat_im")),
            "longitude": nz.numero(r.get("lng_im")),
            "foto_capa": fotos[0] if fotos else None,
            "fotos": fotos,
            "caracteristicas": [nome for nome, qtd in (
                ("Sala", r.get("sala")), ("Cozinha", r.get("cozinha")),
                ("Copa", r.get("copa")), ("Varanda", r.get("varanda")),
                ("Quintal", r.get("quintal"))) if nz.inteiro(qtd)],
            "bruto": {"id_im": r.get("id_im"), "setor": r.get("setor"),
                      "desc_tip_im": r.get("desc_tip_im")},
        }


def _areas(r: dict) -> dict:
    """Separa area do terreno de area construida.

    O campo AREA_TOTAL dessa API e ambiguo: em imovel com terreno separado
    ("AREA_TERR": 330, "AREA_TOTAL": 131,81) ele e a area construida, mas
    em lote sem construcao ele e a propria area do terreno. Os campos de
    nome inequivoco decidem; AREA_TOTAL so entra no que sobrar.
    """
    terreno = nz.area(r.get("AREA_TERR") or r.get("area_lote") or r.get("area_rural"))
    construida = nz.area(r.get("AREA_PRIVATIVA") or r.get("AREA_CONST"))
    total = nz.area(r.get("AREA_TOTAL"))

    if total and terreno and not construida:
        construida = total          # o terreno ja veio em campo proprio
    elif total and not terreno:
        terreno = total
    return {"area_total": terreno, "area_util": construida}
