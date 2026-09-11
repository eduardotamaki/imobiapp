"use client";
import { useActionState } from "react";
import type { EstadoForm } from "@/app/painel/acoes";
import type { ImobiliariaCompleta } from "@/lib/painel";
import { Aviso, Campo, cls } from "./ui";

interface Props {
  imob: ImobiliariaCompleta;
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
}

export default function FormImobiliaria({ imob, acao }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {} as EstadoForm);
  const e = estado.erros ?? {};
  return (
    <form action={enviar} className={`${cls.cartao} space-y-4 p-4 sm:p-5`}>
      <input type="hidden" name="id" value={imob.id} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" erro={e.nome}><input name="nome" defaultValue={imob.nome} required className={cls.input} maxLength={120} /></Campo>
        <Campo rotulo="Site" erro={e.site}><input name="site" defaultValue={imob.site.startsWith("http") ? imob.site : ""} className={cls.input} placeholder="https://" maxLength={300} /></Campo>
        <Campo rotulo="WhatsApp" dica="Com DDD. Vira o botão de contato nos seus anúncios."><input name="whatsapp" defaultValue={imob.whatsapp ?? ""} className={cls.input} placeholder="35 99999-9999" maxLength={30} /></Campo>
        <Campo rotulo="Telefone"><input name="telefone" defaultValue={imob.telefone ?? ""} className={cls.input} maxLength={40} /></Campo>
        <Campo rotulo="E-mail"><input name="email" type="email" defaultValue={imob.email ?? ""} className={cls.input} maxLength={200} /></Campo>
        <Campo rotulo="CRECI"><input name="creci" defaultValue={imob.creci ?? ""} className={cls.input} maxLength={40} /></Campo>
        <Campo rotulo="Endereço" className="sm:col-span-2"><input name="endereco" defaultValue={imob.endereco ?? ""} className={cls.input} maxLength={200} /></Campo>
        <Campo rotulo="Logo (link da imagem)" className="sm:col-span-2"><input name="logo" defaultValue={imob.logo ?? ""} className={cls.input} placeholder="https://…/logo.png" maxLength={1000} /></Campo>
        <Campo rotulo="Sobre a imobiliária" className="sm:col-span-2"><textarea name="sobre" defaultValue={imob.sobre ?? ""} rows={4} className={cls.input} maxLength={2000} /></Campo>
      </div>
      <button type="submit" disabled={pendente} className={`${cls.botao} ${cls.primario}`}>{pendente ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}
