/** Consultas do backoffice. Tudo recebe o id da imobiliária (null = admin vendo todas). */
import { conexao } from "./db";
import type { HistoricoPreco } from "./types";
import { PROBLEMAS, STATUS_IMOVEL, STATUS_LEAD } from "./painel-rotulos";

export { PROBLEMAS, STATUS_IMOVEL, STATUS_LEAD };

export interface FiltrosPainel {
  q: string;
  status: string;
  tipo: string;
  fin: string;
  problema: string;
  origem: string;
  ordem: string;
  pagina: number;
}

export interface ImovelPainel {
  id: number;
  codigo: string | null;
  tipo: string | null;
  finalidade: string | null;
  titulo: string | null;
  preco: number | null;
  preco_aluguel: number | null;
  area: number | null;
  quartos: number | null;
  bairro: string | null;
  cidade: string | null;
  capa: string | null;
  n_fotos: number;
  status: string;
  origem: string;
  travado: number;
  destaque: number;
  criado_em: string;
  atualizado_em: string;
  visto_em: string;
  variacao: number | null;
  lat: number | null;
  leads: number;
  imobiliaria: string;
  descricao_ok: number;
}

export interface ResumoPainel {
  ativos: number;
  pausados: number;
  fechados30: number;
  novos30: number;
  leadsNovos: number;
  leads30: number;
  semFoto: number;
  semPreco: number;
  semLocal: number;
  semDescricao: number;
  baixaram: number;
  destaques: number;
  diasNoAr: number | null;
  travados: number;
  ultimaColeta: string | null;
  porTipo: { tipo: string; n: number }[];
  porStatus: { status: string; n: number }[];
}

export const POR_PAGINA_PAINEL = 30;

const PROBLEMA_SQL: Record<string, string> = {
  sem_foto: "x.capa IS NULL",
  sem_preco: "COALESCE(i.preco, i.preco_aluguel) IS NULL",
  sem_local: "x.lat IS NULL",
  sem_descricao: "(i.descricao IS NULL OR length(i.descricao) < 40)",
  sem_area: "x.area IS NULL",
  antigo: "i.status = 'disponivel' AND julianday('now') - julianday(i.criado_em) > 180",
};

type Params = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFiltrosPainel(sp: Params): FiltrosPainel {
  const pagina = Math.max(1, Math.floor(Number(um(sp.pagina)) || 1));
  return {
    q: um(sp.q).trim().slice(0, 100),
    status: um(sp.status),
    tipo: um(sp.tipo),
    fin: um(sp.fin),
    problema: um(sp.problema) in PROBLEMA_SQL ? um(sp.problema) : "",
    origem: um(sp.origem),
    ordem: um(sp.ordem) || "atualizado",
    pagina,
  };
}

function escopoSql(imobId: number | null): { sql: string; params: number[] } {
  return imobId == null ? { sql: "1=1", params: [] } : { sql: "i.imobiliaria_id = ?", params: [imobId] };
}

const COLS_PAINEL = `
  i.id, i.codigo, i.tipo, x.fin AS finalidade, i.titulo, i.preco, i.preco_aluguel, x.area, i.quartos,
  x.bairro_d AS bairro, x.cidade_d AS cidade, x.capa, x.n_fotos, i.status, i.origem, i.travado, i.destaque,
  i.criado_em, i.atualizado_em, i.visto_em, x.variacao, x.lat, m.nome AS imobiliaria,
  (i.descricao IS NOT NULL AND length(i.descricao) >= 40) AS descricao_ok,
  (SELECT COUNT(*) FROM leads l WHERE l.imovel_id = i.id) AS leads`;

const FROM_PAINEL = `FROM imoveis i JOIN imobiliarias m ON m.id = i.imobiliaria_id JOIN mem.idx x ON x.id = i.id`;

