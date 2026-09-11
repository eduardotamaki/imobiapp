/** Consultas do site: busca com facetas, detalhe, mapa, panorama e CSV. */
import type Database from "better-sqlite3";
import { conexao, vocabulario } from "./db";
import { consultaFts, norm } from "./normalize";
import { rotuloTipo } from "./format";
import type {
  Contexto,
  Estatisticas,
  FacetaItem,
  Facetas,
  Filtros,
  Finalidade,
  Histograma,
  Imovel,
  ImovelDetalhe,
  Ponto,
  Resultado,
  Resumo,
  Sugestao,
  Vista,
} from "./types";

export const POR_PAGINA = 24;
const MAX_POR_PAGINA = 96;
const MAX_MAPA = 3000;
const MAX_CSV = 5000;

type Params = Record<string, string | string[] | undefined>;

// ------------------------------------------------------------ filtros da URL

function lista(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v.join(",") : v ?? "";
  return [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))];
}

function numero(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return null;
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return isFinite(n) && n > 0 ? n : null;
}

function inteiro(v: string | string[] | undefined): number | null {
  const n = numero(v);
  return n == null ? null : Math.floor(n);
}

function bbox(v: string | string[] | undefined): Filtros["bbox"] {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return null;
  const n = s.split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !isFinite(x))) return null;
  const [sul, oeste, norte, leste] = n;
  return sul < norte && oeste < leste ? [sul, oeste, norte, leste] : null;
}

function bool(v: string | string[] | undefined): boolean {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "1" || s === "true" || s === "sim";
}

export function parseFiltros(sp: Params): Filtros {
  const fin = (Array.isArray(sp.fin) ? sp.fin[0] : sp.fin) as Finalidade | undefined;
  const vista = (Array.isArray(sp.vista) ? sp.vista[0] : sp.vista) as Vista | undefined;
  const ordem = (Array.isArray(sp.ordem) ? sp.ordem[0] : sp.ordem) ?? "relevancia";
  return {
    q: ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 200),
    fin: fin === "aluguel" || fin === "todos" ? fin : "venda",
    tipo: lista(sp.tipo),
    cidade: lista(sp.cidade).map((c) => norm(c) ?? c),
    bairro: lista(sp.bairro).map((b) => norm(b) ?? b),
    pmin: numero(sp.pmin),
    pmax: numero(sp.pmax),
    quartos: inteiro(sp.quartos),
    suites: inteiro(sp.suites),
    banheiros: inteiro(sp.banheiros),
    vagas: inteiro(sp.vagas),
    amin: numero(sp.amin),
    amax: numero(sp.amax),
    imob: lista(sp.imob),
    foto: bool(sp.foto),
    comPreco: bool(sp.preco),
    baixou: bool(sp.baixou),
    novos: bool(sp.novos),
    removidos: bool(sp.removidos),
    oportunidade: bool(sp.oportunidade),
    bbox: bbox(sp.bbox),
    ordem,
    pagina: Math.max(1, inteiro(sp.pagina) ?? 1),
    porPagina: Math.min(MAX_POR_PAGINA, inteiro(sp.pp) ?? POR_PAGINA),
    vista: vista === "lista" || vista === "mapa" ? vista : "grade",
  };
}

/** Volta os filtros para a query string (só o que difere do padrão). */
export function filtrosParaQuery(f: Partial<Filtros>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.fin && f.fin !== "venda") p.set("fin", f.fin);
  if (f.tipo?.length) p.set("tipo", f.tipo.join(","));
  if (f.cidade?.length) p.set("cidade", f.cidade.join(","));
  if (f.bairro?.length) p.set("bairro", f.bairro.join(","));
  if (f.pmin) p.set("pmin", String(f.pmin));
  if (f.pmax) p.set("pmax", String(f.pmax));
  if (f.quartos) p.set("quartos", String(f.quartos));
  if (f.suites) p.set("suites", String(f.suites));
  if (f.banheiros) p.set("banheiros", String(f.banheiros));
  if (f.vagas) p.set("vagas", String(f.vagas));
  if (f.amin) p.set("amin", String(f.amin));
  if (f.amax) p.set("amax", String(f.amax));
  if (f.imob?.length) p.set("imob", f.imob.join(","));
  if (f.foto) p.set("foto", "1");
  if (f.comPreco) p.set("preco", "1");
  if (f.baixou) p.set("baixou", "1");
  if (f.novos) p.set("novos", "1");
  if (f.removidos) p.set("removidos", "1");
  if (f.oportunidade) p.set("oportunidade", "1");
  if (f.bbox) p.set("bbox", f.bbox.map((x) => x.toFixed(5)).join(","));
  if (f.ordem && f.ordem !== "relevancia") p.set("ordem", f.ordem);
  if (f.pagina && f.pagina > 1) p.set("pagina", String(f.pagina));
  if (f.vista && f.vista !== "grade") p.set("vista", f.vista);
  return p;
}

