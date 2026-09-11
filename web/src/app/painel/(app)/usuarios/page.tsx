import type { Metadata } from "next";
import FormSimples from "@/components/painel/FormSimples";
import { Campo, Titulo, Vazio, cls } from "@/components/painel/ui";
import { escopoAtual } from "@/lib/auth";
import { fmtDataHora } from "@/lib/format";
import { listaImobiliarias, listaUsuarios } from "@/lib/painel";
import { alterarSenha, alternarUsuario, redefinirSenha, salvarUsuario } from "../../acoes";

export const metadata: Metadata = { title: "Usuários" };

export default async function Usuarios() {
  const e = (await escopoAtual())!;
  const imobId = e.imobiliaria?.id ?? null;
  const usuarios = listaUsuarios(imobId);
  const imobs = e.admin ? listaImobiliarias() : [];

  return (
    <>
      <Titulo sub={e.imobiliaria ? `Quem acessa o painel de ${e.imobiliaria.nome}.` : "Todos os usuários do painel."}>Usuários</Titulo>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {usuarios.length ? (
            <div className={`${cls.cartao} overflow-x-auto`}>
              <table className="w-full min-w-[600px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Nome</th>
                    <th className="px-2 py-2 font-medium">Papel</th>
                    {!e.imobiliaria && <th className="px-2 py-2 font-medium">Imobiliária</th>}
                    <th className="px-2 py-2 font-medium">Último acesso</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className={`border-t border-line ${u.ativo ? "" : "opacity-60"}`}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{u.nome}{u.id === e.usuario.id && <span className="ml-1 text-xs text-muted">(você)</span>}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </td>
                      <td className="px-2 py-2">{u.papel === "admin" ? "Administrador" : "Imobiliária"}</td>
                      {!e.imobiliaria && <td className="px-2 py-2 text-muted">{u.imobiliaria ?? "—"}</td>}
                      <td className="px-2 py-2 text-xs text-muted">{u.ativo ? fmtDataHora(u.ultimo_acesso) : "desativado"}</td>
                      <td className="px-2 py-2 text-right">
                        {u.id !== e.usuario.id && (
                          <form action={alternarUsuario} className="inline">
                            <input type="hidden" name="id" value={u.id} />
                            <button type="submit" className="text-xs text-accent hover:underline">{u.ativo ? "desativar" : "reativar"}</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vazio>Nenhum usuário {e.imobiliaria ? "nesta imobiliária" : ""}.</Vazio>
          )}

          <section className={`${cls.cartao} p-4`}>
            <h2 className="font-semibold">Redefinir senha de alguém</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">A pessoa é desconectada de todos os dispositivos e entra com a senha nova.</p>
            <FormSimples acao={redefinirSenha} rotuloBotao="Redefinir" limparAoSalvar>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Usuário">
                  <select name="id" className={cls.select} required>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome} · {u.email}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Nova senha"><input name="senha" type="password" className={cls.input} minLength={8} required autoComplete="new-password" /></Campo>
              </div>
            </FormSimples>
          </section>
        </div>

        <div className="space-y-4">
          <section className={`${cls.cartao} p-4`}>
            <h2 className="font-semibold">Novo usuário</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">{e.admin ? "Admin enxerga tudo; usuário de imobiliária só o que é dela." : "Entra com acesso aos anúncios e leads da sua imobiliária."}</p>
            <FormSimples acao={salvarUsuario} rotuloBotao="Criar usuário" limparAoSalvar>
              <Campo rotulo="Nome"><input name="nome" required className={cls.input} maxLength={120} /></Campo>
              <Campo rotulo="E-mail"><input name="email" type="email" required className={cls.input} maxLength={200} /></Campo>
              <Campo rotulo="Senha inicial" dica="Pelo menos 8 caracteres."><input name="senha" type="password" required minLength={8} className={cls.input} autoComplete="new-password" /></Campo>
              {e.admin && (
                <>
                  <Campo rotulo="Papel">
                    <select name="papel" defaultValue="imobiliaria" className={cls.select}>
                      <option value="imobiliaria">Imobiliária</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </Campo>
                  <Campo rotulo="Imobiliária">
                    <select name="imobiliaria_id" defaultValue={imobId ?? ""} className={cls.select}>
                      <option value="">— (só para admin)</option>
                      {imobs.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </Campo>
                </>
              )}
            </FormSimples>
          </section>

          <section className={`${cls.cartao} p-4`}>
            <h2 className="font-semibold">Minha senha</h2>
            <FormSimples acao={alterarSenha} rotuloBotao="Alterar senha" limparAoSalvar className="mt-3">
              <Campo rotulo="Senha atual"><input name="atual" type="password" required className={cls.input} autoComplete="current-password" /></Campo>
              <Campo rotulo="Nova senha"><input name="nova" type="password" required minLength={8} className={cls.input} autoComplete="new-password" /></Campo>
            </FormSimples>
          </section>
        </div>
      </div>
    </>
  );
}