export function listaImoveis(imobId: number | null, f: FiltrosPainel): { total: number; itens: ImovelPainel[]; paginas: number } {
  const db = conexao();
  const e = escopoSql(imobId);
  const onde: string[] = [e.sql];
  const params: unknown[] = [...e.params];
  if (f.q) {
    onde.push("(i.codigo LIKE ? OR i.titulo LIKE ? OR i.bairro LIKE ? OR i.endereco LIKE ? OR CAST(i.id AS TEXT) = ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like, like, f.q);
  }
  if (f.status && f.status !== "todos") {
    onde.push("i.status = ?");
    params.push(f.status);
  } else if (!f.status) {
    onde.push("i.status <> 'removido'");
  }
  if (f.tipo) {
    onde.push("i.tipo = ?");
    params.push(f.tipo);
  }
  if (f.fin === "venda") onde.push("x.fin IN ('venda','venda_aluguel')");
  else if (f.fin === "aluguel") onde.push("x.fin IN ('aluguel','venda_aluguel')");
  if (f.problema) onde.push(PROBLEMA_SQL[f.problema]);
  if (f.origem === "manual" || f.origem === "scraper") {
    onde.push("i.origem = ?");
    params.push(f.origem);
  }
  const ordens: Record<string, string> = {
    atualizado: "i.atualizado_em DESC",
    criado: "i.criado_em DESC",
    preco_asc: "COALESCE(i.preco, i.preco_aluguel) IS NULL, COALESCE(i.preco, i.preco_aluguel) ASC",
    preco_desc: "COALESCE(i.preco, i.preco_aluguel) DESC",
    leads: "leads DESC, i.atualizado_em DESC",
    codigo: "i.codigo",
  };
  const ordem = ordens[f.ordem] ?? ordens.atualizado;
  const where = `WHERE ${onde.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) AS n ${FROM_PAINEL} ${where}`).get(...params) as { n: number }).n;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_PAINEL));
  const pagina = Math.min(f.pagina, paginas);
  const itens = db
    .prepare(`SELECT ${COLS_PAINEL} ${FROM_PAINEL} ${where} ORDER BY ${ordem}, i.id DESC LIMIT ? OFFSET ?`)
    .all(...params, POR_PAGINA_PAINEL, (pagina - 1) * POR_PAGINA_PAINEL) as ImovelPainel[];
  return { total, itens, paginas };
}

export function resumoPainel(imobId: number | null): ResumoPainel {
  const db = conexao();
  const e = escopoSql(imobId);
  const g = db
    .prepare(
      `SELECT
         SUM(i.status = 'disponivel') AS ativos,
         SUM(i.status = 'pausado') AS pausados,
         SUM(i.status IN ('vendido','alugado') AND julianday('now') - julianday(i.atualizado_em) <= 30) AS fechados30,
         SUM(i.status = 'disponivel' AND julianday('now') - julianday(i.criado_em) <= 30) AS novos30,
         SUM(i.status = 'disponivel' AND x.capa IS NULL) AS semFoto,
         SUM(i.status = 'disponivel' AND COALESCE(i.preco, i.preco_aluguel) IS NULL) AS semPreco,
         SUM(i.status = 'disponivel' AND x.lat IS NULL) AS semLocal,
         SUM(i.status = 'disponivel' AND (i.descricao IS NULL OR length(i.descricao) < 40)) AS semDescricao,
         SUM(i.status = 'disponivel' AND x.variacao < 0) AS baixaram,
         SUM(i.status = 'disponivel' AND i.destaque = 1) AS destaques,
         SUM(i.travado = 1) AS travados,
         AVG(CASE WHEN i.status = 'disponivel' THEN julianday('now') - julianday(i.criado_em) END) AS diasNoAr
       ${FROM_PAINEL} WHERE ${e.sql}`,
    )
    .get(...e.params) as Omit<ResumoPainel, "leadsNovos" | "leads30" | "ultimaColeta" | "porTipo" | "porStatus">;
  const le = imobId == null ? { sql: "1=1", params: [] as number[] } : { sql: "imobiliaria_id = ?", params: [imobId] };
  const l = db
    .prepare(
      `SELECT SUM(status = 'novo') AS leadsNovos,
              SUM(julianday('now') - julianday(criado_em) <= 30) AS leads30
         FROM leads WHERE ${le.sql}`,
    )
    .get(...le.params) as { leadsNovos: number | null; leads30: number | null };
  const ultimaColeta =
    imobId == null
      ? (db.prepare("SELECT MAX(fim) AS f FROM coletas").get() as { f: string | null }).f
      : (db.prepare("SELECT MAX(fim) AS f FROM coletas WHERE imobiliaria_id = ?").get(imobId) as { f: string | null }).f;
  const porTipo = db
    .prepare(`SELECT COALESCE(i.tipo, 'outro') AS tipo, COUNT(*) AS n ${FROM_PAINEL} WHERE ${e.sql} AND i.status = 'disponivel' GROUP BY 1 ORDER BY n DESC`)
    .all(...e.params) as ResumoPainel["porTipo"];
  const porStatus = db
    .prepare(`SELECT i.status, COUNT(*) AS n ${FROM_PAINEL} WHERE ${e.sql} GROUP BY 1 ORDER BY n DESC`)
    .all(...e.params) as ResumoPainel["porStatus"];
  const zero = (v: number | null | undefined) => v ?? 0;
  return {
    ativos: zero(g.ativos),
    pausados: zero(g.pausados),
    fechados30: zero(g.fechados30),
    novos30: zero(g.novos30),
    semFoto: zero(g.semFoto),
    semPreco: zero(g.semPreco),
    semLocal: zero(g.semLocal),
    semDescricao: zero(g.semDescricao),
    baixaram: zero(g.baixaram),
    destaques: zero(g.destaques),
    travados: zero(g.travados),
    diasNoAr: g.diasNoAr ?? null,
    leadsNovos: zero(l.leadsNovos),
    leads30: zero(l.leads30),
    ultimaColeta,
    porTipo,
    porStatus,
  };
}