// --------------------------------------------------------------- SQL comum

const COLS = `
  i.id, i.codigo, i.tipo, x.fin AS finalidade, i.titulo, i.preco, i.preco_aluguel,
  i.condominio, i.iptu, x.area, i.area_util, i.area_total, x.preco_m2, x.aluguel_m2,
  i.quartos, i.suites, i.banheiros, i.vagas, x.bairro_d AS bairro, x.cidade_d AS cidade, i.uf,
  x.capa, x.n_fotos, m.nome AS imobiliaria, m.slug AS imobiliaria_slug, m.site AS imobiliaria_site,
  i.url, i.status, x.novo, x.variacao, x.preco_anterior, x.lat, x.lng, i.criado_em, i.visto_em,
  x.fotos_json, x.desconto, x.ref_escopo, x.ref_n, x.ref_m2`;

/** Converte a linha crua do SQLite no objeto que a interface usa. */
function hidrata<T extends { fotos_json?: string | null }>(linha: T): Omit<T, "fotos_json"> & { fotos: string[] } {
  const { fotos_json, ...resto } = linha;
  let fotos: string[] = [];
  try {
    fotos = fotos_json ? (JSON.parse(fotos_json) as string[]) : [];
  } catch {
    fotos = [];
  }
  return { ...resto, fotos };
}

const FROM = `FROM imoveis i
  JOIN imobiliarias m ON m.id = i.imobiliaria_id
  JOIN mem.idx x ON x.id = i.id`;

type Dim = "tipo" | "cidade" | "bairro" | "imob" | "preco";

interface Montagem {
  from: string;
  where: string;
  params: unknown[];
  temTexto: boolean;
}

function exprPreco(fin: Finalidade): string {
  if (fin === "aluguel") return "i.preco_aluguel";
  if (fin === "venda") return "i.preco";
  return "COALESCE(i.preco, i.preco_aluguel)";
}

function exprM2(fin: Finalidade): string {
  if (fin === "aluguel") return "x.aluguel_m2";
  if (fin === "venda") return "x.preco_m2";
  return "COALESCE(x.preco_m2, x.aluguel_m2)";
}

function marcadores(n: number): string {
  return Array(n).fill("?").join(",");
}

