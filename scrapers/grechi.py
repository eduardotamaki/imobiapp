"""Grechi Imóveis."""
from imobiapp.base import SemScraper


class Grechi(SemScraper):
    """Dominio nao responde (verificado na montagem do catalogo e de novo em nov/2026)."""

    slug = "grechi"
    nome = "Grechi Imóveis"
    site = "https://grechiimoveis.com.br"
    status = 'offline'