// ---------------------------------------------------------------- edição

export interface ImovelEdicao {
  id: number;
  imobiliaria_id: number;
  imobiliaria: string;
  codigo: string | null;
  url: string;
  finalidade: string | null;
  tipo: string | null;
  titulo: string | null;
  descricao: string | null;
  preco: number | null;
  preco_aluguel: number | null;
  condominio: number | null;
  iptu: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  foto_capa: string | null;
  status: string;
  origem: string;
  travado: number;
  destaque: number;
  obs_interna: string | null;
  criado_em: string;
  atualizado_em: string;
  visto_em: string;
  fotos: string[];
  caracteristicas: string[];
  historico: HistoricoPreco[];
  leads: LeadPainel[];
  auditoria: Auditoria[];
}

export function imovelParaEdicao(id: number, imobId: number | null): ImovelEdicao | null {
  const db = conexao();
  const base = db
    .prepare(
      `SELECT i.id, i.imobiliaria_id, m.nome AS imobiliaria, i.codigo, i.url, i.finalidade, i.tipo, i.titulo, i.descricao,
              i.preco, i.preco_aluguel, i.condominio, i.iptu, i.area_total, i.area_util, i.quartos, i.suites, i.banheiros,
              i.vagas, i.endereco, i.bairro, i.cidade, i.uf, i.cep, i.latitude, i.longitude, i.foto_capa, i.status,
              i.origem, i.travado, i.destaque, i.obs_interna, i.criado_em, i.atualizado_em, i.visto_em
         FROM imoveis i JOIN imobiliarias m ON m.id = i.imobiliaria_id
        WHERE i.id = ? ${imobId == null ? "" : "AND i.imobiliaria_id = ?"}`,
    )
    .get(...(imobId == null ? [id] : [id, imobId])) as Omit<ImovelEdicao, "fotos" | "caracteristicas" | "historico" | "leads" | "auditoria"> | undefined;
  if (!base) return null;
  const fotos = (db.prepare("SELECT url FROM fotos WHERE imovel_id = ? ORDER BY ordem").all(id) as { url: string }[]).map((r) => r.url);
  const caracteristicas = (db.prepare("SELECT nome FROM caracteristicas WHERE imovel_id = ? ORDER BY nome").all(id) as { nome: string }[]).map((r) => r.nome);
  const historico = db.prepare("SELECT data, preco, preco_aluguel FROM historico_preco WHERE imovel_id = ? ORDER BY id").all(id) as HistoricoPreco[];
  const leads = db
    .prepare(`SELECT ${COLS_LEAD} ${FROM_LEAD} WHERE l.imovel_id = ? ORDER BY l.criado_em DESC LIMIT 20`)
    .all(id) as LeadPainel[];
  const auditoria = db
    .prepare(`SELECT ${COLS_AUD} ${FROM_AUD} WHERE a.imovel_id = ? ORDER BY a.id DESC LIMIT 30`)
    .all(id) as Auditoria[];
  return { ...base, fotos, caracteristicas, historico, leads, auditoria };
}