function montar(f: Filtros, excluir?: Dim): Montagem {
  const onde: string[] = [];
  const params: unknown[] = [];
  const joins: string[] = [];
  const joinParams: unknown[] = [];

  const fts = consultaFts(f.q);
  if (fts) {
    joins.push("JOIN (SELECT rowid AS fid, bm25(fts) AS rank FROM mem.fts WHERE fts MATCH ?) ft ON ft.fid = i.id");
    joinParams.push(fts);
  }

  if (!f.removidos) onde.push("i.status = 'disponivel'");
  if (f.fin === "venda") onde.push("x.fin IN ('venda','venda_aluguel')");
  else if (f.fin === "aluguel") onde.push("x.fin IN ('aluguel','venda_aluguel')");

  if (excluir !== "tipo" && f.tipo.length) {
    onde.push(`i.tipo IN (${marcadores(f.tipo.length)})`);
    params.push(...f.tipo);
  }
  if (excluir !== "cidade" && f.cidade.length) {
    onde.push(`x.cidade_n IN (${marcadores(f.cidade.length)})`);
    params.push(...f.cidade);
  }
  if (excluir !== "bairro" && f.bairro.length) {
    onde.push(`x.bairro_n IN (${marcadores(f.bairro.length)})`);
    params.push(...f.bairro);
  }
  if (excluir !== "imob" && f.imob.length) {
    onde.push(`m.slug IN (${marcadores(f.imob.length)})`);
    params.push(...f.imob);
  }

  const p = exprPreco(f.fin);
  if (excluir !== "preco" && f.pmin != null) {
    onde.push(`${p} >= ?`);
    params.push(f.pmin);
  }
  if (excluir !== "preco" && f.pmax != null) {
    onde.push(`${p} <= ?`);
    params.push(f.pmax);
  }
  if (f.quartos != null) {
    onde.push("i.quartos >= ?");
    params.push(f.quartos);
  }
  if (f.suites != null) {
    onde.push("i.suites >= ?");
    params.push(f.suites);
  }
  if (f.banheiros != null) {
    onde.push("i.banheiros >= ?");
    params.push(f.banheiros);
  }
  if (f.vagas != null) {
    onde.push("i.vagas >= ?");
    params.push(f.vagas);
  }
  if (f.amin != null) {
    onde.push("x.area >= ?");
    params.push(f.amin);
  }
  if (f.amax != null) {
    onde.push("x.area <= ?");
    params.push(f.amax);
  }
  if (f.foto) onde.push("x.capa IS NOT NULL");
  if (f.comPreco) onde.push(`${p} IS NOT NULL`);
  if (f.baixou) onde.push("x.variacao < 0");
  if (f.novos) onde.push("x.novo = 1");
  if (f.oportunidade) onde.push("x.desconto >= 0.05");
  if (f.bbox) {
    onde.push("x.lat BETWEEN ? AND ? AND x.lng BETWEEN ? AND ?");
    params.push(f.bbox[0], f.bbox[2], f.bbox[1], f.bbox[3]);
  }

  return {
    from: `${FROM} ${joins.join(" ")}`,
    where: onde.length ? `WHERE ${onde.join(" AND ")}` : "",
    params: [...joinParams, ...params],
    temTexto: !!fts,
  };
}

function ordenacao(f: Filtros, temTexto: boolean): string {
  const p = exprPreco(f.fin);
  const m2 = exprM2(f.fin);
  switch (f.ordem) {
    case "preco_asc":
      return `${p} IS NULL, ${p} ASC, i.id`;
    case "preco_desc":
      return `${p} IS NULL, ${p} DESC, i.id`;
    case "m2_asc":
      return `${m2} IS NULL, ${m2} ASC, i.id`;
    case "m2_desc":
      return `${m2} IS NULL, ${m2} DESC, i.id`;
    case "area_desc":
      return "x.area IS NULL, x.area DESC, i.id";
    case "quartos_desc":
      return "i.quartos IS NULL, i.quartos DESC, i.suites DESC, i.id";
    case "baixou":
      return "x.variacao IS NULL, x.variacao ASC, i.id";
    case "oportunidade":
      return "x.desconto IS NULL, x.desconto DESC, i.id";
    case "recentes":
      return "i.criado_em DESC, i.id DESC";
    default:
      // Sem texto: primeiro quem tem foto e preço, depois novidades e quedas;
      // o desempate embaralha de forma estável para não agrupar por imobiliária
      // (os ids são sequenciais por scraper).
      return temTexto
        ? `ft.rank, x.capa IS NULL, ${p} IS NULL, i.id`
        : `x.destaque DESC, x.capa IS NULL, ${p} IS NULL, x.novo DESC, (x.variacao < 0) DESC, date(i.criado_em) DESC, (i.id * 2654435761) % 1000003`;
  }
}

// ------------------------------------------------------------------- busca

function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

const MANTISSAS = [1, 1.5, 2, 3, 5, 7];

