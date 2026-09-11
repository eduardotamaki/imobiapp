"""Normalizacao dos campos crus que saem de cada site."""
from __future__ import annotations

import re
import unicodedata

# ---------------------------------------------------------------- texto

def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if unicodedata.category(c) != "Mn")


def slug(s: str) -> str:
    s = sem_acento(s or "").lower()
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")


def limpa(s) -> str | None:
    # Campos opcionais dessas APIs as vezes vem como booleano em vez de texto;
    # sem isso o titulo do imovel viraria "True".
    if s is None or isinstance(s, bool):
        return None
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s or None


def titulo(s: str | None) -> str | None:
    s = limpa(s)
    if not s:
        return None
    # Muitos sites gritam em CAIXA ALTA; deixa legivel sem estragar siglas.
    if s.isupper() and len(s) > 3:
        s = s.title()
    return s

# --------------------------------------------------------------- numeros

_MOEDA = re.compile(r"R?\$?\s*([\d][\d\.\s]*(?:,\d{1,2})?)")
# Valor ja em formato de maquina ("310000.00", "1.5"), como vem das APIs.
# O ponto so e decimal quando NAO agrupa de 3 em 3: "1.500" continua sendo
# mil e quinhentos em pt-BR, enquanto "142.00" e cento e quarenta e dois.
_NUM_MAQUINA = re.compile(r"^\s*-?\d+(?:\.\d{1,2})?\s*$")
_MILHAR_BR = re.compile(r"^\s*\d{1,3}(?:\.\d{3})+\s*$")


def _eh_maquina(t: str) -> bool:
    return bool(_NUM_MAQUINA.match(t)) and not _MILHAR_BR.match(t)


def preco(s) -> float | None:
    """'R$ 1.250.000,00' -> 1250000.0 ; ignora 'sob consulta'."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s) or None
    t = str(s)
    if _eh_maquina(t):
        return float(t) or None
    if re.search(r"consulta|combinar|sob\s*cons", t, re.I):
        return None
    m = _MOEDA.search(t)
    if not m:
        return None
    bruto = m.group(1).replace(" ", "").replace(".", "").replace(",", ".")
    try:
        v = float(bruto)
    except ValueError:
        return None
    return v if v > 0 else None


def preco_estrito(s) -> float | None:
    """Como `preco`, mas so aceita valor que COMECE com numero ou R$.

    Evita que um rotulo vizinho vaze pro campo: "Em Condominio: Sim Valor
    por m2: 61.600,00" nao pode virar taxa de condominio de R$ 61.600.
    """
    if s is None or isinstance(s, (int, float)):
        return preco(s)
    if not re.match(r"^\s*(?:R\$|\d)", str(s)):
        return None
    return preco(s)


# Varias imobiliarias cadastram 0,01 ou 1,00 no lugar de "consulte-nos".
PISO_VENDA = 1_000.0
PISO_ALUGUEL = 50.0


def preco_plausivel(valor: float | None, finalidade: str | None = "venda") -> float | None:
    """Descarta valor simbolico usado como 'sob consulta'."""
    if not valor:
        return None
    piso = PISO_ALUGUEL if (finalidade or "").startswith("alug") else PISO_VENDA
    return valor if valor >= piso else None


def numero(s) -> float | None:
    """Primeiro numero de um texto: '250,50 m²' -> 250.5"""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    if _eh_maquina(str(s)):
        return float(s)
    # O sinal importa: latitude/longitude no Brasil sao negativas.
    m = re.search(r"(-?\d[\d\.]*(?:,\d+)?)", str(s))
    if not m:
        return None
    t = m.group(1)
    negativo = t.startswith("-")
    t = t.lstrip("-")
    # Ponto so e separador de milhar quando agrupa de 3 em 3.
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        t = t.replace(".", "")
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if negativo else v


def inteiro(s) -> int | None:
    v = numero(s)
    return int(v) if v is not None else None


def area(s) -> float | None:
    """Devolve sempre em m2: '309,54 m²', '120m2', '2 Hectares' -> 20000."""
    v = numero(s)
    if v is None or v <= 0:
        return None
    t = sem_acento(str(s)).lower()
    if re.search(r"\bhectare|\bha\b", t):
        v *= 10_000
    elif re.search(r"alqueire", t):
        v *= 48_400          # alqueire mineiro
    elif re.search(r"\bkm2|km²|quil[o]metro", t):
        v *= 1_000_000
    return round(v, 2)

# ----------------------------------------------------------- categorias

_TIPOS = [
    ("apartamento", r"apart|apto|\bap\b|flat|kitnet|kitinete|studio|loft"),
    ("casa_condominio", r"casa\s*(de|em)\s*cond|sobrado\s*em\s*cond|condom[ií]nio\s*fechado"),
    # "residencial" e categoria de uso, nao tipo: nao pode virar casa.
    ("casa", r"\bcasa\b|sobrado|resid[êe]ncia\b"),
    ("terreno", r"terreno|lote|[áa]rea\b|gleba"),
    ("chacara", r"ch[áa]cara|s[íi]tio|fazenda|rancho|rural"),
    ("comercial", r"sala|loja|galp[ãa]o|pr[ée]dio|comercial|conjunto|ponto\b|barrac[ãa]o|escrit[óo]rio"),
    ("cobertura", r"cobertura"),
    ("garagem", r"vaga\s*de\s*garagem|box\b"),
]


def tipo_imovel(*textos) -> str | None:
    t = sem_acento(" ".join(x for x in textos if x)).lower()
    if not t:
        return None
    for nome, padrao in _TIPOS:
        if re.search(sem_acento(padrao), t):
            return nome
    return None


def finalidade(*textos) -> str | None:
    t = sem_acento(" ".join(x for x in textos if x)).lower()
    aluga = re.search(r"alug|loca[cç]|rent|/alugar|temporada", t)
    vende = re.search(r"venda|vender|comprar|/comprar|a-venda|sale", t)
    if aluga and vende:
        return "venda_aluguel"
    if aluga:
        return "aluguel"
    if vende:
        return "venda"
    return None

# ----------------------------------------------------------- localizacao

_UF = re.compile(r"\b(MG|SP|RJ|ES|PR|SC|RS|BA|GO|DF|MS|MT)\b")


def uf(s: str | None) -> str | None:
    m = _UF.search((s or "").upper())
    return m.group(1) if m else None


def cep(s: str | None) -> str | None:
    m = re.search(r"(\d{5})-?(\d{3})", str(s or ""))
    return f"{m.group(1)}-{m.group(2)}" if m else None


def cidade(s: str | None) -> str | None:
    c = limpa(s)
    if not c:
        return None
    c = re.sub(r"[/,-]\s*[A-Z]{2}\s*$", "", c).strip()
    return titulo(c)


def bairro(s: str | None) -> str | None:
    return titulo(limpa(s))
