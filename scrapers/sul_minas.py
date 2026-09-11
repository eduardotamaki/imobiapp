"""Sul Minas Imóveis."""
from imobiapp.platforms.imobibrasil import ImobiBrasil


class SulMinas(ImobiBrasil):
    """Template antigo do ImobiBrasil, sem sitemap."""

    slug = "sul-minas"
    nome = "Sul Minas Imóveis"
    site = "https://www.sulminasimoveis.com.br"
    paginas_listagem = ('/?conteudo=imoveis',)
