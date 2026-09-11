"""Alpes Contabilidade e Imobiliária."""
from imobiapp.platforms.imobibrasil import ImobiBrasil


class Alpes(ImobiBrasil):
    """Template antigo do ImobiBrasil: o catalogo vive sob /imobiliaria/ e nao ha sitemap."""

    slug = "alpes"
    nome = "Alpes Contabilidade e Imobiliária"
    site = "https://alpescontabilidade.cnt.br"
    paginas_listagem = ('/imobiliaria/?conteudo=imoveis_home',)
