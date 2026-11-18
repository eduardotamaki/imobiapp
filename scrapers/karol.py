"""Karol Imóveis."""
from imobiapp.platforms.universal import Universal


class Karol(Universal):
    """Plataforma Universal no tema novo (endpoint /retornar-imoveis-disponiveis).

    O site ficou meses com o backend em manutencao (401 da plataforma) e
    voltou em nov/2026 com o tema novo.
    """

    slug = "karol"
    nome = "Karol Imóveis"
    site = "https://www.karoldamazioimoveis.com.br"
    api_nova = True