/** Características mais usadas pela imobiliária (ou por todas), para sugerir no formulário. */
export function caracteristicasComuns(imobId: number | null, limite = 40): string[] {
  const db = conexao();
  const e = imobId == null ? { sql: "1=1", params: [] as number[] } : { sql: "i.imobiliaria_id = ?", params: [imobId] };
  return (
    db
      .prepare(
        `SELECT c.nome, COUNT(*) AS n FROM caracteristicas c JOIN imoveis i ON i.id = c.imovel_id
          WHERE ${e.sql} GROUP BY c.nome ORDER BY n DESC LIMIT ?`,
      )
      .all(...e.params, limite) as { nome: string }[]
  ).map((r) => r.nome);
}

export function bairrosConhecidos(): { bairro: string; cidade: string }[] {
  return conexao()
    .prepare(
      `SELECT MAX(bairro_d) AS bairro, MAX(cidade_d) AS cidade FROM mem.idx
        WHERE bairro_d IS NOT NULL AND cidade_d IS NOT NULL GROUP BY cidade_n, bairro_n ORDER BY COUNT(*) DESC LIMIT 300`,
    )
    .all() as { bairro: string; cidade: string }[];
}

// ------------------------------------------------------------------ leads

export interface LeadPainel {
  id: number;
  imobiliaria_id: number;
  imobiliaria: string;
  imovel_id: number | null;
  imovel_titulo: string | null;
  imovel_codigo: string | null;
  imovel_tipo: string | null;
  imovel_bairro: string | null;
  imovel_preco: number | null;
  imovel_capa: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  mensagem: string | null;
  origem: string;
  status: string;
  obs: string | null;
  criado_em: string;
  atualizado_em: string;
}

const COLS_LEAD = `
  l.id, l.imobiliaria_id, m.nome AS imobiliaria, l.imovel_id, i.titulo AS imovel_titulo, i.codigo AS imovel_codigo,
  i.tipo AS imovel_tipo, i.bairro AS imovel_bairro, COALESCE(i.preco, i.preco_aluguel) AS imovel_preco,
  x.capa AS imovel_capa, l.nome, l.telefone, l.email, l.mensagem, l.origem, l.status, l.obs, l.criado_em, l.atualizado_em`;
const FROM_LEAD = `FROM leads l JOIN imobiliarias m ON m.id = l.imobiliaria_id
  LEFT JOIN imoveis i ON i.id = l.imovel_id LEFT JOIN mem.idx x ON x.id = i.id`;

export function listaLeads(imobId: number | null, status: string, pagina: number): { total: number; itens: LeadPainel[]; paginas: number; contagem: Record<string, number> } {
  const db = conexao();
  const onde: string[] = [imobId == null ? "1=1" : "l.imobiliaria_id = ?"];
  const params: unknown[] = imobId == null ? [] : [imobId];
  const contagem: Record<string, number> = {};
  for (const r of db.prepare(`SELECT l.status, COUNT(*) AS n ${FROM_LEAD} WHERE ${onde[0]} GROUP BY 1`).all(...params) as { status: string; n: number }[]) {
    contagem[r.status] = r.n;
  }
  if (status && status !== "todos") {
    onde.push("l.status = ?");
    params.push(status);
  } else if (!status) {
    onde.push("l.status IN ('novo','em_contato')");
  }
  const where = `WHERE ${onde.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) AS n ${FROM_LEAD} ${where}`).get(...params) as { n: number }).n;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_PAINEL));
  const p = Math.min(pagina, paginas);
  const itens = db
    .prepare(`SELECT ${COLS_LEAD} ${FROM_LEAD} ${where} ORDER BY (l.status = 'novo') DESC, l.criado_em DESC LIMIT ? OFFSET ?`)
    .all(...params, POR_PAGINA_PAINEL, (p - 1) * POR_PAGINA_PAINEL) as LeadPainel[];
  return { total, itens, paginas, contagem };
}

export function leadsRecentes(imobId: number | null, limite = 6): LeadPainel[] {
  const db = conexao();
  const e = imobId == null ? { sql: "1=1", params: [] as number[] } : { sql: "l.imobiliaria_id = ?", params: [imobId] };
  return db.prepare(`SELECT ${COLS_LEAD} ${FROM_LEAD} WHERE ${e.sql} ORDER BY l.criado_em DESC LIMIT ?`).all(...e.params, limite) as LeadPainel[];
}

// -------------------------------------------------------------- auditoria

