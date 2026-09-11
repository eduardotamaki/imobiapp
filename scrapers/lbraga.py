"""LBraga Imóveis."""
from imobiapp.platforms.waysoft import Waysoft


class Lbraga(Waysoft):
    """Plataforma Waysoft: o HTML chega vazio e os dados vêm de uma API JSON.

    O token foi obtido observando as chamadas do site num navegador real.
    """

    slug = "lbraga"
    nome = "LBraga Imóveis"
    site = "https://lbragaimoveis.com.br"
    token = "2ed25cad1fa57c74b66cf06c9f737f5a"
