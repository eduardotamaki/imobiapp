#!/usr/bin/env python3
"""Catalogo de imoveis das imobiliarias de Itajuba/MG.

    ./run.py coletar                    # roda todos os scrapers
    ./run.py coletar --só galhardo,dfc  # roda so alguns
    ./run.py listar                     # mostra os scrapers registrados
    ./run.py buscar --max-preco 500000 --quartos 3 --cidade Itajuba
    ./run.py resumo                     # panorama do banco
    ./run.py novidades --dias 7         # o que entrou ou mudou de preco
"""
from __future__ import annotations

import argparse
import pathlib
import concurrent.futures as futuros
import sqlite3
import sys
import time

from imobiapp import db, registry
from imobiapp.http import Sessao
from imobiapp.normalize import slug


# ------------------------------------------------------------- coletar

def cmd_coletar(args):
    classes = registry.seleciona(args.so.split(",") if args.so else None, args.incluir_inativos)
    if not classes:
        print("nada a coletar")
        return 0

    print(f"coletando {len(classes)} site(s)...\n")
    db.prepara(args.banco)     # esquema criado uma vez, fora das threads
    inicio = time.monotonic()

    def roda(cls):
        # Cada thread precisa da sua conexao: sqlite nao compartilha entre elas.
        con = db.conecta(args.banco, criar_esquema=False)
        try:
            sessao = Sessao(usar_cache=not args.sem_cache, ttl_horas=args.ttl,
                            intervalo=args.intervalo, verbose=args.verbose)
            return cls(sessao, limite=args.limite).executar(con)
        except Exception as e:
            return {"slug": cls.slug, "ok": False, "erro": f"{type(e).__name__}: {e}",
                    "encontrados": 0, "novos": 0, "atualizados": 0, "removidos": 0}
        finally:
            con.close()

    resultados = []
    with futuros.ThreadPoolExecutor(max_workers=args.paralelo) as pool:
        for r in pool.map(roda, classes):
            resultados.append(r)
            marca = "ok " if r["ok"] else "ERRO"
            print(f"  {marca} {r['slug']:<18} {r['encontrados']:>4} imóveis "
                  f"(+{r['novos']} novos, ~{r['atualizados']} atualizados, "
                  f"-{r['removidos']} saíram)" + (f"  {r['erro']}" if r.get("erro") else ""))

    total = sum(r["encontrados"] for r in resultados)
    falhas = [r for r in resultados if not r["ok"]]
    print(f"\n{total} imóveis em {time.monotonic() - inicio:.0f}s"
          f"{f'; {len(falhas)} site(s) com erro' if falhas else ''}")
    print(f"banco: {args.banco}")
    return 1 if falhas else 0


# -------------------------------------------------------------- listar

def cmd_listar(args):
    for c in registry.todos():
        obs = f"  # {(c.__doc__ or '').strip().splitlines()[0]}" if c.status != "ativa" else ""
        print(f"{c.slug:<18} {c.status:<12} {c.plataforma or '-':<16} {c.site}{obs}")
    return 0


# -------------------------------------------------------------- buscar

def cmd_buscar(args):
    con = db.conecta(args.banco)
    onde, params = ["status = 'disponivel'"], []
    if not args.incluir_aluguel:
        onde.append("finalidade IN ('venda', 'venda_aluguel')")
    if args.max_preco:
        onde.append("preco IS NOT NULL AND preco <= ?"); params.append(args.max_preco)
    if args.min_preco:
        onde.append("preco >= ?"); params.append(args.min_preco)
    if args.quartos:
        onde.append("quartos >= ?"); params.append(args.quartos)
    if args.vagas:
        onde.append("vagas >= ?"); params.append(args.vagas)
    if args.area:
        onde.append("COALESCE(area_util, area_total) >= ?"); params.append(args.area)
    if args.tipo:
        onde.append("tipo = ?"); params.append(args.tipo)
    # Compara pelas colunas sem acento: quem busca digita "Itajuba".
    if args.cidade:
        onde.append("cidade_busca LIKE ?"); params.append(f"%{slug(args.cidade)}%")
    if args.bairro:
        onde.append("bairro_busca LIKE ?"); params.append(f"%{slug(args.bairro)}%")

    # Sem isso o SQLite joga os nulos na frente e a primeira página fica
    # cheia de imóvel sem o dado pelo qual se pediu a ordenação.
    campo_ordem = args.ordem.split()[0]
    sql = f"""SELECT * FROM v_imoveis WHERE {' AND '.join(onde)}
              ORDER BY ({campo_ordem} IS NULL), {args.ordem} LIMIT ?"""
    params.append(args.limite)
    linhas = con.execute(sql, params).fetchall()
    _tabela(linhas)
    print(f"\n{len(linhas)} resultado(s)")
    return 0