export interface Auditoria {
  id: number;
  usuario: string | null;
  imobiliaria: string | null;
  imovel_id: number | null;
  imovel_codigo: string | null;
  imovel_titulo: string | null;
  acao: string;
  detalhes: string | null;
  criado_em: string;
}

const COLS_AUD = `a.id, u.nome AS usuario, m.nome AS imobiliaria, a.imovel_id, i.codigo AS imovel_codigo, i.titulo AS imovel_titulo,
  a.acao, a.detalhes, a.criado_em`;
const FROM_AUD = `FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
  LEFT JOIN imobiliarias m ON m.id = a.imobiliaria_id LEFT JOIN imoveis i ON i.id = a.imovel_id`;

export function listaAuditoria(imobId: number | null, pagina: number): { itens: Auditoria[]; paginas: number; total: number } {
  const db = conexao();
  const e = imobId == null ? { sql: "1=1", params: [] as number[] } : { sql: "a.imobiliaria_id = ?", params: [imobId] };
  const total = (db.prepare(`SELECT COUNT(*) AS n ${FROM_AUD} WHERE ${e.sql}`).get(...e.params) as { n: number }).n;
  const paginas = Math.max(1, Math.ceil(total / 50));
  const p = Math.min(pagina, paginas);
  const itens = db
    .prepare(`SELECT ${COLS_AUD} ${FROM_AUD} WHERE ${e.sql} ORDER BY a.id DESC LIMIT 50 OFFSET ?`)
    .all(...e.params, (p - 1) * 50) as Auditoria[];
  return { itens, paginas, total };
}

export function registraAuditoria(
  usuarioId: number | null,
  imobId: number | null,
  imovelId: number | null,
  acao: string,
  detalhes?: unknown,
): void {
  conexao()
    .prepare("INSERT INTO auditoria (usuario_id, imobiliaria_id, imovel_id, acao, detalhes, criado_em) VALUES (?,?,?,?,?,?)")
    .run(usuarioId, imobId, imovelId, acao, detalhes == null ? null : JSON.stringify(detalhes), new Date().toISOString());
}

// ------------------------------------------------------ imobiliária/usuários

export interface ImobiliariaCompleta {
  id: number;
  slug: string;
  nome: string;
  site: string;
  plataforma: string | null;
  status: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  creci: string | null;
  sobre: string | null;
  logo: string | null;
  ultima_coleta: string | null;
  n_imoveis: number;
  n_usuarios: number;
}

export function imobiliariaCompleta(id: number): ImobiliariaCompleta | null {
  return (
    (conexao()
      .prepare(
        `SELECT m.*, (SELECT COUNT(*) FROM imoveis i WHERE i.imobiliaria_id = m.id AND i.status = 'disponivel') AS n_imoveis,
                (SELECT COUNT(*) FROM usuarios u WHERE u.imobiliaria_id = m.id AND u.ativo = 1) AS n_usuarios
           FROM imobiliarias m WHERE m.id = ?`,
      )
      .get(id) as ImobiliariaCompleta | undefined) ?? null
  );
}

export function listaImobiliarias(): ImobiliariaCompleta[] {
  return conexao()
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM imoveis i WHERE i.imobiliaria_id = m.id AND i.status = 'disponivel') AS n_imoveis,
              (SELECT COUNT(*) FROM usuarios u WHERE u.imobiliaria_id = m.id AND u.ativo = 1) AS n_usuarios
         FROM imobiliarias m ORDER BY m.nome`,
    )
    .all() as ImobiliariaCompleta[];
}

export interface UsuarioPainel {
  id: number;
  nome: string;
  email: string;
  papel: string;
  ativo: number;
  imobiliaria_id: number | null;
  imobiliaria: string | null;
  criado_em: string;
  ultimo_acesso: string | null;
}

export function listaUsuarios(imobId: number | null): UsuarioPainel[] {
  const db = conexao();
  const e = imobId == null ? { sql: "1=1", params: [] as number[] } : { sql: "u.imobiliaria_id = ?", params: [imobId] };
  return db
    .prepare(
      `SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.imobiliaria_id, m.nome AS imobiliaria, u.criado_em, u.ultimo_acesso
         FROM usuarios u LEFT JOIN imobiliarias m ON m.id = u.imobiliaria_id WHERE ${e.sql} ORDER BY u.papel, m.nome, u.nome`,
    )
    .all(...e.params) as UsuarioPainel[];
}
