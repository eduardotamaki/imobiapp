"""Pamplona Corretores de Imóveis."""
from imobiapp.base import SemScraper


class Pamplona(SemScraper):
    """Dominio nao responde (verificado na montagem do catalogo e de novo em nov/2026)."""

    slug = "pamplona"
    nome = "Pamplona Corretores de Imóveis"
    site = "https://pamplonacorretordeimoveis.com.br"
    status = 'offline'