/** Limites "redondos" em escala log cobrindo [min, max]: 100 mil, 150 mil, 200 mil, 300 mil… */
export function limitesBonitos(min: number, max: number): number[] {
  const out: number[] = [];
  let exp = Math.floor(Math.log10(Math.max(min, 1)));
  let ultimoAbaixo = 0;
  for (; exp < 12; exp++) {
    for (const m of MANTISSAS) {
      const v = m * 10 ** exp;
      if (v <= min) {
        ultimoAbaixo = v;
        continue;
      }
      if (!out.length && ultimoAbaixo) out.push(ultimoAbaixo);
      out.push(v);
      if (v >= max) return out;
    }
  }
  return out;
}

function estatisticasEHistograma(db: Database.Database, f: Filtros): { estatisticas: Estatisticas; histograma: Histograma } {
  const p = exprPreco(f.fin);
  const m2 = exprM2(f.fin);
  // Sem os limites de preço: o histograma mostra a distribuição inteira e a faixa escolhida por cima.
  const m = montar(f, "preco");
  const linhas = db
    .prepare(`SELECT ${p} AS p, ${m2} AS m2, (${p} >= COALESCE(?, 0) AND ${p} <= COALESCE(?, 1e15)) AS dentro ${m.from} ${m.where} ${m.where ? "AND" : "WHERE"} ${p} IS NOT NULL`)
    .all(f.pmin, f.pmax, ...m.params) as { p: number; m2: number | null; dentro: number }[];
  const dentro = linhas.filter((l) => l.dentro);
  const precos = dentro.map((l) => l.p);
  const estatisticas: Estatisticas = {
    n: dentro.length,
    mediana_preco: mediana(precos),
    mediana_m2: mediana(dentro.map((l) => l.m2).filter((v): v is number => v != null)),
    minimo: precos.length ? Math.min(...precos) : null,
    maximo: precos.length ? Math.max(...precos) : null,
  };
  const todos = linhas.map((l) => l.p);
  let limites: number[] = [];
  const contagens: number[] = [];
  if (todos.length) {
    limites = limitesBonitos(Math.min(...todos), Math.max(...todos));
    for (let i = 0; i < limites.length - 1; i++) contagens.push(0);
    for (const v of todos) {
      let i = limites.findIndex((lim, k) => k > 0 && v < lim) - 1;
      if (i < 0) i = contagens.length - 1;
      if (i >= 0) contagens[i]++;
    }
  }
  return { estatisticas, histograma: { limites, contagens } };
}

function facetas(db: Database.Database, f: Filtros): Facetas {
  const conta = (dim: Dim, chave: string, nome: string, limite: number, selecionados: string[]): FacetaItem[] => {
    const m = montar(f, dim);
    const sql = `SELECT ${chave} AS chave, ${nome} AS nome, COUNT(*) AS n ${m.from} ${m.where}
                 ${m.where ? "AND" : "WHERE"} ${chave} IS NOT NULL
                 GROUP BY chave ORDER BY n DESC, nome`;
    const linhas = db.prepare(sql).all(...m.params) as FacetaItem[];
    const sel = new Set(selecionados);
    const topo = linhas.slice(0, limite);
    for (const l of linhas.slice(limite)) if (sel.has(l.chave)) topo.push(l);
    for (const s of sel) if (!topo.some((t) => t.chave === s)) topo.push({ chave: s, nome: s, n: 0 });
    return topo;
  };
  const tipo = conta("tipo", "i.tipo", "i.tipo", 20, f.tipo).map((t) => ({ ...t, nome: rotuloTipo(t.chave) }));
  return {
    tipo,
    cidade: conta("cidade", "x.cidade_n", "MAX(x.cidade_d)", 40, f.cidade),
    bairro: conta("bairro", "x.bairro_n", "MAX(x.bairro_d)", 150, f.bairro),
    imob: conta("imob", "m.slug", "MAX(m.nome)", 40, f.imob),
  };
}

