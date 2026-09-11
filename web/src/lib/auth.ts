/**
 * Autenticação do backoffice: senha com scrypt (node:crypto), sessão em
 * cookie httpOnly apontando para a tabela `sessoes`. O formato do hash é o
 * mesmo que `./run.py usuario` gera, então os dois lados se entendem.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { conexao } from "./db";

export const COOKIE_SESSAO = "imobiapp_sessao";
export const COOKIE_IMOB = "imobiapp_painel_imob";
const DIAS_SESSAO = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, tam: 64 };

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: "admin" | "imobiliaria";
  imobiliaria_id: number | null;
}

export interface ImobiliariaResumo {
  id: number;
  slug: string;
  nome: string;
  site: string;
}

/** Quem está logado e sobre qual imobiliária está trabalhando. */
export interface Escopo {
  usuario: Usuario;
  /** Nula só para admin que ainda não escolheu uma imobiliária (vê todas). */
  imobiliaria: ImobiliariaResumo | null;
  admin: boolean;
}

// ------------------------------------------------------------------ senha

export function hashSenha(senha: string): string {
  const sal = randomBytes(16);
  const h = scryptSync(senha, sal, SCRYPT.tam, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sal.toString("hex")}$${h.toString("hex")}`;
}

export function verificaSenha(senha: string, guardado: string): boolean {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, N, r, p, salHex, hashHex] = partes;
  const esperado = Buffer.from(hashHex, "hex");
  try {
    const h = scryptSync(senha, Buffer.from(salHex, "hex"), esperado.length, { N: Number(N), r: Number(r), p: Number(p) });
    return h.length === esperado.length && timingSafeEqual(h, esperado);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------- sessão

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function agoraIso(): string {
  return new Date().toISOString();
}

/** Cria a sessão no banco e grava o cookie. Só pode ser chamada em Server Action ou Route Handler. */
export async function abrirSessao(usuarioId: number): Promise<void> {
  const db = conexao();
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DIAS_SESSAO * 86_400_000);
  db.prepare("INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?,?,?,?)").run(
    hashToken(token),
    usuarioId,
    agoraIso(),
    expira.toISOString(),
  );
  db.prepare("UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?").run(agoraIso(), usuarioId);
  // Limpeza oportunista das sessões vencidas.
  db.prepare("DELETE FROM sessoes WHERE expira_em < ?").run(agoraIso());
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expira,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) conexao().prepare("DELETE FROM sessoes WHERE token_hash = ?").run(hashToken(token));
  jar.delete(COOKIE_SESSAO);
  jar.delete(COOKIE_IMOB);
}

/** Usuário da sessão atual, ou null. Memorizado por requisição. */
export const sessaoAtual = cache(async (): Promise<Usuario | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const linha = conexao()
    .prepare(
      `SELECT u.id, u.nome, u.email, u.papel, u.imobiliaria_id
         FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = ? AND s.expira_em > ? AND u.ativo = 1`,
    )
    .get(hashToken(token), agoraIso()) as Usuario | undefined;
  return linha ?? null;
});

export function buscaImobiliaria(id: number): ImobiliariaResumo | null {
  return (conexao().prepare("SELECT id, slug, nome, site FROM imobiliarias WHERE id = ?").get(id) as ImobiliariaResumo | undefined) ?? null;
}

/**
 * Escopo de trabalho: usuário de imobiliária sempre enxerga a sua; admin
 * enxerga a escolhida no seletor (cookie) ou todas.
 */
export const escopoAtual = cache(async (): Promise<Escopo | null> => {
  const usuario = await sessaoAtual();
  if (!usuario) return null;
  const admin = usuario.papel === "admin";
  let imobiliaria: ImobiliariaResumo | null = null;
  if (!admin) {
    imobiliaria = usuario.imobiliaria_id != null ? buscaImobiliaria(usuario.imobiliaria_id) : null;
    if (!imobiliaria) return null; // usuário órfão: trate como deslogado
  } else {
    const jar = await cookies();
    const v = Number(jar.get(COOKIE_IMOB)?.value);
    if (Number.isInteger(v) && v > 0) imobiliaria = buscaImobiliaria(v);
  }
  return { usuario, imobiliaria, admin };
});

export function existeAlgumUsuario(): boolean {
  garanteAdminInicial();
  return (conexao().prepare("SELECT 1 FROM usuarios LIMIT 1").get() as unknown) != null;
}

/**
 * Sem nenhum usuário e com PAINEL_ADMIN_EMAIL/PAINEL_ADMIN_SENHA definidos,
 * cria o admin sozinho. Serve para hosts sem disco persistente (Render free),
 * onde o banco volta ao snapshot a cada deploy.
 */
let bootstrapFeito = false;
export function garanteAdminInicial(): void {
  if (bootstrapFeito) return;
  bootstrapFeito = true;
  const email = process.env.PAINEL_ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.PAINEL_ADMIN_SENHA;
  if (!email || !senha || senha.length < 8) return;
  const db = conexao();
  if (db.prepare("SELECT 1 FROM usuarios LIMIT 1").get()) return;
  db.prepare("INSERT INTO usuarios (imobiliaria_id, nome, email, senha_hash, papel, ativo, criado_em) VALUES (NULL,?,?,?,'admin',1,?)").run(
    process.env.PAINEL_ADMIN_NOME?.trim() || "Administrador",
    email,
    hashSenha(senha),
    agoraIso(),
  );
}

// ------------------------------------------------------- limite de tentativas

const tentativas = new Map<string, { n: number; ate: number }>();
const MAX_TENTATIVAS = 8;
const JANELA_MS = 15 * 60_000;

export function tentativaPermitida(chave: string): boolean {
  const agora = Date.now();
  const t = tentativas.get(chave);
  if (!t || t.ate < agora) return true;
  return t.n < MAX_TENTATIVAS;
}

export function registraTentativa(chave: string, ok: boolean): void {
  const agora = Date.now();
  if (ok) {
    tentativas.delete(chave);
    return;
  }
  const t = tentativas.get(chave);
  if (!t || t.ate < agora) tentativas.set(chave, { n: 1, ate: agora + JANELA_MS });
  else t.n++;
  if (tentativas.size > 5000) tentativas.clear();
}
