"""Utilitarios compartilhados pelos adaptadores."""
from __future__ import annotations

import json
import re
from html import unescape

from ..http import absoluta
from ..htmlx import parse, so_texto


# ------------------------------------------------------------ sitemaps

def urls_do_sitemap(sessao, url_sitemap: str, filtro: re.Pattern | str | None = None,
                    profundidade: int = 2) -> list[str]:
    """Le um sitemap (seguindo indices) e devolve as <loc> que casam com o filtro."""
    if isinstance(filtro, str):
        filtro = re.compile(filtro)
    xml = sessao.get(url_sitemap)
    if not xml:
        return []
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    achados: list[str] = []
    for loc in locs:
        loc = unescape(loc)
        if re.search(r"\.xml/?$", loc):
            if profundidade > 0:
                achados += urls_do_sitemap(sessao, loc, filtro, profundidade - 1)
        elif filtro is None or filtro.search(loc):
            achados.append(loc)
    return achados


# ------------------------------------------------------------ metadados

def metas(html: str) -> dict[str, str]:
    """Todas as <meta> name/property -> content, ja com entidades resolvidas."""
    d = {}
    for m in re.finditer(r"<meta\b[^>]*>", html, re.I):
        tag = m.group(0)
        chave = re.search(r'(?:property|name)\s*=\s*["\']([^"\']+)', tag, re.I)
        val = re.search(r'content\s*=\s*["\']([^"\']*)', tag, re.I)
        if chave and val:
            d[chave.group(1).lower()] = unescape(val.group(1)).strip()
    return d


def titulo_pagina(html: str) -> str | None:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    return so_texto(m.group(1)) if m else None


def jsonld(html: str) -> list[dict]:
    """Todos os objetos JSON-LD da pagina, ja achatados (@graph incluso)."""
    saida: list[dict] = []
    for bloco in re.findall(
        # O atributo as vezes vem sem aspas (<script type=application/ld+json>).
        r'<script[^>]*type=["\']?application/ld\+json["\']?[^>]*>(.*?)</script>',
        html, re.S | re.I,
    ):
        try:
            d = json.loads(bloco.strip())
        except json.JSONDecodeError:
            continue
        pilha = d if isinstance(d, list) else [d]
        while pilha:
            it = pilha.pop()
            if isinstance(it, list):
                pilha.extend(it)
            elif isinstance(it, dict):
                saida.append(it)
                if isinstance(it.get("@graph"), list):
                    pilha.extend(it["@graph"])
    return saida


def jsonld_tipo(html_ou_lista, *tipos: str) -> dict | None:
    itens = html_ou_lista if isinstance(html_ou_lista, list) else jsonld(html_ou_lista)
    alvos = {t.lower() for t in tipos}
    for it in itens:
        t = it.get("@type")
        nomes = {t.lower()} if isinstance(t, str) else {str(x).lower() for x in (t or [])}
        if nomes & alvos:
            return it
    return None


# ------------------------------------------------------------ conteudo

# Rotulos que aparecem nesses templates mas nao interessam: servem apenas
# para delimitar o fim do valor do campo anterior.
FRONTEIRAS = (
    r"mobiliado|aceita financiamento|aceita permuta|descri[çc][ãa]o(?: do im[óo]vel)?"
    r"|observa[çc][õo]es|caracter[íi]sticas|detalhes|localiza[çc][ãa]o|contato"
    r"|compartilhe|agende|whatsapp|telefone|e-?mail|refer[êe]ncia do an[úu]ncio"
    r"|valor por m|pre[çc]o por m|valor do m|em condom[íi]nio|aceita"
)


def rotulos(texto: str, chaves: dict[str, str]) -> dict[str, str]:
    """Varre texto no formato "Rotulo: valor" e devolve {campo: valor}.

    `chaves` mapeia campo -> regex do rotulo. Cada valor vai ate o inicio do
    proximo rotulo conhecido, o que evita engolir o campo seguinte. Formato
    muito comum nos templates em tabela (ImobiBrasil, Universal, Widesys).

    Campos cujo nome comeca com "_" servem so de fronteira e nao sao
    devolvidos: e como se corta um "Mobiliado: Nao" grudado no fim do valor
    anterior sem precisar mapear todo rotulo existente no site.
    """
    chaves = {**chaves, "_fronteira": FRONTEIRAS}
    ocorrencias = []
    for campo, padrao in chaves.items():
        # Fronteiras podem vir sem os dois-pontos (ex.: "› Descricao do Imovel").
        pontuacao = r"\s*:?\s*" if campo.startswith("_") else r"\s*:\s*"
        for m in re.finditer(rf"(?:^|[>\s;|·,›])({padrao}){pontuacao}", texto, re.I):
            ocorrencias.append((m.start(1), m.end(), campo))
    ocorrencias.sort()

    achados: dict[str, str] = {}
    for k, (ini, fim, campo) in enumerate(ocorrencias):
        limite = ocorrencias[k + 1][0] if k + 1 < len(ocorrencias) else len(texto)
        if campo.startswith("_"):
            continue
        valor = texto[fim:limite].strip(" .,;:·|›\t\n")
        if valor and campo not in achados:
            achados[campo] = valor[:120]
    return achados


