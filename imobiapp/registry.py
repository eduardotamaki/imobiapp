"""Registro das imobiliarias: um scraper por site.

Cada imobiliaria tem seu modulo em `scrapers/`, que so amarra nome, site e
a plataforma que aquele cliente contratou. A logica de extracao mora em
`imobiapp/platforms/`, porque quase toda imobiliaria de Itajuba usa uma das
plataformas de mercado - escrever 31 parsers independentes seria copiar o
mesmo codigo 31 vezes.
"""
from __future__ import annotations

import importlib
import pkgutil

from .base import Scraper

_cache: list[type[Scraper]] | None = None


def todos() -> list[type[Scraper]]:
    """Todas as classes de scraper declaradas em scrapers/."""
    global _cache
    if _cache is not None:
        return _cache

    import scrapers

    achados: list[type[Scraper]] = []
    for mod in pkgutil.iter_modules(scrapers.__path__):
        if mod.name.startswith("_"):
            continue
        modulo = importlib.import_module(f"scrapers.{mod.name}")
        for obj in vars(modulo).values():
            if (isinstance(obj, type) and issubclass(obj, Scraper)
                    and obj.__module__ == modulo.__name__ and obj.slug):
                achados.append(obj)
    _cache = sorted(achados, key=lambda c: c.slug)
    return _cache


def por_slug(slug: str) -> type[Scraper] | None:
    return next((c for c in todos() if c.slug == slug), None)


def seleciona(slugs: list[str] | None, incluir_inativos: bool = False) -> list[type[Scraper]]:
    classes = todos()
    if slugs:
        pedidos = {s.strip() for s in slugs if s.strip()}
        escolhidas = [c for c in classes if c.slug in pedidos]
        faltando = pedidos - {c.slug for c in escolhidas}
        if faltando:
            raise SystemExit(f"scraper desconhecido: {', '.join(sorted(faltando))}")
        return escolhidas
    if incluir_inativos:
        return classes
    return [c for c in classes if c.status == "ativa"]
