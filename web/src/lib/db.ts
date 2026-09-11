/**
 * Conexão com o catálogo (data/imoveis.db) e índice em memória.
 *
 * O banco é escrito pelos scrapers Python; aqui só se lê. Em cima dele
 * montamos, num banco anexado em memória, uma tabela auxiliar por imóvel
 * (cidade/bairro normalizados, capa válida, variação de preço, "novo",
 * desconto frente à mediana de R$/m² do bairro) e um índice FTS5 para busca
 * por texto sem acento. O índice é refeito quando `PRAGMA data_version`
 * indica que outra conexão gravou no arquivo.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { norm } from "./normalize";
import { rotuloTipo } from "./format";
import type { Sugestao } from "./types";

// IMOBIAPP_DB manda; senão o banco vivo dos scrapers (../data) e, por último,
// o snapshot que `./run.py exportar` deixa em web/data para o deploy só do site.
export const CAMINHO_DB = path.resolve(
  process.env.IMOBIAPP_DB ??
    [path.join("..", "data", "imoveis.db"), path.join("data", "imoveis.db")].find((c) =>
      fs.existsSync(/*turbopackIgnore: true*/ c),
    ) ??
    path.join("..", "data", "imoveis.db"),
);

export const FOTO_LIXO =
  /no-?image|sem-?foto|semimagem|favicon|\/logo|logo[._-]|fundosite|placeholder|default\.(?:jpe?g|png)|indispon|\.svg(?:$|\?)/i;
const LAT: [number, number] = [-25.5, -18];
const LNG: [number, number] = [-51, -39.5];
const DIA = 86_400_000;
const INTERVALO_MIN_REINDEX = 10_000;
// Sobe quando as colunas de mem.idx mudam: em desenvolvimento o estado vive em
// globalThis e sobrevive ao hot reload, então o índice velho precisa ser refeito.
const VERSAO_INDICE = 3;
const MIN_BAIRRO = 5; // anúncios com R$/m² para a mediana do bairro valer
// R$/m² só compara bem dentro do mesmo bairro e para tipos homogêneos; chácara
// (hectares vs. m²) e comercial (sala vs. galpão) dão mediana sem sentido.
const TIPOS_COMPARAVEIS = new Set(["casa", "apartamento", "casa_condominio", "cobertura", "terreno"]);
const AREA_PLAUSIVEL: Record<string, [number, number]> = {
  terreno: [100, 50_000],
  casa: [30, 2_000],
  casa_condominio: [30, 2_000],
  apartamento: [20, 1_000],
  cobertura: [30, 1_000],
};

interface Estado {
  db: Database.Database;
  esquema: number;
  versao: number | null;
  verificadoEm: number;
  indexadoEm: string | null;
  sugestoes: Sugestao[];
}

const g = globalThis as unknown as { __imobiapp?: Estado };

export function conexao(): Database.Database {
  if (!g.__imobiapp) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ CAMINHO_DB)) {
      throw new Error(
        `Banco não encontrado em ${CAMINHO_DB}. Rode "./run.py coletar" na raiz do projeto ` +
          `ou aponte IMOBIAPP_DB para o arquivo.`,
      );
    }
    const db = new Database(CAMINHO_DB, { timeout: 30_000 });
    db.pragma("busy_timeout = 30000");
    db.exec("ATTACH DATABASE ':memory:' AS mem");
    db.function("norm", { deterministic: true }, (s: unknown) => norm(s as string));
    g.__imobiapp = { db, esquema: VERSAO_INDICE, versao: null, verificadoEm: 0, indexadoEm: null, sugestoes: [] };
  }
  const e = g.__imobiapp;
  const agora = Date.now();
  const desatualizado = e.versao === null || e.esquema !== VERSAO_INDICE;
  if (desatualizado || agora - e.verificadoEm > INTERVALO_MIN_REINDEX) {
    e.verificadoEm = agora;
    const v = e.db.pragma("main.data_version", { simple: true }) as number;
    if (desatualizado || v !== e.versao) {
      e.sugestoes = indexa(e.db);
      e.versao = v;
      e.esquema = VERSAO_INDICE;
      e.indexadoEm = new Date().toISOString();
    }
  }
  return e.db;
}

export function indexadoEm(): string | null {
  return g.__imobiapp?.indexadoEm ?? null;
}

/** Vocabulário para o autocomplete, montado junto com o índice. */
export function vocabulario(): Sugestao[] {
  conexao();
  return g.__imobiapp?.sugestoes ?? [];
}