# -------------------------------------------------------------- resumo

def cmd_resumo(args):
    con = db.conecta(args.banco)
    print("por imobiliária")
    for r in con.execute("""
        SELECT m.nome, m.status, COUNT(i.id) n,
               SUM(i.status='disponivel') disp,
               CAST(AVG(NULLIF(i.preco,0)) AS INT) media, m.ultima_coleta
        FROM imobiliarias m LEFT JOIN imoveis i ON i.imobiliaria_id = m.id
        GROUP BY m.id ORDER BY n DESC"""):
        media = f"R$ {r['media']:,}".replace(",", ".") if r["media"] else "-"
        print(f"  {r['nome'][:34]:<34} {r['n']:>5} ({r['disp'] or 0} ativos)  "
              f"média {media:>14}  {(r['ultima_coleta'] or '')[:16]}")

    print("\npor tipo (à venda, disponíveis)")
    for r in con.execute("""
        SELECT COALESCE(tipo,'?') t, COUNT(*) n,
               CAST(MIN(NULLIF(preco,0)) AS INT) mini,
               CAST(AVG(NULLIF(preco,0)) AS INT) media,
               CAST(MAX(preco) AS INT) maxi
        FROM imoveis WHERE status='disponivel' AND finalidade LIKE 'venda%'
        GROUP BY t ORDER BY n DESC"""):
        print(f"  {r['t']:<18} {r['n']:>5}   min {_r(r['mini'])}  méd {_r(r['media'])}  máx {_r(r['maxi'])}")

    tot = con.execute("SELECT COUNT(*) FROM imoveis").fetchone()[0]
    disp = con.execute("SELECT COUNT(*) FROM imoveis WHERE status='disponivel'").fetchone()[0]
    print(f"\n{tot} imóveis catalogados, {disp} disponíveis")
    return 0


# ----------------------------------------------------------- novidades

def cmd_novidades(args):
    con = db.conecta(args.banco)
    corte = f"-{args.dias} days"

    print(f"novos nos últimos {args.dias} dia(s)")
    _tabela(con.execute(
        "SELECT * FROM v_imoveis WHERE criado_em >= date('now', ?) ORDER BY preco LIMIT 40",
        (corte,)).fetchall())

    saidos = con.execute(
        """SELECT titulo, bairro, preco, url FROM v_imoveis
           WHERE status = 'removido' AND visto_em >= date('now', ?)
           ORDER BY preco DESC LIMIT 20""", (corte,)).fetchall()
    if saidos:
        print(f"\nsaíram do ar (vendidos/alugados) nos últimos {args.dias} dia(s)")
        for r in saidos:
            print(f"  {_r(r['preco'])}  {(r['bairro'] or '')[:18]:<18} {(r['titulo'] or '')[:40]}")

    print(f"\nmudanças de preço nos últimos {args.dias} dia(s)")
    for r in con.execute("""
        SELECT i.titulo, m.nome imobiliaria, i.bairro, i.url,
               h1.preco de, h2.preco para, h2.data
        FROM historico_preco h2
        JOIN historico_preco h1 ON h1.imovel_id = h2.imovel_id AND h1.id < h2.id
        JOIN imoveis i ON i.id = h2.imovel_id
        JOIN imobiliarias m ON m.id = i.imobiliaria_id
        WHERE h2.data >= date('now', ?) AND h1.preco IS NOT NULL AND h2.preco IS NOT NULL
          AND h1.preco <> h2.preco
          AND h1.id = (SELECT MAX(id) FROM historico_preco WHERE imovel_id=h2.imovel_id AND id < h2.id)
        ORDER BY (h2.preco - h1.preco) LIMIT 40""", (corte,)):
        delta = (r["para"] - r["de"]) / r["de"] * 100
        seta = "▼" if delta < 0 else "▲"
        print(f"  {seta} {delta:+6.1f}%  {_r(r['de'])} → {_r(r['para'])}  "
              f"{(r['bairro'] or '')[:16]:<16} {(r['titulo'] or '')[:40]}")
        print(f"       {r['url']}")
    return 0


