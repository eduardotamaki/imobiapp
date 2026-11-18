"""Faria & Mandolesi."""
from imobiapp.platforms.imobibrasil import ImobiBrasil


class FariaMandolesi(ImobiBrasil):
    """Conta na ImobiBrasil desativada: o dominio serve a pagina de vendas da plataforma.

    Verificado em nov/2026; sem site novo encontrado. Para reativar, basta
    voltar status para 'ativa' quando o site voltar.
    """

    slug = "faria-mandolesi"
    nome = "Faria & Mandolesi"
    site = "https://www.fariaemandolesi.com.br"
    status = "offline"
    obs = "Site desativado na ImobiBrasil (domínio mostra a página da plataforma)."