// ------------------------------------------------------------------ índice

interface LinhaImovel {
  id: number;
  imobiliaria_id: number;
  codigo: string | null;
  finalidade: string | null;
  tipo: string | null;
  titulo: string | null;
  descricao: string | null;
  preco: number | null;
  preco_aluguel: number | null;
  area_util: number | null;
  area_total: number | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  latitude: number | null;
  longitude: number | null;
  foto_capa: string | null;
  status: string;
  criado_em: string;
  imob: string;
  imob_slug: string;
}

interface Hist {
  imovel_id: number;
  data: string;
  preco: number | null;
  preco_aluguel: number | null;
}

/** Entre "ITAJUBÁ", "Itajubá" e "Itajuba", fica com a grafia mais bem cuidada e mais usada. */
function melhorNome(variantes: Map<string, number>): string {
  let melhor: string | null = null;
  let melhorChave: [number, number] | null = null;
  for (const [v, n] of variantes) {
    const ruim = (v === v.toUpperCase() ? 1 : 0) + (/\b(Da|De|Do|Das|Dos|E)\b/.test(v) ? 1 : 0);
    const chave: [number, number] = [ruim, -n];
    if (!melhorChave || chave[0] < melhorChave[0] || (chave[0] === melhorChave[0] && chave[1] < melhorChave[1])) {
      melhor = v;
      melhorChave = chave;
    }
  }
  return melhor ?? "";
}