_LIXO_FOTO = re.compile(
    r"/\.(?:jpe?g|png)|sem[-_]?foto|no[-_]?(?:image|photo)|placeholder|logo|blank|spacer|pixel",
    re.I,
)


def foto_util(url: str) -> bool:
    """Filtra placeholder: varios templates devolvem ".../320/.jpg" quando
    o imovel nao tem foto cadastrada."""
    return bool(url) and not _LIXO_FOTO.search(url)


def fotos_por_regex(html: str, base: str, padrao: str, limite: int = 40) -> list[str]:
    vistas, saida = set(), []
    for m in re.finditer(padrao, html, re.I):
        u = absoluta(base, unescape(m.group(0)))
        if u not in vistas and foto_util(u):
            vistas.add(u)
            saida.append(u)
        if len(saida) >= limite:
            break
    return saida


def links(html: str, base: str, padrao: str) -> list[str]:
    """Hrefs absolutos que casam com o padrao, na ordem de aparicao, sem repetir."""
    rx = re.compile(padrao, re.I)
    vistos, saida = set(), []
    for m in re.finditer(r'href\s*=\s*["\']([^"\']+)["\']', html, re.I):
        u = absoluta(base, unescape(m.group(1)))
        if rx.search(u) and u not in vistos:
            vistos.add(u)
            saida.append(u)
    return saida


def bloco_texto(html: str, seletor: str) -> str | None:
    doc = parse(html)
    n = doc.select_one(seletor)
    return n.text() if n else None


def textos_de(html: str, *seletores: str) -> str:
    """Concatena o texto dos blocos que casarem com os seletores dados."""
    doc = parse(html)
    partes = [n.text() for sel in seletores for n in doc.select(sel)]
    return " ".join(p for p in partes if p)


def bloco_com(html: str, padrao: str, tam_max: int = 700) -> str | None:
    """Menor elemento cujo texto casa com `padrao`."""
    rx = re.compile(padrao, re.I)
    melhor = None
    for t in _candidatos(html, 1, tam_max):
        if rx.search(t) and (melhor is None or len(t) < len(melhor)):
            melhor = t
    return melhor


def bloco_ficha(html: str, chaves: dict[str, str], tam_max: int = 900) -> str | None:
    """Acha o trecho que mais parece a ficha tecnica do imovel.

    Pegar "o menor bloco que contem 'Codigo:'" nao funciona: o formulario de
    busca costuma ter um rotulo "Codigo:" vazio, que ganharia por ser menor.
    Entao pontua-se cada candidato pela quantidade de campos que rende.
    """
    melhor, melhor_nota = None, 0
    for t in _candidatos(html, 20, tam_max):
        nota = len(rotulos(t, chaves))
        if nota > melhor_nota or (nota == melhor_nota and nota and len(t) < len(melhor)):
            melhor, melhor_nota = t, nota
    return melhor if melhor_nota >= 2 else None


def _candidatos(html: str, tam_min: int, tam_max: int) -> list[str]:
    """Textos de elementos no tamanho pedido, sem repetir e sem wrappers."""
    doc = parse(html)
    vistos: set[str] = set()
    saida: list[str] = []
    for n in doc.descendentes():
        if n.tag in ("script", "style", "head", "nav", "footer", "form", "select"):
            continue
        t = n.text()
        if tam_min <= len(t) <= tam_max and t not in vistos:
            vistos.add(t)
            saida.append(t)
    return saida


def contadores_por_icone(html: str) -> dict[str, int]:
    """Le "3 <i class='fa-bed'>" / "<i class='fa-bath'></i> 2" dos templates
    que so mostram quartos, banheiros e vagas como iconezinhos."""
    mapa = {
        "quartos": r"fa-bed|icon-bed|dormitorio|bedroom",
        "banheiros": r"fa-bath|fa-shower|icon-bath|banheiro|bathroom",
        "vagas": r"fa-car|icon-car|garagem|garage|parking",
        "area_util": r"fa-ruler|fa-expand|icon-area|fa-vector-square",
    }
    # O formulario de busca tem <select> com "1..30" e os mesmos iconezinhos:
    # sem tirar isso da frente, todo imovel viraria "30 quartos".
    texto = re.sub(r"<(script|style|select|form|nav|footer)\b.*?</\1>", " ",
                   html, flags=re.S | re.I)
    saida: dict[str, int] = {}
    for campo, padrao in mapa.items():
        for m in re.finditer(rf'<i[^>]*class="[^"]*(?:{padrao})[^"]*"[^>]*>\s*</i>', texto, re.I):
            # O numero tem que estar colado no icone (ate ~6 caracteres de
            # distancia); senao qualquer numero da pagina vira "30 quartos".
            antes = so_texto(texto[max(0, m.start() - 150):m.start()])
            depois = so_texto(texto[m.end():m.end() + 80])
            num = (re.search(r"(\d{1,2})\s{0,3}$", antes)
                   or re.search(r"^\s{0,3}(\d{1,2})\b", depois))
            if num:
                saida[campo] = int(num.group(1))
                break
    return saida


