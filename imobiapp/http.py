"""Busca HTTP com cache em disco, retry e limite de taxa por dominio.

O cache existe para que reprocessar/ajustar um parser nao gere trafego novo
nos sites das imobiliarias. Use `--sem-cache` para forcar coleta nova.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import random
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
TETO_RESPOSTA = 25 * 1024 * 1024   # 25 MB

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(RAIZ, "data", "cache")

_trava = threading.Lock()
_ultimo_acesso: dict[str, float] = {}


class ErroHTTP(Exception):
    pass


class Sessao:
    def __init__(self, usar_cache=True, ttl_horas=24, intervalo=1.0, timeout=30,
                 tentativas=3, verbose=False):
        self.usar_cache = usar_cache
        self.ttl = ttl_horas * 3600
        self.intervalo = intervalo   # segundos minimos entre hits no mesmo dominio
        self.timeout = timeout
        self.tentativas = tentativas
        self.verbose = verbose
        os.makedirs(CACHE_DIR, exist_ok=True)

    # -- cache ----------------------------------------------------------
    def _caminho_cache(self, url: str, corpo: bytes | None) -> str:
        chave = hashlib.sha256((url + (corpo.decode("utf-8", "replace") if corpo else "")).encode()).hexdigest()
        return os.path.join(CACHE_DIR, chave[:2], chave + ".gz")

    def _le_cache(self, caminho: str):
        if not self.usar_cache or not os.path.exists(caminho):
            return None
        if self.ttl and (time.time() - os.path.getmtime(caminho)) > self.ttl:
            return None
        try:
            with gzip.open(caminho, "rt", encoding="utf-8") as fh:
                return fh.read()
        except Exception:
            return None

    def _grava_cache(self, caminho: str, texto: str) -> None:
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        tmp = caminho + ".tmp"
        with gzip.open(tmp, "wt", encoding="utf-8") as fh:
            fh.write(texto)
        os.replace(tmp, caminho)

    # -- rede -----------------------------------------------------------
    def _espera_vez(self, url: str) -> None:
        dom = urllib.parse.urlsplit(url).netloc
        with _trava:
            agora = time.monotonic()
            espera = self.intervalo - (agora - _ultimo_acesso.get(dom, 0.0))
            if espera > 0:
                time.sleep(espera + random.uniform(0, 0.3))
            _ultimo_acesso[dom] = time.monotonic()

    def get(self, url: str, *, dados=None, headers=None, json_resp=False):
        corpo = None
        if dados is not None:
            corpo = (json.dumps(dados) if isinstance(dados, (dict, list)) and headers
                     and "json" in str(headers.get("Content-Type", "")).lower()
                     else urllib.parse.urlencode(dados)).encode()

        caminho = self._caminho_cache(url, corpo)
        texto = self._le_cache(caminho)
        if texto is None:
            texto = self._baixa(url, corpo, headers)
            if texto is None:
                return None
            self._grava_cache(caminho, texto)
        elif self.verbose:
            print(f"    cache {url}")

        if json_resp:
            try:
                return json.loads(texto)
            except json.JSONDecodeError:
                return None
        return texto

    def _baixa(self, url: str, corpo, headers):
        h = {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        }
        if headers:
            h.update(headers)

        for tentativa in range(1, self.tentativas + 1):
            self._espera_vez(url)
            try:
                req = urllib.request.Request(url, data=corpo, headers=h)
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    # Teto de leitura: ha endpoint nesses sites que responde
                    # centenas de MB quando recebe parametro que nao espera.
                    dados = r.read(TETO_RESPOSTA + 1)
                    if len(dados) > TETO_RESPOSTA:
                        if self.verbose:
                            print(f"    resposta grande demais, ignorada: {url}")
                        return None
                    if r.headers.get("Content-Encoding") == "gzip":
                        dados = gzip.decompress(dados)
                    if self.verbose:
                        print(f"    GET {r.status} {url}")
                    return _decodifica(dados, r.headers.get("Content-Type", ""))
            except urllib.error.HTTPError as e:
                if e.code in (404, 410, 403):   # nao adianta insistir
                    if self.verbose:
                        print(f"    {e.code} {url}")
                    return None
                erro = f"HTTP {e.code}"
            except Exception as e:
                erro = type(e).__name__
            if tentativa == self.tentativas:
                if self.verbose:
                    print(f"    falhou ({erro}) {url}")
                return None
            time.sleep(2 ** tentativa)
        return None


_RE_META_CHARSET = re.compile(
    rb"""<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)""", re.I
)


def _decodifica(dados: bytes, content_type: str) -> str:
    """Descobre o encoding pelo header e, se faltar, pela meta tag.

    Varios sites locais ainda servem ISO-8859-1 sem declarar no header HTTP.
    """
    enc = None
    if "charset=" in content_type.lower():
        enc = content_type.lower().split("charset=")[-1].split(";")[0].strip()
    if not enc:
        m = _RE_META_CHARSET.search(dados[:4096])
        if m:
            enc = m.group(1).decode("ascii", "ignore").lower()
    if enc in (None, "", "iso-8859-1", "latin-1", "latin1", "windows-1252"):
        # utf-8 primeiro: quem declara latin-1 as vezes entrega utf-8 mesmo.
        try:
            return dados.decode("utf-8")
        except UnicodeDecodeError:
            return dados.decode("cp1252", errors="replace")
    try:
        return dados.decode(enc, errors="replace")
    except LookupError:
        return dados.decode("utf-8", errors="replace")


def absoluta(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, (href or "").strip())