export function buscar(f: Filtros): Resultado {
  const db = conexao();
  const m = montar(f);
  const total = (db.prepare(`SELECT COUNT(*) AS n ${m.from} ${m.where}`).get(...m.params) as { n: number }).n;
  const comCoordenadas = (
    db
      .prepare(`SELECT COUNT(*) AS n ${m.from} ${m.where} ${m.where ? "AND" : "WHERE"} x.lat IS NOT NULL`)
      .get(...m.params) as { n: number }
  ).n;
  const paginas = Math.max(1, Math.ceil(total / f.porPagina));
  const pagina = Math.min(f.pagina, paginas);
  const itens = (
    db
      .prepare(`SELECT ${COLS} ${m.from} ${m.where} ORDER BY ${ordenacao(f, m.temTexto)} LIMIT ? OFFSET ?`)
      .all(...m.params, f.porPagina, (pagina - 1) * f.porPagina) as (Imovel & { fotos_json: string })[]
  ).map(hidrata);
  const { estatisticas, histograma } = estatisticasEHistograma(db, f);
  return { total, estatisticas, histograma, pagina, paginas, porPagina: f.porPagina, itens, facetas: facetas(db, f), comCoordenadas };
}

export function porIds(ids: number[]): Imovel[] {
  if (!ids.length) return [];
  const db = conexao();
  const linhas = (
    db.prepare(`SELECT ${COLS} ${FROM} WHERE i.id IN (${marcadores(ids.length)})`).all(...ids) as (Imovel & { fotos_json: string })[]
  ).map(hidrata);
  const ordem = new Map(ids.map((id, i) => [id, i]));
  return linhas.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
}

export function mapa(f: Filtros): Ponto[] {
  const db = conexao();
  const m = montar(f);
  return db
    .prepare(
      `SELECT i.id, x.lat, x.lng, i.preco, i.preco_aluguel, i.tipo, i.titulo, x.bairro_d AS bairro,
              x.capa, i.quartos, x.area
       ${m.from} ${m.where} ${m.where ? "AND" : "WHERE"} x.lat IS NOT NULL
       ORDER BY ${ordenacao(f, m.temTexto)} LIMIT ?`,
    )
    .all(...m.params, MAX_MAPA) as Ponto[];
}

// ----------------------------------------------------------------- detalhe


export function detalhe(id: number): ImovelDetalhe | null {
  const db = conexao();
  const base = db
    .prepare(
      `SELECT ${COLS}, i.descricao, i.endereco, i.cep, i.atualizado_em, x.cidade_n, x.bairro_n,
              i.origem, m.whatsapp AS imobiliaria_whatsapp, m.telefone AS imobiliaria_telefone, m.email AS imobiliaria_email
       ${FROM} WHERE i.id = ?`,
    )
    .get(id) as
    | (Imovel & {
        fotos_json: string;
        descricao: string | null;
        endereco: string | null;
        cep: string | null;
        atualizado_em: string;
        cidade_n: string | null;
        bairro_n: string | null;
        origem: string;
        imobiliaria_whatsapp: string | null;
        imobiliaria_telefone: string | null;
        imobiliaria_email: string | null;
      })
    | undefined;
  if (!base) return null;

  const fotos = (db.prepare("SELECT url FROM fotos WHERE imovel_id = ? ORDER BY ordem").all(id) as { url: string }[])
    .map((r) => r.url)
    .filter((u) => !/no-?image|sem-?foto|favicon|\/logo|logo[._-]|fundosite|placeholder/i.test(u));
  if (base.capa && !fotos.includes(base.capa)) fotos.unshift(base.capa);

  const caracteristicas = (
    db.prepare("SELECT nome FROM caracteristicas WHERE imovel_id = ? ORDER BY nome").all(id) as { nome: string }[]
  ).map((r) => r.nome);

  const historico = db
    .prepare("SELECT data, preco, preco_aluguel FROM historico_preco WHERE imovel_id = ? ORDER BY id")
    .all(id) as ImovelDetalhe["historico"];

  // Referência de preço/m² para o mesmo tipo no bairro e na cidade.
  const contexto: Contexto[] = [];
  const fin = base.finalidade === "aluguel" ? "aluguel" : "venda";
  const colM2 = fin === "aluguel" ? "x.aluguel_m2" : "x.preco_m2";
  const colP = fin === "aluguel" ? "i.preco_aluguel" : "i.preco";
  const finCond = fin === "aluguel" ? "x.fin IN ('aluguel','venda_aluguel')" : "x.fin IN ('venda','venda_aluguel')";
  const escopos: [Contexto["escopo"], string, string | null, string | null][] = [
    ["bairro", "x.bairro_n = ? AND x.cidade_n IS ?", base.bairro_n, base.bairro],
    ["cidade", "x.cidade_n = ?", base.cidade_n, base.cidade],
  ];
  for (const [escopo, cond, chave, nome] of escopos) {
    if (!chave || !nome) continue;
    const params = escopo === "bairro" ? [chave, base.cidade_n] : [chave];
    const linhas = db
      .prepare(
        `SELECT ${colM2} AS m2, ${colP} AS p ${FROM}
         WHERE i.status = 'disponivel' AND ${finCond} AND i.tipo IS ? AND ${cond} AND ${colP} IS NOT NULL`,
      )
      .all(base.tipo, ...params) as { m2: number | null; p: number }[];
    if (linhas.length < 3) continue;
    contexto.push({
      escopo,
      nome,
      n: linhas.length,
      mediana_m2: mediana(linhas.map((l) => l.m2).filter((v): v is number => v != null)),
      mediana_preco: mediana(linhas.map((l) => l.p)),
    });
  }

  const ref = fin === "aluguel" ? base.preco_aluguel : base.preco;
  const similares = (db
    .prepare(
      `SELECT ${COLS} ${FROM}
       WHERE i.id <> ? AND i.status = 'disponivel' AND ${finCond} AND i.tipo IS ?
         AND x.cidade_n IS ? AND ${colP} IS NOT NULL
         ${ref ? `AND ${colP} BETWEEN ? AND ?` : ""}
       ORDER BY (x.bairro_n IS ?) DESC, (x.capa IS NULL), ${ref ? `ABS(${colP} - ?)` : colP}
       LIMIT 6`,
    )
    .all(
      id,
      base.tipo,
      base.cidade_n,
      ...(ref ? [ref * 0.65, ref * 1.35] : []),
      base.bairro_n,
      ...(ref ? [ref] : []),
    ) as (Imovel & { fotos_json: string })[]).map(hidrata);

  const { cidade_n: _c, bairro_n: _b, ...resto } = hidrata(base);
  void _c;
  void _b;
  return { ...resto, fotos, caracteristicas, historico, similares, contexto };
}