def pares_rotulados(html: str, seletor: str = "li") -> dict[str, str]:
    """Le listas no formato "<li><b>Rotulo:</b> valor</li>".

    Devolve {rotulo sem acento e minusculo: valor}.
    """
    from .. import normalize as nz

    doc = parse(html)
    saida: dict[str, str] = {}
    for item in doc.select(seletor):
        forte = item.select_one("b") or item.select_one("strong")
        if forte is None:
            continue
        rotulo = forte.text().strip(" :")
        inteiro = item.text()
        valor = inteiro[len(forte.text()):].strip(" :")
        if rotulo and valor:
            saida.setdefault(nz.sem_acento(rotulo).lower(), valor)
    return saida


# Formas em que bairro e cidade aparecem no titulo/descricao do anuncio.
_PADROES_LOCAL = (
    # "... bairro Centro em Itajubá, Minas Gerais"   (Jetimob)
    r"bairro\s+(?P<bairro>[\wÀ-ÿ'.\s]{2,40}?)\s+em\s+(?P<cidade>[\wÀ-ÿ'.\s]{2,40}?)"
    r"\s*(?:[,/]\s*(?P<uf>[A-Z]{2}|Minas Gerais|São Paulo|Rio de Janeiro)|$)",
    # "Terreno Lote em Nossa Senhora de Fátima, Itajubá/MG"   (Tecimob)
    r"\bem\s+(?P<bairro>[\wÀ-ÿ'.\s]{2,40}?)\s*,\s*(?P<cidade>[\wÀ-ÿ'.\s]{2,40}?)\s*/\s*(?P<uf>[A-Z]{2})",
    # "... NO PINHEIRINHO EM ITAJUBÁ-MG"   (Widesys)
    r"\bn[oa]\s+(?P<bairro>[\wÀ-ÿ'.\s]{2,40}?)\s+em\s+(?P<cidade>[\wÀ-ÿ'.\s]{2,40}?)\s*[-/]\s*(?P<uf>[A-Z]{2})\b",
    # "Casa com 2 dormitórios ... - Açude - Itajubá/MG"   (Apre)
    r"-\s*(?P<bairro>[^-,]{2,40}?)\s*-\s*(?P<cidade>[^-,/]{2,40}?)\s*/\s*(?P<uf>[A-Z]{2})\s*$",
    # "Aluga-se Kitnet no Centro de Itajubá!"
    r"\bn[oa]\s+(?P<bairro>[\wÀ-ÿ'.\s]{2,30}?)\s+de\s+(?P<cidade>[\wÀ-ÿ'.\s]{2,30}?)\s*[!.,]?\s*$",
    # "Vendo ótima casa no bairro Varginha" - so o bairro
    r"\bno bairro\s+(?P<bairro>[\wÀ-ÿ'.\s]{2,30}?)\s*[!.,]?\s*$",
)

_UF_POR_EXTENSO = {"minas gerais": "MG", "são paulo": "SP", "rio de janeiro": "RJ"}


def local_do_titulo(*textos: str | None) -> dict[str, str]:
    """Tira bairro/cidade/UF do titulo quando o site nao os publica em campo.

    Vale como ultimo recurso: o titulo e escrito a mao e nem sempre segue o
    padrao, entao so se aceita o que casar inteiro com um dos formatos.
    """
    from .. import normalize as nz

    parcial: dict[str, str] = {}
    for texto in textos:
        if not texto:
            continue
        for padrao in _PADROES_LOCAL:
            m = re.search(padrao, texto, re.I)
            if not m:
                continue
            g = m.groupdict()
            uf = (g.get("uf") or "").strip()
            uf = _UF_POR_EXTENSO.get(uf.lower(), uf).upper()
            achado = {
                "bairro": nz.bairro(g.get("bairro")),
                "cidade": nz.cidade(g.get("cidade")),
                "uf": nz.uf(uf) or _uf_por_extenso_no_texto(texto),
            }
            achado = {k: v for k, v in achado.items() if v}
            if achado.get("bairro") and achado.get("cidade"):
                return achado
            # Titulo que so diz o bairro ainda serve; guarda e segue
            # procurando um padrao mais completo nos demais textos.
            parcial = parcial or achado
    return parcial


def _uf_por_extenso_no_texto(texto: str) -> str | None:
    baixo = texto.lower()
    return next((s for e, s in _UF_POR_EXTENSO.items() if e in baixo), None)
