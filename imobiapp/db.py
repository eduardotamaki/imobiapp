"""Esquema SQLite e gravacao dos imoveis coletados."""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMINHO_PADRAO = os.path.join(RAIZ, "data", "imoveis.db")

ESQUEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS imobiliarias (
    id            INTEGER PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    nome          TEXT NOT NULL,
    site          TEXT NOT NULL,
    plataforma    TEXT,
    status        TEXT NOT NULL DEFAULT 'ativa',   -- ativa | offline | sem_scraper
    obs           TEXT,
    ultima_coleta TEXT
);

CREATE TABLE IF NOT EXISTS imoveis (
    id             INTEGER PRIMARY KEY,
    imobiliaria_id INTEGER NOT NULL REFERENCES imobiliarias(id) ON DELETE CASCADE,
    codigo         TEXT,              -- codigo/referencia do anuncio no site
    url            TEXT NOT NULL UNIQUE,
    finalidade     TEXT,              -- venda | aluguel | venda_aluguel
    tipo           TEXT,              -- casa | apartamento | terreno | ...
    titulo         TEXT,
    descricao      TEXT,

    preco          REAL,
    preco_aluguel  REAL,
    condominio     REAL,
    iptu           REAL,

    area_total     REAL,
    area_util      REAL,
    quartos        INTEGER,
    suites         INTEGER,
    banheiros      INTEGER,
    vagas          INTEGER,

    endereco       TEXT,
    bairro         TEXT,
    cidade         TEXT,
    -- Versao sem acento e em minusculas, so para busca: o SQLite nao sabe
    -- comparar "Itajuba" com "Itajubá".
    cidade_busca   TEXT,
    bairro_busca   TEXT,
    uf             TEXT,
    cep            TEXT,
    latitude       REAL,
    longitude      REAL,

    foto_capa      TEXT,
    status         TEXT NOT NULL DEFAULT 'disponivel',  -- disponivel | removido
    visto_em       TEXT NOT NULL,      -- ultima coleta em que apareceu
    criado_em      TEXT NOT NULL,      -- primeira vez que foi visto
    atualizado_em  TEXT NOT NULL,
    hash_conteudo  TEXT,
    bruto          TEXT                -- payload original em JSON, para reprocessar
);

CREATE INDEX IF NOT EXISTS ix_imoveis_imob     ON imoveis(imobiliaria_id);
CREATE INDEX IF NOT EXISTS ix_imoveis_preco    ON imoveis(preco);
CREATE INDEX IF NOT EXISTS ix_imoveis_cidade   ON imoveis(cidade_busca, bairro_busca);
CREATE INDEX IF NOT EXISTS ix_imoveis_busca    ON imoveis(status, finalidade, tipo);
-- Nao e unico de proposito: ha site que repete o mesmo codigo em anuncios
-- diferentes (venda e locacao do mesmo imovel, cadastro duplicado). Quem
-- identifica o anuncio e a URL canonica.
CREATE INDEX IF NOT EXISTS ix_imoveis_codigo
    ON imoveis(imobiliaria_id, codigo);

CREATE TABLE IF NOT EXISTS fotos (
    imovel_id INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    ordem     INTEGER NOT NULL,
    url       TEXT NOT NULL,
    PRIMARY KEY (imovel_id, ordem)
);

CREATE TABLE IF NOT EXISTS caracteristicas (
    imovel_id INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    nome      TEXT NOT NULL,
    PRIMARY KEY (imovel_id, nome)
);

-- Serie historica: so recebe linha quando algum valor muda.
CREATE TABLE IF NOT EXISTS historico_preco (
    id            INTEGER PRIMARY KEY,
    imovel_id     INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    data          TEXT NOT NULL,
    preco         REAL,
    preco_aluguel REAL
);
CREATE INDEX IF NOT EXISTS ix_hist_imovel ON historico_preco(imovel_id, data);

CREATE TABLE IF NOT EXISTS coletas (
    id             INTEGER PRIMARY KEY,
    imobiliaria_id INTEGER REFERENCES imobiliarias(id) ON DELETE CASCADE,
    inicio         TEXT NOT NULL,
    fim            TEXT,
    ok             INTEGER,
    encontrados    INTEGER DEFAULT 0,
    novos          INTEGER DEFAULT 0,
    atualizados    INTEGER DEFAULT 0,
    removidos      INTEGER DEFAULT 0,
    erro           TEXT
);

