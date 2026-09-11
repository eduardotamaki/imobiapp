"use server";
/**
 * Server Actions do backoffice. Toda ação confere a sessão e, quando mexe num
 * imóvel, que ele pertence à imobiliária do usuário (admin passa).
 */
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { conexao, invalida } from "@/lib/db";
import {
  COOKIE_IMOB,
  abrirSessao,
  agoraIso,
  buscaImobiliaria,
  encerrarSessao,
  escopoAtual,
  existeAlgumUsuario,
  garanteAdminInicial,
  hashSenha,
  registraTentativa,
  sessaoAtual,
  tentativaPermitida,
  verificaSenha,
  type Escopo,
} from "@/lib/auth";
import { registraAuditoria, STATUS_IMOVEL, STATUS_LEAD } from "@/lib/painel";
import { TIPOS } from "@/lib/format";
import { norm } from "@/lib/normalize";

export interface EstadoForm {
  erro?: string;
  erros?: Record<string, string>;
  ok?: string;
}

// ----------------------------------------------------------------- helpers

const txt = (fd: FormData, k: string, max = 500): string | null => {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
};

/** "450.000,00" → 450000; "" → null. */
const num = (fd: FormData, k: string): number | null => {
  const s = txt(fd, k, 40);
  if (!s) return null;
  const limpo = s.replace(/[R$\s]/g, "");
  const n = /,\d{1,2}$/.test(limpo) ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo.replace(/,/g, "."));
  return isFinite(n) && n > 0 ? n : null;
};

const int = (fd: FormData, k: string): number | null => {
  const n = num(fd, k);
  return n == null ? null : Math.round(n);
};

const coord = (fd: FormData, k: string): number | null => {
  const s = txt(fd, k, 30);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return isFinite(n) && n !== 0 ? n : null;
};

const marcado = (fd: FormData, k: string): boolean => {
  const v = fd.get(k);
  return v === "on" || v === "1" || v === "true";
};

async function exige(): Promise<Escopo> {
  const e = await escopoAtual();
  if (!e) redirect("/painel/entrar");
  return e;
}

/** Imobiliária alvo de uma escrita: a do usuário, ou a escolhida pelo admin. */
function imobAlvo(e: Escopo, pedido?: number | null): number {
  if (!e.admin) return e.imobiliaria!.id;
  const id = pedido ?? e.imobiliaria?.id;
  if (!id || !buscaImobiliaria(id)) throw new Error("Escolha uma imobiliária antes de criar anúncios.");
  return id;
}

function donoDoImovel(e: Escopo, imovelId: number): { id: number; imobiliaria_id: number; origem: string } {
  const r = conexao().prepare("SELECT id, imobiliaria_id, origem FROM imoveis WHERE id = ?").get(imovelId) as
    | { id: number; imobiliaria_id: number; origem: string }
    | undefined;
  if (!r) throw new Error("Imóvel não encontrado.");
  if (!e.admin && r.imobiliaria_id !== e.imobiliaria!.id) throw new Error("Este imóvel não é da sua imobiliária.");
  return r;
}

function revalidaTudo(imovelId?: number) {
  invalida();
  revalidatePath("/painel", "layout");
  revalidatePath("/");
  if (imovelId) revalidatePath(`/imovel/${imovelId}`);
}

// ------------------------------------------------------------------ sessão

