"""Parser HTML minimalista com um subconjunto de seletores CSS.

O ambiente nao tem BeautifulSoup/lxml e nao ha pip disponivel, entao esse
modulo implementa o necessario em cima do `html.parser` da stdlib.

Seletores suportados:
    tag  .classe  #id  [attr]  [attr=v]  [attr*=v]  [attr^=v]  [attr$=v]
    combinacao por descendencia ("div .preco") e por filho direto ("ul > li")
    grupos separados por virgula
"""
from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser

# Tags que nunca tem fechamento.
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
# Conteudo que nao deve entrar no texto visivel.
INVISIVEL = {"script", "style", "noscript", "template", "svg", "head"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent", "_data")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children: list[Node] = []
        self.parent: Node | None = parent
        self._data: str | None = None  # preenchido apenas em nos de texto

    # -- basico ---------------------------------------------------------
    @property
    def is_text(self) -> bool:
        return self.tag == "#text"

    def attr(self, name: str, default=None):
        return self.attrs.get(name, default)

    @property
    def classes(self) -> set[str]:
        return set((self.attrs.get("class") or "").split())

    def text(self, sep: str = " ") -> str:
        """Texto visivel concatenado e com espacos normalizados."""
        partes: list[str] = []
        self._coleta_texto(partes)
        return re.sub(r"\s+", " ", sep.join(partes)).strip()

    def _coleta_texto(self, out: list[str]) -> None:
        if self.is_text:
            if self._data:
                out.append(self._data)
            return
        if self.tag in INVISIVEL:
            return
        for c in self.children:
            c._coleta_texto(out)

    def html(self) -> str:
        """Texto bruto aproximado (util para debug)."""
        if self.is_text:
            return self._data or ""
        dentro = "".join(c.html() for c in self.children)
        attrs = "".join(f' {k}="{v}"' for k, v in self.attrs.items())
        return f"<{self.tag}{attrs}>{dentro}</{self.tag}>"

    # -- navegacao ------------------------------------------------------
    def descendentes(self):
        for c in self.children:
            if not c.is_text:
                yield c
                yield from c.descendentes()

    def ancestrais(self):
        n = self.parent
        while n is not None:
            yield n
            n = n.parent

    def prox_irmao(self):
        """Proximo irmao que seja elemento (ignora nos de texto)."""
        if self.parent is None:
            return None
        irmaos = [c for c in self.parent.children if not c.is_text]
        try:
            i = irmaos.index(self)
        except ValueError:
            return None
        return irmaos[i + 1] if i + 1 < len(irmaos) else None

    # -- seletores ------------------------------------------------------
    def select(self, seletor: str) -> list["Node"]:
        achados: list[Node] = []
        vistos: set[int] = set()
        for grupo in seletor.split(","):
            for n in self._select_grupo(grupo.strip()):
                if id(n) not in vistos:
                    vistos.add(id(n))
                    achados.append(n)
        return achados

    def select_one(self, seletor: str):
        r = self.select(seletor)
        return r[0] if r else None

    def _select_grupo(self, grupo: str) -> list["Node"]:
        partes = _tokeniza_combinadores(grupo)
        atuais = [self]
        for combinador, simples in partes:
            proximos: list[Node] = []
            vistos: set[int] = set()
            for base in atuais:
                candidatos = (
                    [c for c in base.children if not c.is_text]
                    if combinador == ">"
                    else base.descendentes()
                )
                for c in candidatos:
                    if id(c) not in vistos and _casa(c, simples):
                        vistos.add(id(c))
                        proximos.append(c)
            atuais = proximos
            if not atuais:
                break
        return atuais


_RE_SIMPLES = re.compile(
    r"""
    (?P<tag>^[A-Za-z][\w-]*|^\*)
  | \.(?P<cls>[\w-]+)
  | \#(?P<id>[\w-]+)
  | \[(?P<attr>[\w:-]+)(?:(?P<op>[*^$]?=)(?P<q>["']?)(?P<val>[^\]"']*)(?P=q))?\]
    """,
    re.X,
)


def _tokeniza_combinadores(grupo: str):
    """"a > b c" -> [(' ', 'a'), ('>', 'b'), (' ', 'c')]"""
    itens = re.split(r"\s*(>)\s*|\s+", grupo.strip())
    itens = [i for i in itens if i]
    saida = []
    combinador = " "
    for it in itens:
        if it == ">":
            combinador = ">"
            continue
        saida.append((combinador, it))
        combinador = " "
    return saida


def _casa(node: "Node", simples: str) -> bool:
    pos = 0
    houve = False
    while pos < len(simples):
        m = _RE_SIMPLES.match(simples, pos)
        if not m:
            return False
        houve = True
        pos = m.end()
        if m.group("tag"):
            if m.group("tag") != "*" and node.tag != m.group("tag").lower():
                return False
        elif m.group("cls"):
            if m.group("cls") not in node.classes:
                return False
        elif m.group("id"):
            if node.attr("id") != m.group("id"):
                return False
        elif m.group("attr"):
            nome, op, val = m.group("attr"), m.group("op"), m.group("val")
            atual = node.attr(nome)
            if atual is None:
                return False
            if op == "=" and atual != val:
                return False
            if op == "*=" and val not in atual:
                return False
            if op == "^=" and not atual.startswith(val):
                return False
            if op == "$=" and not atual.endswith(val):
                return False
    return houve


class _Construtor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = Node("#document")
        self.pilha = [self.raiz]

    def handle_starttag(self, tag, attrs):
        pai = self.pilha[-1]
        n = Node(tag, {k: (v if v is not None else "") for k, v in attrs}, pai)
        pai.children.append(n)
        if tag not in VOID:
            self.pilha.append(n)

    def handle_startendtag(self, tag, attrs):
        pai = self.pilha[-1]
        pai.children.append(
            Node(tag, {k: (v if v is not None else "") for k, v in attrs}, pai)
        )

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # Fecha ate encontrar a tag correspondente; tolera HTML mal formado.
        for i in range(len(self.pilha) - 1, 0, -1):
            if self.pilha[i].tag == tag:
                del self.pilha[i:]
                return

    def handle_data(self, data):
        if data.strip():
            n = Node("#text", parent=self.pilha[-1])
            n._data = data
            self.pilha[-1].children.append(n)


def parse(texto: str) -> Node:
    p = _Construtor()
    try:
        p.feed(texto)
        p.close()
    except Exception:
        pass  # HTML quebrado: devolve o que deu pra montar
    return p.raiz


def so_texto(bruto: str) -> str:
    """Extrai texto de um trecho de HTML sem montar a arvore."""
    limpo = re.sub(r"<(script|style)\b.*?</\1>", " ", bruto, flags=re.S | re.I)
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", limpo))).strip()