function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function indexa(db: Database.Database): Sugestao[] {
  db.exec(`
    DROP TABLE IF EXISTS mem.idx;
    DROP TABLE IF EXISTS mem.fts;
    CREATE TABLE mem.idx (
      id             INTEGER PRIMARY KEY,
      fin            TEXT,
      cidade_n       TEXT, cidade_d TEXT,
      bairro_n       TEXT, bairro_d TEXT,
      capa           TEXT,
      fotos_json     TEXT,
      n_fotos        INTEGER NOT NULL DEFAULT 0,
      novo           INTEGER NOT NULL DEFAULT 0,
      preco_anterior REAL,
      variacao       REAL,
      data_variacao  TEXT,
      lat REAL, lng REAL,
      area REAL, preco_m2 REAL, aluguel_m2 REAL,
      desconto REAL, ref_escopo TEXT, ref_n INTEGER, ref_m2 REAL
    );
    CREATE INDEX mem.ix_idx_loc ON idx(cidade_n, bairro_n);
    CREATE INDEX mem.ix_idx_fin ON idx(fin);
    CREATE VIRTUAL TABLE mem.fts USING fts5(texto, tokenize='unicode61 remove_diacritics 2');
  `);

  const primeiraColeta = new Map<number, number>();
  for (const r of db
    .prepare("SELECT imobiliaria_id AS id, MIN(inicio) AS inicio FROM coletas GROUP BY 1")
    .all() as { id: number; inicio: string }[]) {
    primeiraColeta.set(r.id, Date.parse(r.inicio));
  }

  const fotos = new Map<number, string[]>();
  for (const r of db
    .prepare("SELECT imovel_id, url FROM fotos ORDER BY imovel_id, ordem")
    .all() as { imovel_id: number; url: string }[]) {
    if (FOTO_LIXO.test(r.url)) continue;
    let l = fotos.get(r.imovel_id);
    if (!l) fotos.set(r.imovel_id, (l = []));
    l.push(r.url);
  }

  const cars = new Map<number, string[]>();
  for (const r of db
    .prepare("SELECT imovel_id, nome FROM caracteristicas")
    .all() as { imovel_id: number; nome: string }[]) {
    let l = cars.get(r.imovel_id);
    if (!l) cars.set(r.imovel_id, (l = []));
    l.push(r.nome);
  }

  const hist = new Map<number, Hist[]>();
  for (const r of db
    .prepare("SELECT imovel_id, data, preco, preco_aluguel FROM historico_preco ORDER BY imovel_id, id")
    .all() as Hist[]) {
    let l = hist.get(r.imovel_id);
    if (!l) hist.set(r.imovel_id, (l = []));
    l.push(r);
  }

  const linhas = db
    .prepare(
      `SELECT i.id, i.imobiliaria_id, i.codigo, i.finalidade, i.tipo, i.titulo, i.descricao,
              i.preco, i.preco_aluguel, i.area_util, i.area_total, i.endereco, i.bairro, i.cidade,
              i.latitude, i.longitude, i.foto_capa, i.status, i.criado_em,
              m.nome AS imob, m.slug AS imob_slug
         FROM imoveis i JOIN imobiliarias m ON m.id = i.imobiliaria_id`,
    )
    .all() as LinhaImovel[];

  // Grafia canônica por chave normalizada (cidade e bairro).
  const cidades = new Map<string, Map<string, number>>();
  const bairros = new Map<string, Map<string, number>>();
  const conta = (m: Map<string, Map<string, number>>, k: string | null, v: string | null) => {
    if (!k || !v) return;
    let vs = m.get(k);
    if (!vs) m.set(k, (vs = new Map()));
    vs.set(v.trim(), (vs.get(v.trim()) ?? 0) + 1);
  };
  for (const l of linhas) {
    conta(cidades, norm(l.cidade), l.cidade);
    conta(bairros, norm(l.bairro), l.bairro);
  }
  const nomeCidade = new Map([...cidades].map(([k, vs]) => [k, melhorNome(vs)]));
  const nomeBairro = new Map([...bairros].map(([k, vs]) => [k, melhorNome(vs)]));

  // Primeira passada: campos derivados por imóvel.
  type Derivado = {
    fin: string | null;
    cn: string | null;
    bn: string | null;
    area: number | null;
    precoM2: number | null;
    aluguelM2: number | null;
  };
  const derivados = new Map<number, Derivado>();
  const grupos = new Map<string, number[]>(); // chave -> lista de R$/m²
  const acumula = (k: string, v: number) => {
    let l = grupos.get(k);
    if (!l) grupos.set(k, (l = []));
    l.push(v);
  };
  for (const l of linhas) {
    const fin =
      l.finalidade ??
      (l.preco != null && l.preco_aluguel != null
        ? "venda_aluguel"
        : l.preco != null
          ? "venda"
          : l.preco_aluguel != null
            ? "aluguel"
            : null);
    const area = l.area_util ?? l.area_total ?? null;
    const precoM2 = l.preco && area ? l.preco / area : null;
    const aluguelM2 = l.preco_aluguel && area ? l.preco_aluguel / area : null;
    const cn = norm(l.cidade);
    const bn = norm(l.bairro);
    derivados.set(l.id, { fin, cn, bn, area, precoM2, aluguelM2 });
    // Medianas só com anúncios ativos, tipo comparável, área plausível e mesmo bairro.
    const faixa = l.tipo ? AREA_PLAUSIVEL[l.tipo] : undefined;
    const areaOk = !!(faixa && area && area >= faixa[0] && area <= faixa[1]);
    if (l.status === "disponivel" && l.tipo && TIPOS_COMPARAVEIS.has(l.tipo) && cn && bn && areaOk) {
      if (precoM2) acumula(`venda|${cn}|${bn}|${l.tipo}`, precoM2);
      if (aluguelM2) acumula(`aluguel|${cn}|${bn}|${l.tipo}`, aluguelM2);
    }
  }
  const medianas = new Map<string, { m: number; n: number }>();
  for (const [k, v] of grupos) {
    if (v.length >= MIN_BAIRRO) medianas.set(k, { m: mediana(v)!, n: v.length });
  }

  const insIdx = db.prepare(
    `INSERT INTO mem.idx (id, fin, cidade_n, cidade_d, bairro_n, bairro_d, capa, fotos_json, n_fotos, novo,
                          preco_anterior, variacao, data_variacao, lat, lng, area, preco_m2, aluguel_m2,
                          desconto, ref_escopo, ref_n, ref_m2)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insFts = db.prepare("INSERT INTO mem.fts (rowid, texto) VALUES (?, ?)");
  const agora = Date.now();
  const contagemBairro = new Map<string, { nome: string; cidade: string; n: number }>();
  const contagemCidade = new Map<string, { nome: string; n: number }>();
  const contagemImob = new Map<string, { nome: string; n: number }>();
  const codigos: Sugestao[] = [];

  db.transaction(() => {
    for (const l of linhas) {
      const d = derivados.get(l.id)!;
      const lista = fotos.get(l.id) ?? [];
      const capaOk = l.foto_capa && !FOTO_LIXO.test(l.foto_capa) ? l.foto_capa : null;
      const capa = capaOk ?? lista[0] ?? null;
      const carrossel = capa ? [capa, ...lista.filter((f) => f !== capa)].slice(0, 6) : [];
      const nFotos = Math.max(lista.length, capa ? 1 : 0);

      const pc = primeiraColeta.get(l.imobiliaria_id);
      const criado = Date.parse(l.criado_em);
      const novo =
        pc != null && !isNaN(criado) && criado - pc > DIA && agora - criado < 7 * DIA ? 1 : 0;

      let precoAnterior: number | null = null;
      let variacao: number | null = null;
      let dataVariacao: string | null = null;
      const h = hist.get(l.id);
      if (h && h.length >= 2) {
        const ult = h[h.length - 1];
        const ant = h[h.length - 2];
        const campo: keyof Hist = ult.preco != null && ant.preco != null ? "preco" : "preco_aluguel";
        const a = ant[campo] as number | null;
        const b = ult[campo] as number | null;
        if (a && b && a !== b) {
          precoAnterior = a;
          variacao = (b - a) / a;
          dataVariacao = ult.data;
        }
      }

      const okCoord =
        l.latitude != null &&
        l.longitude != null &&
        l.latitude >= LAT[0] &&
        l.latitude <= LAT[1] &&
        l.longitude >= LNG[0] &&
        l.longitude <= LNG[1];

      // Desconto frente à mediana de R$/m² de anúncios parecidos (venda tem prioridade).
      let desconto: number | null = null;
      let refEscopo: string | null = null;
      let refN: number | null = null;
      let refM2: number | null = null;
      const m2 = d.precoM2 ?? d.aluguelM2;
      const finRef = d.precoM2 ? "venda" : "aluguel";
      const faixaArea = l.tipo ? AREA_PLAUSIVEL[l.tipo] : undefined;
      if (m2 && l.tipo && d.cn && d.bn && faixaArea && d.area && d.area >= faixaArea[0] && d.area <= faixaArea[1]) {
        const ref = medianas.get(`${finRef}|${d.cn}|${d.bn}|${l.tipo}`);
        const desc = ref ? 1 - m2 / ref.m : null;
        // Mais de 60% abaixo quase sempre é área ou preço errado no anúncio, não pechincha.
        if (ref && desc != null && desc <= 0.6 && desc >= -1.5) {
          desconto = desc;
          refEscopo = "bairro";
          refN = ref.n;
          refM2 = ref.m;
        }
      }

      const cidadeD = d.cn ? nomeCidade.get(d.cn) ?? l.cidade : null;
      const bairroD = d.bn ? nomeBairro.get(d.bn) ?? l.bairro : null;
      insIdx.run(
        l.id, d.fin, d.cn, cidadeD, d.bn, bairroD, capa, JSON.stringify(carrossel), nFotos, novo,
        precoAnterior, variacao, dataVariacao,
        okCoord ? l.latitude : null, okCoord ? l.longitude : null,
        d.area, d.precoM2, d.aluguelM2, desconto, refEscopo, refN, refM2,
      );

      const texto = [
        l.titulo, l.descricao, l.bairro, l.cidade, rotuloTipo(l.tipo), l.tipo, l.codigo, l.imob,
        l.endereco, ...(cars.get(l.id) ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      insFts.run(l.id, texto);

      if (l.status === "disponivel") {
        if (d.cn && cidadeD) {
          const c = contagemCidade.get(d.cn) ?? { nome: cidadeD, n: 0 };
          c.n++;
          contagemCidade.set(d.cn, c);
          if (d.bn && bairroD) {
            const k = `${d.cn}|${d.bn}`;
            const b = contagemBairro.get(k) ?? { nome: bairroD, cidade: cidadeD, n: 0 };
            b.n++;
            contagemBairro.set(k, b);
          }
        }
        const im = contagemImob.get(l.imob_slug) ?? { nome: l.imob, n: 0 };
        im.n++;
        contagemImob.set(l.imob_slug, im);
        if (l.codigo) {
          codigos.push({ tipo: "codigo", chave: String(l.id), nome: l.codigo, detalhe: `${rotuloTipo(l.tipo)} · ${l.imob}` });
        }
      }
    }
  })();

  const sugestoes: Sugestao[] = [];
  for (const [k, b] of contagemBairro) {
    sugestoes.push({ tipo: "bairro", chave: k.split("|")[1], nome: b.nome, detalhe: b.cidade, n: b.n });
  }
  for (const [k, c] of contagemCidade) sugestoes.push({ tipo: "cidade", chave: k, nome: c.nome, n: c.n });
  for (const [k, im] of contagemImob) sugestoes.push({ tipo: "imob", chave: k, nome: im.nome, n: im.n });
  sugestoes.sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
  return [...sugestoes, ...codigos];
}
