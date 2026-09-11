"use client";
import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/painel/acoes";
import { Aviso, cls } from "./ui";

interface Props {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  rotuloBotao: string;
  children: React.ReactNode;
  className?: string;
  limparAoSalvar?: boolean;
}

/** Formulário genérico com estado da ação (erro/ok) e botão de envio. */
export default function FormSimples({ acao, rotuloBotao, children, className = "", limparAoSalvar }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {} as EstadoForm);
  // Trocar a `key` remonta o formulário e limpa os campos depois de salvar
  // (estado derivado durante o render, como o React recomenda).
  const [geracao, setGeracao] = useState(0);
  const [ultimo, setUltimo] = useState(estado);
  if (estado !== ultimo) {
    setUltimo(estado);
    if (limparAoSalvar && estado.ok) setGeracao(geracao + 1);
  }
  return (
    <form action={enviar} className={`space-y-3 ${className}`} key={geracao}>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      {children}
      <button type="submit" disabled={pendente} className={`${cls.botao} ${cls.primario}`}>{pendente ? "Salvando…" : rotuloBotao}</button>
    </form>
  );
}