export async function entrar(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const email = (txt(fd, "email", 200) ?? "").toLowerCase();
  const senha = (fd.get("senha") as string | null) ?? "";
  if (!email || !senha) return { erro: "Informe e-mail e senha." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const chave = `${ip}|${email}`;
  if (!tentativaPermitida(chave)) return { erro: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };
  garanteAdminInicial();
  const u = conexao().prepare("SELECT id, senha_hash, ativo FROM usuarios WHERE email = ?").get(email) as
    | { id: number; senha_hash: string; ativo: number }
    | undefined;
  const ok = !!u && u.ativo === 1 && verificaSenha(senha, u.senha_hash);
  registraTentativa(chave, ok);
  if (!ok || !u) return { erro: "E-mail ou senha incorretos." };
  await abrirSessao(u.id);
  const destino = txt(fd, "destino", 300);
  redirect(destino && destino.startsWith("/painel") ? destino : "/painel");
}

export async function criarPrimeiroAdmin(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  if (existeAlgumUsuario()) return { erro: "Já existe usuário cadastrado. Entre com a sua conta." };
  const nome = txt(fd, "nome", 120);
  const email = (txt(fd, "email", 200) ?? "").toLowerCase();
  const senha = (fd.get("senha") as string | null) ?? "";
  if (!nome || !email.includes("@")) return { erro: "Preencha nome e um e-mail válido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  const db = conexao();
  const r = db
    .prepare("INSERT INTO usuarios (imobiliaria_id, nome, email, senha_hash, papel, ativo, criado_em) VALUES (NULL,?,?,?,'admin',1,?)")
    .run(nome, email, hashSenha(senha), agoraIso());
  registraAuditoria(Number(r.lastInsertRowid), null, null, "usuario.criado", { email, papel: "admin", primeiro: true });
  await abrirSessao(Number(r.lastInsertRowid));
  redirect("/painel");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/painel/entrar");
}

export async function escolherImobiliaria(fd: FormData): Promise<void> {
  const e = await exige();
  if (!e.admin) return;
  const id = Number(fd.get("imobiliaria_id"));
  const jar = await cookies();
  if (Number.isInteger(id) && id > 0 && buscaImobiliaria(id)) {
    jar.set(COOKIE_IMOB, String(id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86_400 * 90 });
  } else {
    jar.delete(COOKIE_IMOB);
  }
  revalidatePath("/painel", "layout");
  const volta = txt(fd, "volta", 300);
  redirect(volta && volta.startsWith("/painel") ? volta : "/painel");
}

// ------------------------------------------------------------------ imóvel

const STATUS_VALIDOS = new Set(Object.keys(STATUS_IMOVEL));
const FINALIDADES = new Set(["venda", "aluguel", "venda_aluguel"]);

function fotosDoForm(fd: FormData): string[] {
  const bruto = fd.get("fotos");
  const linhas = typeof bruto === "string" ? bruto.split(/\r?\n/) : [];
  const out: string[] = [];
  for (const l of linhas) {
    const u = l.trim();
    if (/^https?:\/\/\S+$/i.test(u) && !out.includes(u)) out.push(u.slice(0, 1000));
    if (out.length >= 60) break;
  }
  return out;
}

function caracteristicasDoForm(fd: FormData): string[] {
  const bruto = fd.get("caracteristicas");
  const itens = typeof bruto === "string" ? bruto.split(/[\n,;]/) : [];
  const set = new Set<string>();
  for (const c of itens) {
    const s = c.trim().slice(0, 60);
    if (s) set.add(s);
    if (set.size >= 60) break;
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function salvarImovel(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const e = await exige();
  const idBruto = txt(fd, "id", 20);
  const id = idBruto ? Number(idBruto) : null;
  const erros: Record<string, string> = {};

  const tipo = txt(fd, "tipo", 40);
  if (!tipo || !(tipo in TIPOS)) erros.tipo = "Escolha o tipo.";
  const finalidade = txt(fd, "finalidade", 20);
  if (!finalidade || !FINALIDADES.has(finalidade)) erros.finalidade = "Escolha a finalidade.";
  const preco = num(fd, "preco");
  const precoAluguel = num(fd, "preco_aluguel");
  if (finalidade === "venda" && preco == null) erros.preco = "Informe o preço de venda (ou marque como sob consulta).";
  if (finalidade === "aluguel" && precoAluguel == null) erros.preco_aluguel = "Informe o valor do aluguel.";
  const sobConsulta = marcado(fd, "sob_consulta");
  if (sobConsulta) {
    delete erros.preco;
    delete erros.preco_aluguel;
  }
  const cidade = txt(fd, "cidade", 80);
  if (!cidade) erros.cidade = "Informe a cidade.";
  const status = txt(fd, "status", 20) ?? "disponivel";
  if (!STATUS_VALIDOS.has(status)) erros.status = "Status inválido.";
  const lat = coord(fd, "latitude");
  const lng = coord(fd, "longitude");
  if ((lat == null) !== (lng == null)) erros.latitude = "Latitude e longitude precisam vir juntas.";
  if (lat != null && (lat < -34 || lat > 6)) erros.latitude = "Latitude fora do Brasil.";
  if (lng != null && (lng < -74 || lng > -34)) erros.longitude = "Longitude fora do Brasil.";
  const fotos = fotosDoForm(fd);
  let capa = txt(fd, "foto_capa", 1000);
  if (capa && !fotos.includes(capa)) fotos.unshift(capa);
  if (!capa) capa = fotos[0] ?? null;
  if (Object.keys(erros).length) return { erro: "Confira os campos destacados.", erros };

  const valores = {
    codigo: txt(fd, "codigo", 40),
    finalidade,
    tipo,
    titulo: txt(fd, "titulo", 200),
    descricao: txt(fd, "descricao", 8000),
    preco: sobConsulta && finalidade === "venda" ? null : preco,
    preco_aluguel: sobConsulta && finalidade === "aluguel" ? null : precoAluguel,
    condominio: num(fd, "condominio"),
    iptu: num(fd, "iptu"),
    area_total: num(fd, "area_total"),
    area_util: num(fd, "area_util"),
    quartos: int(fd, "quartos"),
    suites: int(fd, "suites"),
    banheiros: int(fd, "banheiros"),
    vagas: int(fd, "vagas"),
    endereco: txt(fd, "endereco", 200),
    bairro: txt(fd, "bairro", 80),
    cidade,
    cidade_busca: norm(cidade),
    bairro_busca: norm(txt(fd, "bairro", 80)),
    uf: (txt(fd, "uf", 2) ?? "MG").toUpperCase(),
    cep: txt(fd, "cep", 12),
    latitude: lat,
    longitude: lng,
    foto_capa: capa,
    status,
    destaque: marcado(fd, "destaque") ? 1 : 0,
    obs_interna: txt(fd, "obs_interna", 2000),
  };
  const caracteristicas = caracteristicasDoForm(fd);
  const db = conexao();
  const ts = agoraIso();
  let imovelId = id;

  const grava = db.transaction(() => {
    if (imovelId == null) {
      const imobId = imobAlvo(e, Number(fd.get("imobiliaria_id")) || null);
      const slug = (db.prepare("SELECT slug FROM imobiliarias WHERE id = ?").get(imobId) as { slug: string }).slug;
      const url = `imobiapp://${slug}/${randomBytes(6).toString("hex")}`;
      const cols = Object.keys(valores);
      const r = db
        .prepare(
          `INSERT INTO imoveis (imobiliaria_id, url, origem, travado, visto_em, criado_em, atualizado_em, ${cols.join(",")})
           VALUES (?,?,'manual',1,?,?,?,${cols.map(() => "?").join(",")})`,
        )
        .run(imobId, url, ts, ts, ts, ...cols.map((c) => valores[c as keyof typeof valores]));
      imovelId = Number(r.lastInsertRowid);
      if (valores.preco != null || valores.preco_aluguel != null) {
        db.prepare("INSERT INTO historico_preco (imovel_id, data, preco, preco_aluguel) VALUES (?,?,?,?)").run(imovelId, ts, valores.preco, valores.preco_aluguel);
      }
      registraAuditoria(e.usuario.id, imobId, imovelId, "imovel.criado", { tipo, finalidade, preco: valores.preco, preco_aluguel: valores.preco_aluguel });
    } else {
      const dono = donoDoImovel(e, imovelId);
      const antes = db.prepare("SELECT * FROM imoveis WHERE id = ?").get(imovelId) as Record<string, unknown>;
      const travado = dono.origem === "manual" ? 1 : marcado(fd, "travado") ? 1 : 0;
      const cols = Object.keys(valores);
      // Zera o hash da coleta: se o anúncio for liberado depois, a próxima
      // coleta enxerga diferença e traz de volta os dados do site.
      db.prepare(`UPDATE imoveis SET ${cols.map((c) => `${c} = ?`).join(", ")}, travado = ?, atualizado_em = ?, hash_conteudo = NULL WHERE id = ?`).run(
        ...cols.map((c) => valores[c as keyof typeof valores]),
        travado,
        ts,
        imovelId,
      );
      if (antes.preco !== valores.preco || antes.preco_aluguel !== valores.preco_aluguel) {
        if (valores.preco != null || valores.preco_aluguel != null) {
          db.prepare("INSERT INTO historico_preco (imovel_id, data, preco, preco_aluguel) VALUES (?,?,?,?)").run(imovelId, ts, valores.preco, valores.preco_aluguel);
        }
      }
      const mudancas: Record<string, { de: unknown; para: unknown }> = {};
      for (const c of cols) {
        const de = antes[c] ?? null;
        const para = valores[c as keyof typeof valores] ?? null;
        if (de !== para && !(typeof de === "string" && typeof para === "string" && de.trim() === para.trim())) mudancas[c] = { de, para };
      }
      if ((antes.travado ?? 0) !== travado) mudancas.travado = { de: antes.travado, para: travado };
      registraAuditoria(e.usuario.id, dono.imobiliaria_id, imovelId, "imovel.editado", mudancas);
    }
    db.prepare("DELETE FROM fotos WHERE imovel_id = ?").run(imovelId);
    const insFoto = db.prepare("INSERT INTO fotos (imovel_id, ordem, url) VALUES (?,?,?)");
    fotos.forEach((u, i) => insFoto.run(imovelId, i, u));
    db.prepare("DELETE FROM caracteristicas WHERE imovel_id = ?").run(imovelId);
    const insCar = db.prepare("INSERT OR IGNORE INTO caracteristicas (imovel_id, nome) VALUES (?,?)");
    for (const c of caracteristicas) insCar.run(imovelId, c);
  });
  try {
    grava();
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Não foi possível salvar." };
  }
  revalidaTudo(imovelId!);
  if (id == null) redirect(`/painel/imoveis/${imovelId}?salvo=novo`);
  return { ok: "Alterações salvas." };
}

const ACOES_MASSA: Record<string, { status?: string; destaque?: number; travado?: number; rotulo: string }> = {
  pausar: { status: "pausado", rotulo: "pausado" },
  reativar: { status: "disponivel", rotulo: "reativado" },
  vendido: { status: "vendido", rotulo: "marcado como vendido" },
  alugado: { status: "alugado", rotulo: "marcado como alugado" },
  destacar: { destaque: 1, rotulo: "destacado" },
  tirar_destaque: { destaque: 0, rotulo: "sem destaque" },
  travar: { travado: 1, rotulo: "protegido da coleta" },
  destravar: { travado: 0, rotulo: "liberado para a coleta" },
};

export async function acaoEmMassa(fd: FormData): Promise<void> {
  const e = await exige();
  const acao = txt(fd, "acao", 30) ?? "";
  const ids = fd
    .getAll("ids")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 500);
  const volta = txt(fd, "volta", 500) ?? "/painel/imoveis";
  if (!ids.length) redirect(volta);
  if (acao === "excluir") {
    await excluirVarios(e, ids);
    redirect(volta);
  }
  const def = ACOES_MASSA[acao];
  if (!def) redirect(volta);
  const db = conexao();
  const ts = agoraIso();
  const sets: string[] = ["atualizado_em = ?"];
  const params: unknown[] = [ts];
  if (def.status) {
    sets.push("status = ?", "travado = CASE WHEN origem = 'scraper' THEN 1 ELSE travado END");
    params.push(def.status);
  }
  if (def.destaque != null) {
    sets.push("destaque = ?");
    params.push(def.destaque);
  }
  if (def.travado != null) {
    sets.push("travado = ?");
    params.push(def.travado);
    if (def.travado === 0) sets.push("hash_conteudo = NULL"); // a coleta reaplica os dados do site
  }
  db.transaction(() => {
    for (const id of ids) {
      const dono = donoDoImovel(e, id);
      db.prepare(`UPDATE imoveis SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
      registraAuditoria(e.usuario.id, dono.imobiliaria_id, id, `imovel.${acao}`);
    }
  })();
  revalidaTudo();
  redirect(volta);
}

async function excluirVarios(e: Escopo, ids: number[]): Promise<void> {
  const db = conexao();
  db.transaction(() => {
    for (const id of ids) {
      const dono = donoDoImovel(e, id);
      if (dono.origem !== "manual") continue; // anúncio coletado: pause ou marque como vendido
      const r = db.prepare("SELECT codigo, titulo FROM imoveis WHERE id = ?").get(id) as { codigo: string | null; titulo: string | null };
      db.prepare("DELETE FROM imoveis WHERE id = ?").run(id);
      registraAuditoria(e.usuario.id, dono.imobiliaria_id, null, "imovel.excluido", { id, ...r });
    }
  })();
  revalidaTudo();
}

export async function excluirImovel(fd: FormData): Promise<void> {
  const e = await exige();
  const id = Number(fd.get("id"));
  if (Number.isInteger(id) && id > 0) await excluirVarios(e, [id]);
  redirect("/painel/imoveis");
}

// ------------------------------------------------------------------- leads

export async function atualizarLead(fd: FormData): Promise<void> {
  const e = await exige();
  const id = Number(fd.get("id"));
  const status = txt(fd, "status", 20);
  const obs = txt(fd, "obs", 2000);
  const db = conexao();
  const lead = db.prepare("SELECT id, imobiliaria_id FROM leads WHERE id = ?").get(id) as { id: number; imobiliaria_id: number } | undefined;
  if (!lead) return;
  if (!e.admin && lead.imobiliaria_id !== e.imobiliaria!.id) return;
  if (status && status in STATUS_LEAD) {
    db.prepare("UPDATE leads SET status = ?, obs = ?, atualizado_em = ? WHERE id = ?").run(status, obs, agoraIso(), id);
    registraAuditoria(e.usuario.id, lead.imobiliaria_id, null, "lead.atualizado", { lead: id, status });
  }
  revalidatePath("/painel", "layout");
  const volta = txt(fd, "volta", 500);
  if (volta && volta.startsWith("/painel")) redirect(volta);
}

/** Formulário de contato do site público: vira lead da imobiliária dona do anúncio. */
export async function enviarContato(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  if (txt(fd, "site_url", 100)) return { ok: "Mensagem enviada." }; // honeypot
  const imovelId = Number(fd.get("imovel_id"));
  const nome = txt(fd, "nome", 120);
  const telefone = txt(fd, "telefone", 40);
  const email = txt(fd, "email", 200);
  const mensagem = txt(fd, "mensagem", 2000);
  if (!nome) return { erro: "Diga seu nome." };
  if (!telefone && !email) return { erro: "Deixe um telefone ou e-mail para contato." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: "E-mail inválido." };
  const db = conexao();
  const im = db.prepare("SELECT id, imobiliaria_id FROM imoveis WHERE id = ?").get(imovelId) as { id: number; imobiliaria_id: number } | undefined;
  if (!im) return { erro: "Anúncio não encontrado." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const recentes = (
    db.prepare("SELECT COUNT(*) AS n FROM leads WHERE origem = ? AND criado_em > ?").get(`site:${ip}`, new Date(Date.now() - 3_600_000).toISOString()) as { n: number }
  ).n;
  if (recentes >= 10) return { erro: "Muitas mensagens em pouco tempo. Tente mais tarde." };
  const ts = agoraIso();
  db.prepare(
    "INSERT INTO leads (imobiliaria_id, imovel_id, nome, telefone, email, mensagem, origem, status, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,'novo',?,?)",
  ).run(im.imobiliaria_id, im.id, nome, telefone, email, mensagem, `site:${ip}`, ts, ts);
  revalidatePath("/painel", "layout");
  return { ok: "Mensagem enviada. A imobiliária recebe seu contato no painel." };
}

// ------------------------------------------------------------- imobiliária

export async function salvarImobiliaria(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const e = await exige();
  const id = Number(fd.get("id"));
  if (!e.admin && id !== e.imobiliaria!.id) return { erro: "Sem permissão." };
  const nome = txt(fd, "nome", 120);
  if (!nome) return { erro: "O nome é obrigatório.", erros: { nome: "Obrigatório" } };
  const site = txt(fd, "site", 300) ?? "";
  if (site && !/^https?:\/\//i.test(site)) return { erro: "O site precisa começar com http:// ou https://", erros: { site: "URL inválida" } };
  const whatsapp = (txt(fd, "whatsapp", 30) ?? "").replace(/\D/g, "") || null;
  const db = conexao();
  db.prepare(
    `UPDATE imobiliarias SET nome = ?, site = COALESCE(NULLIF(?, ''), site), telefone = ?, whatsapp = ?, email = ?, endereco = ?, creci = ?, sobre = ?, logo = ?
      WHERE id = ?`,
  ).run(nome, site, txt(fd, "telefone", 40), whatsapp, txt(fd, "email", 200), txt(fd, "endereco", 200), txt(fd, "creci", 40), txt(fd, "sobre", 2000), txt(fd, "logo", 1000), id);
  registraAuditoria(e.usuario.id, id, null, "imobiliaria.editada");
  revalidaTudo();
  return { ok: "Dados da imobiliária salvos." };
}

export async function criarImobiliaria(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const e = await exige();
  if (!e.admin) return { erro: "Só o administrador cria imobiliárias." };
  const nome = txt(fd, "nome", 120);
  const site = txt(fd, "site", 300) ?? "";
  if (!nome) return { erro: "Informe o nome." };
  const slug = (norm(nome) ?? "imob").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "imob";
  const db = conexao();
  const existe = db.prepare("SELECT 1 FROM imobiliarias WHERE slug = ?").get(slug);
  if (existe) return { erro: "Já existe uma imobiliária com esse nome." };
  const r = db
    .prepare("INSERT INTO imobiliarias (slug, nome, site, plataforma, status, obs) VALUES (?,?,?,NULL,'sem_scraper','cadastrada no painel')")
    .run(slug, nome, site || "https://");
  registraAuditoria(e.usuario.id, Number(r.lastInsertRowid), null, "imobiliaria.criada", { nome, slug });
  revalidaTudo();
  return { ok: `Imobiliária "${nome}" criada.` };
}

// ---------------------------------------------------------------- usuários

export async function salvarUsuario(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const e = await exige();
  const id = Number(fd.get("id")) || null;
  const nome = txt(fd, "nome", 120);
  const email = (txt(fd, "email", 200) ?? "").toLowerCase();
  const senha = (fd.get("senha") as string | null) ?? "";
  let imobId: number | null = Number(fd.get("imobiliaria_id")) || null;
  let papel = txt(fd, "papel", 20) === "admin" ? "admin" : "imobiliaria";
  if (!e.admin) {
    imobId = e.imobiliaria!.id;
    papel = "imobiliaria";
  }
  if (!nome || !email.includes("@")) return { erro: "Preencha nome e um e-mail válido." };
  if (papel === "imobiliaria" && !imobId) return { erro: "Escolha a imobiliária do usuário." };
  if (papel === "admin") imobId = null;
  if (id == null && senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha && senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  const db = conexao();
  try {
    if (id == null) {
      const r = db
        .prepare("INSERT INTO usuarios (imobiliaria_id, nome, email, senha_hash, papel, ativo, criado_em) VALUES (?,?,?,?,?,1,?)")
        .run(imobId, nome, email, hashSenha(senha), papel, agoraIso());
      registraAuditoria(e.usuario.id, imobId, null, "usuario.criado", { usuario: Number(r.lastInsertRowid), email, papel });
    } else {
      const alvo = db.prepare("SELECT id, imobiliaria_id, papel FROM usuarios WHERE id = ?").get(id) as { id: number; imobiliaria_id: number | null; papel: string } | undefined;
      if (!alvo) return { erro: "Usuário não encontrado." };
      if (!e.admin && alvo.imobiliaria_id !== e.imobiliaria!.id) return { erro: "Sem permissão." };
      db.prepare("UPDATE usuarios SET nome = ?, email = ?, imobiliaria_id = ?, papel = ? WHERE id = ?").run(nome, email, imobId, papel, id);
      if (senha) db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(senha), id);
      registraAuditoria(e.usuario.id, imobId, null, "usuario.editado", { usuario: id, email, papel, senha: !!senha });
    }
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message)) return { erro: "Já existe usuário com esse e-mail." };
    throw err;
  }
  revalidatePath("/painel", "layout");
  return { ok: id == null ? "Usuário criado." : "Usuário atualizado." };
}

export async function redefinirSenha(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const e = await exige();
  const id = Number(fd.get("id"));
  const senha = (fd.get("senha") as string | null) ?? "";
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  const db = conexao();
  const alvo = db.prepare("SELECT id, imobiliaria_id, email FROM usuarios WHERE id = ?").get(id) as { id: number; imobiliaria_id: number | null; email: string } | undefined;
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (!e.admin && alvo.imobiliaria_id !== e.imobiliaria!.id) return { erro: "Sem permissão." };
  db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(senha), id);
  db.prepare("DELETE FROM sessoes WHERE usuario_id = ?").run(id);
  registraAuditoria(e.usuario.id, alvo.imobiliaria_id, null, "usuario.editado", { usuario: id, email: alvo.email, senha: true });
  revalidatePath("/painel", "layout");
  return { ok: `Senha de ${alvo.email} redefinida.` };
}

export async function alternarUsuario(fd: FormData): Promise<void> {
  const e = await exige();
  const id = Number(fd.get("id"));
  const db = conexao();
  const alvo = db.prepare("SELECT id, imobiliaria_id, ativo FROM usuarios WHERE id = ?").get(id) as { id: number; imobiliaria_id: number | null; ativo: number } | undefined;
  if (!alvo || alvo.id === e.usuario.id) return;
  if (!e.admin && alvo.imobiliaria_id !== e.imobiliaria!.id) return;
  db.prepare("UPDATE usuarios SET ativo = ? WHERE id = ?").run(alvo.ativo ? 0 : 1, id);
  if (alvo.ativo) db.prepare("DELETE FROM sessoes WHERE usuario_id = ?").run(id);
  registraAuditoria(e.usuario.id, alvo.imobiliaria_id, null, alvo.ativo ? "usuario.desativado" : "usuario.reativado", { usuario: id });
  revalidatePath("/painel", "layout");
}

export async function alterarSenha(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await sessaoAtual();
  if (!u) redirect("/painel/entrar");
  const atual = (fd.get("atual") as string | null) ?? "";
  const nova = (fd.get("nova") as string | null) ?? "";
  if (nova.length < 8) return { erro: "A nova senha precisa ter pelo menos 8 caracteres." };
  const db = conexao();
  const r = db.prepare("SELECT senha_hash FROM usuarios WHERE id = ?").get(u.id) as { senha_hash: string };
  if (!verificaSenha(atual, r.senha_hash)) return { erro: "Senha atual incorreta." };
  db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(nova), u.id);
  registraAuditoria(u.id, u.imobiliaria_id, null, "usuario.senha_alterada");
  return { ok: "Senha alterada." };
}
