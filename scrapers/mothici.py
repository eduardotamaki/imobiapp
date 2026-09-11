"""Mothici Imóveis."""
from imobiapp.base import SemScraper


class Mothici(SemScraper):
    """Dominio nao responde (verificado na montagem do catalogo)."""

    slug = "mothici"
    nome = "Mothici Imóveis"
    site = "https://mothiciimoveis.com.br"
    status = 'offline'