-- ----------------------------------------------------------------------
-- Backoffice (web/): usuarios, sessoes, leads e auditoria. O site cria e
-- migra estas tabelas sozinho; ficam aqui tambem para um banco novo ja
-- nascer completo.

CREATE TABLE IF NOT EXISTS usuarios (
    id             INTEGER PRIMARY KEY,
    imobiliaria_id INTEGER REFERENCES imobiliarias(id) ON DELETE CASCADE,  -- nulo = admin geral
    nome           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    senha_hash     TEXT NOT NULL,
    papel          TEXT NOT NULL DEFAULT 'imobiliaria',   -- admin | imobiliaria
    ativo          INTEGER NOT NULL DEFAULT 1,
    criado_em      TEXT NOT NULL,
    ultimo_acesso  TEXT
);

CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em  TEXT NOT NULL,
    expira_em  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
    id             INTEGER PRIMARY KEY,
    imobiliaria_id INTEGER NOT NULL REFERENCES imobiliarias(id) ON DELETE CASCADE,
    imovel_id      INTEGER REFERENCES imoveis(id) ON DELETE SET NULL,
    nome           TEXT NOT NULL,
    telefone       TEXT,
    email          TEXT,
    mensagem       TEXT,
    origem         TEXT NOT NULL DEFAULT 'site',
    status         TEXT NOT NULL DEFAULT 'novo',  -- novo | em_contato | fechado | descartado
    obs            TEXT,
    criado_em      TEXT NOT NULL,
    atualizado_em  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_leads_imob ON leads(imobiliaria_id, status, criado_em);

