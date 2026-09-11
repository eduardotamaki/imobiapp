"""Mohallem Imóveis."""
from imobiapp.platforms.arbo import Arbo


class Mohallem(Arbo):
    """Plataforma Arbo.

    O "www" no endereço é obrigatório: o domínio sem www responde com
    certificado inválido, e era por isso que o site parecia fora do ar.
    """

    slug = "mohallem"
    nome = "Mohallem Imóveis"
    site = "https://www.mohallemimoveis.com.br"
