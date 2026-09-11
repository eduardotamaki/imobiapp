/** Normalização compartilhada entre servidor e cliente (sem dependências). */

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Chave de comparação: sem acento, minúscula, espaços colapsados. */
export function norm(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = semAcento(String(s)).toLowerCase().replace(/\s+/g, " ").trim();
  return t || null;
}

/** Converte a consulta livre do usuário numa expressão FTS5 segura. */
export function consultaFts(q: string | null | undefined): string | null {
  if (!q) return null;
  const toks = semAcento(q).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!toks.length) return null;
  const partes = toks.map((t, i) => (i === toks.length - 1 ? `"${t}"*` : `"${t}"`));
  return partes.join(" AND ");
}
