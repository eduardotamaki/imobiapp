"""Karol Imóveis."""
from imobiapp.platforms.universal import Universal


class Karol(Universal):
    """Plataforma Universal, mas o backend do site esta fora do ar.

    Qualquer pagina de imovel responde com
    {"error": true, ... "401 Unauthorized" ... "redirect": "/manutencao"},
    ou seja, o problema e na assinatura da imobiliaria com a plataforma.
    O scraper fica pronto e passa a render sozinho quando normalizarem.
    """

    slug = "karol"
    nome = "Karol Imóveis"
    site = "https://www.karoldamazioimoveis.com.br"
    obs = "Backend do site fora do ar (401 na plataforma); coleta volta sozinha."