// ------------------------------------------------------------------ resumo

export function resumo(cidadeChave: string | null, fin: Finalidade): Resumo {
  const db = conexao();
  const finCond =
    fin === "aluguel" ? "x.fin IN ('aluguel','venda_aluguel')" : fin === "venda" ? "x.fin IN ('venda','venda_aluguel')" : "1=1";
  const p = exprPreco(fin);
  const m2 = exprM2(fin);
  const cidade = cidadeChave ?? "itajuba";
  const cidCond = "x.cidade_n = ?";

  const geral = db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(i.status = 'disponivel'), 0) AS disponiveis,
              COALESCE(SUM(i.status = 'disponivel' AND COALESCE(i.preco, i.preco_aluguel) IS NOT NULL), 0) AS comPreco,
              COALESCE(SUM(x.novo), 0) AS novos, COALESCE(SUM(x.variacao < 0), 0) AS quedas
       ${FROM}`,
    )
    .get() as Resumo["geral"];
  geral.imobiliarias = (db.prepare("SELECT COUNT(*) AS n FROM imobiliarias WHERE status = 'ativa'").get() as { n: number }).n;
  geral.oportunidades = (
    db
      .prepare(`SELECT COUNT(*) AS n ${FROM} WHERE i.status = 'disponivel' AND ${finCond} AND ${cidCond} AND x.ref_escopo = 'bairro' AND x.desconto >= 0.1`)
      .get(cidade) as { n: number }
  ).n;
  geral.ultimaColeta = (db.prepare("SELECT MAX(fim) AS f FROM coletas").get() as { f: string | null }).f;

  const linhas = db
    .prepare(
      `SELECT i.tipo, x.bairro_n, x.bairro_d, ${p} AS p, ${m2} AS m2 ${FROM}
       WHERE i.status = 'disponivel' AND ${finCond} AND ${cidCond}`,
    )
    .all(cidade) as { tipo: string | null; bairro_n: string | null; bairro_d: string | null; p: number | null; m2: number | null }[];

  const porTipoMap = new Map<string, { p: number[]; m2: number[]; n: number }>();
  const porBairroMap = new Map<string, { nome: string; p: number[]; m2: number[]; n: number; casas: number; aptos: number; terrenos: number }>();
  for (const l of linhas) {
    const t = l.tipo ?? "outro";
    let pt = porTipoMap.get(t);
    if (!pt) porTipoMap.set(t, (pt = { p: [], m2: [], n: 0 }));
    pt.n++;
    if (l.p) pt.p.push(l.p);
    if (l.m2) pt.m2.push(l.m2);
    if (l.bairro_n) {
      let pb = porBairroMap.get(l.bairro_n);
      if (!pb) porBairroMap.set(l.bairro_n, (pb = { nome: l.bairro_d ?? l.bairro_n, p: [], m2: [], n: 0, casas: 0, aptos: 0, terrenos: 0 }));
      pb.n++;
      if (l.p) pb.p.push(l.p);
      if (l.m2) pb.m2.push(l.m2);
      if (t === "casa" || t === "casa_condominio") pb.casas++;
      else if (t === "apartamento" || t === "cobertura") pb.aptos++;
      else if (t === "terreno") pb.terrenos++;
    }
  }
  const porTipo = [...porTipoMap]
    .map(([tipo, v]) => ({ tipo, n: v.n, mediana: mediana(v.p), mediana_m2: mediana(v.m2) }))
    .sort((a, b) => b.n - a.n);
  const porBairro = [...porBairroMap]
    .map(([chave, v]) => ({ chave, nome: v.nome, n: v.n, mediana: mediana(v.p), mediana_m2: mediana(v.m2), casas: v.casas, aptos: v.aptos, terrenos: v.terrenos }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 40);

  const porImobiliaria = db
    .prepare(
      `SELECT m.slug, m.nome, m.site, m.plataforma, m.status, COUNT(i.id) AS n,
              SUM(i.status = 'disponivel') AS disponiveis,
              SUM(i.status = 'disponivel' AND COALESCE(i.preco, i.preco_aluguel) IS NOT NULL) AS comPreco,
              m.ultima_coleta AS ultimaColeta
       FROM imobiliarias m LEFT JOIN imoveis i ON i.imobiliaria_id = m.id
       GROUP BY m.id ORDER BY n DESC, m.nome`,
    )
    .all() as Resumo["porImobiliaria"];

  const limites = fin === "aluguel" ? [500, 1000, 1500, 2500, 4000, 8000] : [150e3, 300e3, 500e3, 800e3, 1.2e6, 2e6, 5e6];
  const faixas = limites.map((lim, i) => ({
    rotulo: i === 0 ? `até ${curto(lim)}` : `${curto(limites[i - 1])} – ${curto(lim)}`,
    n: 0,
  }));
  faixas.push({ rotulo: `acima de ${curto(limites[limites.length - 1])}`, n: 0 });
  for (const l of linhas) {
    if (!l.p) continue;
    let i = limites.findIndex((lim) => l.p! <= lim);
    if (i < 0) i = limites.length;
    faixas[i].n++;
  }

  type Crua = Imovel & { fotos_json: string };
  const quedas = (db
    .prepare(`SELECT ${COLS} ${FROM} WHERE i.status = 'disponivel' AND x.variacao < 0 ORDER BY x.variacao ASC LIMIT 12`)
    .all() as Crua[]).map(hidrata);
  const novos = (db
    .prepare(`SELECT ${COLS} ${FROM} WHERE i.status = 'disponivel' AND x.novo = 1 ORDER BY (x.capa IS NULL), i.criado_em DESC LIMIT 12`)
    .all() as Crua[]).map(hidrata);
  const oportunidades = (db
    .prepare(
      `SELECT ${COLS} ${FROM} WHERE i.status = 'disponivel' AND ${finCond} AND ${cidCond}
         AND x.capa IS NOT NULL AND x.ref_escopo = 'bairro' AND x.desconto >= 0.1
       ORDER BY x.desconto DESC LIMIT 12`,
    )
    .all(cidade) as Crua[]).map(hidrata);

  return { geral, cidade, fin, porTipo, porBairro, porImobiliaria, faixas, quedas, novos, oportunidades };
}

function curto(v: number): string {
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3)} mil`;
  return `R$ ${v}`;
}