CREATE TABLE IF NOT EXISTS auditoria (
    id             INTEGER PRIMARY KEY,
    usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    imobiliaria_id INTEGER REFERENCES imobiliarias(id) ON DELETE CASCADE,
    imovel_id      INTEGER REFERENCES imoveis(id) ON DELETE SET NULL,
    acao           TEXT NOT NULL,
    detalhes       TEXT,          -- JSON com o que mudou
    criado_em      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_auditoria_imob ON auditoria(imobiliaria_id, criado_em);

-- Visao pronta pra garimpar oportunidade.
CREATE VIEW IF NOT EXISTS v_imoveis AS
SELECT i.id, m.nome AS imobiliaria, i.tipo, i.finalidade,
       i.preco, i.preco_aluguel, i.condominio,
       i.quartos, i.suites, i.vagas, i.area_util, i.area_total,
       CASE WHEN i.preco > 0 AND COALESCE(i.area_util, i.area_total) > 0
            THEN ROUND(i.preco / COALESCE(i.area_util, i.area_total), 2) END AS preco_m2,
       i.bairro, i.cidade, i.cidade_busca, i.bairro_busca, i.uf,
       i.titulo, i.url, i.status, i.criado_em, i.visto_em
FROM imoveis i JOIN imobiliarias m ON m.id = i.imobiliaria_id;
"""

CAMPOS = [
    "codigo", "finalidade", "tipo", "titulo", "descricao",
    "preco", "preco_aluguel", "condominio", "iptu",
    "area_total", "area_util", "quartos", "suites", "banheiros", "vagas",
    "endereco", "bairro", "cidade", "cidade_busca", "bairro_busca", "uf", "cep",
    "latitude", "longitude",
    "foto_capa",
]


# O SQLite aceita um escritor por vez. Com varios scrapers em paralelo, o
# que trava o banco nao e o volume de escrita (que e minusculo) e sim manter
# a transacao aberta durante o download da proxima pagina. Este cadeado
# mantem cada escrita curta e sem disputa.
ESCRITA = threading.Lock()


def agora() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def conecta(caminho: str = CAMINHO_PADRAO, criar_esquema: bool = True) -> sqlite3.Connection:
    """Abre (e por padrao cria) o banco.

    Com varios scrapers em paralelo, cada thread precisa da sua conexao. O
    esquema e criado uma vez so, por `prepara`: rodar o executescript em
    varias threads ao mesmo tempo trava o banco. O busy_timeout segura as
    escritas concorrentes sem precisar serializar a coleta.
    """
    os.makedirs(os.path.dirname(caminho) or ".", exist_ok=True)
    con = sqlite3.connect(caminho, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout = 30000")
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA foreign_keys = ON")
    if criar_esquema:
        con.executescript(ESQUEMA)
        migra(con)
    return con


# Colunas acrescentadas depois do esquema original. `migra` cria as que faltam,
# entao o mesmo codigo serve para banco novo e para banco antigo.
COLUNAS_NOVAS = {
    "imoveis": [
        ("origem", "TEXT NOT NULL DEFAULT 'scraper'"),   # scraper | manual
        ("travado", "INTEGER NOT NULL DEFAULT 0"),       # 1 = a coleta nao sobrescreve
        ("destaque", "INTEGER NOT NULL DEFAULT 0"),
        ("obs_interna", "TEXT"),
    ],
    "imobiliarias": [
        ("telefone", "TEXT"),
        ("whatsapp", "TEXT"),
        ("email", "TEXT"),
        ("endereco", "TEXT"),
        ("creci", "TEXT"),
        ("sobre", "TEXT"),
        ("logo", "TEXT"),
    ],
}


def migra(con: sqlite3.Connection) -> None:
    for tabela, colunas in COLUNAS_NOVAS.items():
        existentes = {r[1] for r in con.execute(f"PRAGMA table_info({tabela})")}
        for nome, tipo in colunas:
            if nome not in existentes:
                con.execute(f"ALTER TABLE {tabela} ADD COLUMN {nome} {tipo}")
    con.commit()


def prepara(caminho: str = CAMINHO_PADRAO) -> None:
    """Garante o esquema antes de abrir as conexoes das threads."""
    conecta(caminho).close()


def registra_imobiliaria(con, slug, nome, site, plataforma=None, status="ativa", obs=None) -> int:
    con.execute(
        """INSERT INTO imobiliarias (slug, nome, site, plataforma, status, obs)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(slug) DO UPDATE SET
             nome=excluded.nome, site=excluded.site,
             plataforma=excluded.plataforma, status=excluded.status, obs=excluded.obs""",
        (slug, nome, site, plataforma, status, obs),
    )
    return con.execute("SELECT id FROM imobiliarias WHERE slug=?", (slug,)).fetchone()[0]


def _saneia(dados: dict) -> dict:
    """Ultima peneira antes de gravar, valendo pra qualquer adaptador."""
    from . import normalize as nz

    d = dict(dados)
    d["cidade_busca"] = nz.slug(d.get("cidade") or "") or None
    d["bairro_busca"] = nz.slug(d.get("bairro") or "") or None
    d["preco"] = nz.preco_plausivel(d.get("preco"), "venda")
    d["preco_aluguel"] = nz.preco_plausivel(d.get("preco_aluguel"), "aluguel")
    for campo in ("condominio", "iptu"):
        if d.get(campo) is not None and d[campo] <= 0:
            d[campo] = None
    # Zero nesses campos quer dizer "nao se aplica" (terreno sem quarto),
    # nao "tem zero"; nulo deixa isso explicito nas consultas.
    for campo in ("quartos", "suites", "banheiros", "vagas", "area_total", "area_util"):
        if d.get(campo) is not None and d[campo] <= 0:
            d[campo] = None
    # Anuncio sem nenhum valor de venda deixa de se dizer "venda_aluguel".
    if d.get("finalidade") == "venda_aluguel" and not d.get("preco"):
        d["finalidade"] = "aluguel" if d.get("preco_aluguel") else "venda_aluguel"
    return d


def _hash(d: dict) -> str:
    # As colunas *_busca derivam das outras: entram fora do hash pra nao
    # marcar o anuncio como alterado sem que nada tenha mudado.
    relevante = {k: d.get(k) for k in CAMPOS if not k.endswith("_busca")}
    return hashlib.sha256(
        json.dumps(relevante, sort_keys=True, default=str).encode()
    ).hexdigest()[:16]


def salva_imovel(con, imobiliaria_id: int, dados: dict) -> str:
    """Insere ou atualiza um imovel. Devolve 'novo' | 'atualizado' | 'igual'."""
    url = dados.get("url")
    if not url:
        raise ValueError("imovel sem url")

    ts = agora()
    dados = _saneia(dados)
    h = _hash(dados)
    valores = {k: dados.get(k) for k in CAMPOS}

    linha = con.execute(
        "SELECT id, hash_conteudo, preco, preco_aluguel, travado FROM imoveis WHERE url=?", (url,)
    ).fetchone()

    if linha is None:
        cols = ["imobiliaria_id", "url", *CAMPOS,
                "status", "visto_em", "criado_em", "atualizado_em", "hash_conteudo", "bruto"]
        vals = [imobiliaria_id, url, *[valores[k] for k in CAMPOS],
                "disponivel", ts, ts, ts, h,
                json.dumps(dados.get("bruto"), ensure_ascii=False, default=str)
                if dados.get("bruto") is not None else None]
        cur = con.execute(
            f"INSERT INTO imoveis ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", vals
        )
        imovel_id = cur.lastrowid
        _grava_historico(con, imovel_id, ts, valores["preco"], valores["preco_aluguel"])
        _grava_filhos(con, imovel_id, dados)
        return "novo"

    imovel_id = linha["id"]
    # Editado no backoffice: a coleta so registra que o anuncio continua no ar.
    if linha["travado"]:
        con.execute("UPDATE imoveis SET visto_em=? WHERE id=?", (ts, imovel_id))
        return "igual"
    if linha["hash_conteudo"] == h:
        con.execute(
            "UPDATE imoveis SET visto_em=?, status='disponivel' WHERE id=?", (ts, imovel_id)
        )
        return "igual"

    sets = ", ".join(f"{k}=?" for k in CAMPOS)
    con.execute(
        f"""UPDATE imoveis SET {sets}, status='disponivel', visto_em=?, atualizado_em=?,
            hash_conteudo=?, bruto=COALESCE(?, bruto) WHERE id=?""",
        [*[valores[k] for k in CAMPOS], ts, ts, h,
         json.dumps(dados.get("bruto"), ensure_ascii=False, default=str)
         if dados.get("bruto") is not None else None,
         imovel_id],
    )
    if (linha["preco"], linha["preco_aluguel"]) != (valores["preco"], valores["preco_aluguel"]):
        _grava_historico(con, imovel_id, ts, valores["preco"], valores["preco_aluguel"])
    _grava_filhos(con, imovel_id, dados)
    return "atualizado"


def _grava_historico(con, imovel_id, ts, preco, aluguel):
    if preco is None and aluguel is None:
        return
    con.execute(
        "INSERT INTO historico_preco (imovel_id, data, preco, preco_aluguel) VALUES (?,?,?,?)",
        (imovel_id, ts, preco, aluguel),
    )


def _grava_filhos(con, imovel_id, dados):
    fotos = [f for f in (dados.get("fotos") or []) if f][:40]
    if fotos:
        con.execute("DELETE FROM fotos WHERE imovel_id=?", (imovel_id,))
        con.executemany(
            "INSERT OR IGNORE INTO fotos (imovel_id, ordem, url) VALUES (?,?,?)",
            [(imovel_id, i, u) for i, u in enumerate(fotos)],
        )
    cars = sorted({c.strip() for c in (dados.get("caracteristicas") or []) if c and c.strip()})
    if cars:
        con.execute("DELETE FROM caracteristicas WHERE imovel_id=?", (imovel_id,))
        con.executemany(
            "INSERT OR IGNORE INTO caracteristicas (imovel_id, nome) VALUES (?,?)",
            [(imovel_id, c) for c in cars],
        )


def marca_removidos(con, imobiliaria_id: int, inicio_coleta: str) -> int:
    """Anuncios que nao apareceram nesta coleta viram 'removido' (vendido/alugado)."""
    cur = con.execute(
        """UPDATE imoveis SET status='removido', atualizado_em=?
           WHERE imobiliaria_id=? AND status='disponivel' AND origem='scraper'
             AND travado=0 AND visto_em < ?""",
        (agora(), imobiliaria_id, inicio_coleta),
    )
    return cur.rowcount


def abre_coleta(con, imobiliaria_id: int) -> tuple[int, str]:
    ts = agora()
    cur = con.execute(
        "INSERT INTO coletas (imobiliaria_id, inicio) VALUES (?,?)", (imobiliaria_id, ts)
    )
    return cur.lastrowid, ts


def fecha_coleta(con, coleta_id, ok, encontrados=0, novos=0, atualizados=0, removidos=0, erro=None):
    con.execute(
        """UPDATE coletas SET fim=?, ok=?, encontrados=?, novos=?, atualizados=?,
           removidos=?, erro=? WHERE id=?""",
        (agora(), 1 if ok else 0, encontrados, novos, atualizados, removidos,
         (erro or None), coleta_id),
    )
