"""JHS Corretor de Imóveis."""
from imobiapp.platforms.imobibrasil import ImobiBrasil


class Jhs(ImobiBrasil):
    """Template antigo do ImobiBrasil, sem sitemap."""

    slug = "jhs"
    nome = "JHS Corretor de Imóveis"
    site = "https://www.jhscorretordeimoveis.com.br"
    paginas_listagem = ('/?conteudo=imoveis',)
