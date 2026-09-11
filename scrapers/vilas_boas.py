"""Vilas Boas Imóveis."""
from imobiapp.platforms.imobibrasil import ImobiBrasil


class VilasBoas(ImobiBrasil):
    """Template antigo do ImobiBrasil, sem sitemap.

    O catalogo sai de `?conteudo=imoveis_home`: em `?conteudo=imoveis` este
    site devolve so o formulario de busca, sem os cards.
    """

    slug = "vilas-boas"
    nome = "Vilas Boas Imóveis"
    site = "https://www.vilasboasimoveis.com"
    paginas_listagem = ("/?conteudo=imoveis_home", "/?conteudo=imoveis")