export function cidades(): FacetaItem[] {
  const db = conexao();
  return db
    .prepare(
      `SELECT x.cidade_n AS chave, MAX(x.cidade_d) AS nome, COUNT(*) AS n
       FROM mem.idx x JOIN imoveis i ON i.id = x.id
       WHERE x.cidade_n IS NOT NULL AND i.status = 'disponivel' GROUP BY 1 ORDER BY n DESC`,
    )
    .all() as FacetaItem[];
}

// --------------------------------------------------------------- sugestões

const ROTULOS_TIPO: Sugestao[] = Object.entries(rotulosTipo()).map(([chave, nome]) => ({ tipo: "tipo", chave, nome }));

function rotulosTipo(): Record<string, string> {
  return {
    casa: "Casa", apartamento: "Apartamento", terreno: "Terreno", chacara: "Chácara / Sítio",
    comercial: "Comercial", casa_condominio: "Casa em condomínio", cobertura: "Cobertura",
  };
}

/** Autocomplete: bairros, cidades, tipos, imobiliárias e códigos que começam com o que foi digitado. */
export function sugestoes(q: string, limite = 8): Sugestao[] {
  const t = norm(q);
  if (!t || t.length < 2) return [];
  const voc = vocabulario();
  const pontua = (nome: string): number => {
    const n = norm(nome) ?? "";
    if (n === t) return 3;
    if (n.startsWith(t)) return 2;
    if (n.split(" ").some((w) => w.startsWith(t))) return 1;
    return 0;
  };
  const achados: { s: Sugestao; p: number }[] = [];
  for (const s of [...ROTULOS_TIPO, ...voc]) {
    const p = pontua(s.nome);
    if (p) achados.push({ s, p });
    if (achados.length > 400) break;
  }
  achados.sort((a, b) => b.p - a.p || (b.s.n ?? 0) - (a.s.n ?? 0));
  // No máximo dois códigos, para não afogar bairros e cidades.
  const out: Sugestao[] = [];
  const vistos = new Set<string>();
  let codigos = 0;
  for (const { s } of achados) {
    if (s.tipo === "codigo" && ++codigos > 2) continue;
    if (s.tipo === "bairro" && (s.n ?? 0) < 2) continue; // grafias únicas costumam ser endereço colado no bairro
    const k = `${s.tipo}:${s.chave}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(s);
    if (out.length >= limite) break;
  }
  return out;
}

// --------------------------------------------------------------------- CSV

export function csv(f: Filtros): string {
  const db = conexao();
  const m = montar(f);
  const linhas = (db
    .prepare(`SELECT ${COLS} ${m.from} ${m.where} ORDER BY ${ordenacao(f, m.temTexto)} LIMIT ?`)
    .all(...m.params, MAX_CSV) as (Imovel & { fotos_json: string })[]).map(hidrata);
  const cab = [
    "id", "tipo", "finalidade", "preco", "preco_aluguel", "preco_m2", "area", "quartos", "suites",
    "banheiros", "vagas", "bairro", "cidade", "imobiliaria", "codigo", "status", "variacao", "desconto_vs_mediana", "url", "titulo",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = linhas.map((l) =>
    [
      l.id, rotuloTipo(l.tipo), l.finalidade, l.preco, l.preco_aluguel,
      l.preco_m2 != null ? Math.round(l.preco_m2) : null, l.area, l.quartos, l.suites, l.banheiros,
      l.vagas, l.bairro, l.cidade, l.imobiliaria, l.codigo, l.status,
      l.variacao != null ? Math.round(l.variacao * 1000) / 10 : null,
      l.desconto != null ? Math.round(l.desconto * 1000) / 10 : null, l.url, l.titulo,
    ]
      .map(esc)
      .join(";"),
  );
  return "﻿" + [cab.join(";"), ...corpo].join("\r\n");
}
