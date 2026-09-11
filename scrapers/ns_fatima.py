"""Imobiliária Nossa Senhora de Fátima."""
from imobiapp.platforms.waysoft import Waysoft


class NsFatima(Waysoft):
    """Mesma plataforma Waysoft da LBraga, com token próprio."""

    slug = "ns-fatima"
    nome = "Imobiliária Nossa Senhora de Fátima"
    site = "https://imobiliariansfatima.com.br"
    token = "532b8b8ce631e862e709826c0bd06d1a"