# --------------------------------------------------------------- util

def _r(v):
    if not v:
        return "         -"
    return f"R$ {int(v):,}".replace(",", ".").rjust(14)


def _tabela(linhas: list[sqlite3.Row]):
    if not linhas:
        print("  (nada)")
        return
    for r in linhas:
        m2 = f"{r['preco_m2']:,.0f}/m²".replace(",", ".") if r["preco_m2"] else ""
        print(f"  {_r(r['preco'])}  {(r['tipo'] or '?')[:12]:<12} "
              f"{(r['quartos'] or '-')!s:>2}q {(r['vagas'] or '-')!s:>2}v "
              f"{(r['area_util'] or r['area_total'] or 0):>7.0f}m²  {m2:>12}  "
              f"{(r['bairro'] or '')[:18]:<18} {(r['cidade'] or '')[:12]:<12} "
              f"{(r['imobiliaria'] or '')[:20]}")
        print(f"  {'':>14}  {r['url']}")


def cmd_exportar(args):
    """Copia o banco num arquivo único e limpo (sem WAL) para o site publicar."""
    destino = pathlib.Path(args.destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = db.conecta(args.banco, criar_esquema=False)
    con.execute("VACUUM INTO ?", (str(tmp),))
    con.close()
    tmp.replace(destino)
    con = sqlite3.connect(destino)
    n = con.execute("SELECT count(*) FROM imoveis").fetchone()[0]
    con.close()
    print(f"{destino}: {n} imóveis, {destino.stat().st_size / 1e6:.1f} MB")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--banco", default=db.CAMINHO_PADRAO)
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("coletar", help="roda os scrapers e grava no banco")
    c.add_argument("--só", "--so", dest="so", help="slugs separados por vírgula")
    c.add_argument("--limite", type=int, help="máximo de imóveis por site (teste)")
    c.add_argument("--paralelo", type=int, default=4, help="sites em paralelo (padrão 4)")
    c.add_argument("--intervalo", type=float, default=1.0,
                   help="segundos entre requisições ao mesmo domínio (padrão 1.0)")
    c.add_argument("--ttl", type=int, default=24, help="validade do cache em horas")
    c.add_argument("--sem-cache", action="store_true")
    c.add_argument("--incluir-inativos", action="store_true")
    c.add_argument("-v", "--verbose", action="store_true")
    c.set_defaults(func=cmd_coletar)

    c = sub.add_parser("listar", help="mostra os scrapers registrados")
    c.set_defaults(func=cmd_listar)

    c = sub.add_parser("buscar", help="consulta o catálogo")
    c.add_argument("--max-preco", type=float)
    c.add_argument("--min-preco", type=float)
    c.add_argument("--quartos", type=int, help="mínimo de quartos")
    c.add_argument("--vagas", type=int, help="mínimo de vagas")
    c.add_argument("--area", type=float, help="área mínima em m²")
    c.add_argument("--tipo", help="casa, apartamento, terreno, chacara, comercial...")
    c.add_argument("--cidade")
    c.add_argument("--bairro")
    c.add_argument("--incluir-aluguel", action="store_true")
    c.add_argument("--ordem", default="preco",
                   choices=["preco", "preco DESC", "preco_m2", "area_util DESC", "visto_em DESC"])
    c.add_argument("--limite", type=int, default=30)
    c.set_defaults(func=cmd_buscar)

    c = sub.add_parser("resumo", help="panorama do banco")
    c.set_defaults(func=cmd_resumo)

    c = sub.add_parser("novidades", help="o que entrou ou mudou de preço")
    c.add_argument("--dias", type=int, default=7)
    c.set_defaults(func=cmd_novidades)

    c = sub.add_parser("exportar", help="gera web/data/imoveis.db para publicar o site")
    c.add_argument("--destino", default="web/data/imoveis.db")
    c.set_defaults(func=cmd_exportar)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
