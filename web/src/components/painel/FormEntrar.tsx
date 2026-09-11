"use client";
import { useActionState } from "react";
import type { EstadoForm } from "@/app/painel/acoes";
import { Aviso, Campo, cls } from "./ui";

interface Props {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  destino?: string;
  primeiroAcesso: boolean;
}

export default function FormEntrar({ acao, destino, primeiroAcesso }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {} as EstadoForm);
  return (
    <form action={enviar} className="space-y-4">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {destino && <input type="hidden" name="destino" value={destino} />}
      {primeiroAcesso && (
        <Campo rotulo="Seu nome">
          <input name="nome" required autoComplete="name" className={cls.input} />
        </Campo>
      )}
      <Campo rotulo="E-mail">
        <input name="email" type="email" required autoComplete="email" autoFocus className={cls.input} />
      </Campo>
      <Campo rotulo="Senha" dica={primeiroAcesso ? "Pelo menos 8 caracteres." : undefined}>
        <input name="senha" type="password" required minLength={primeiroAcesso ? 8 : 1} autoComplete={primeiroAcesso ? "new-password" : "current-password"} className={cls.input} />
      </Campo>
      <button type="submit" disabled={pendente} className={`${cls.botao} ${cls.primario} w-full py-2.5`}>
        {pendente ? "Entrando…" : primeiroAcesso ? "Criar conta de administrador" : "Entrar"}
      </button>
    </form>
  );
}
