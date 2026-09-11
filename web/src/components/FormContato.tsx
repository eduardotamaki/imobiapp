"use client";
import { useActionState } from "react";
import type { EstadoForm } from "@/app/painel/acoes";

interface Props {
  imovelId: number;
  imobiliaria: string;
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
}

const input =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25";

/** Contato direto com a imobiliária: vira lead no painel dela. */
export default function FormContato({ imovelId, imobiliaria, acao }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {} as EstadoForm);
  if (estado.ok) {
    return (
      <div role="status" className="rounded-lg border border-queda/30 bg-queda-soft px-3 py-2 text-sm text-queda">
        {estado.ok}
      </div>
    );
  }
  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <input type="text" name="site_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {estado.erro && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {estado.erro}
        </div>
      )}
      <input name="nome" required placeholder="Seu nome" autoComplete="name" className={input} maxLength={120} />
      <div className="grid grid-cols-2 gap-2">
        <input name="telefone" placeholder="WhatsApp / telefone" autoComplete="tel" inputMode="tel" className={input} maxLength={40} />
        <input name="email" type="email" placeholder="E-mail" autoComplete="email" className={input} maxLength={200} />
      </div>
      <textarea
        name="mensagem"
        rows={3}
        defaultValue="Olá! Tenho interesse neste imóvel e gostaria de mais informações."
        className={input}
        maxLength={2000}
      />
      <button type="submit" disabled={pendente} className="w-full rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent-soft disabled:opacity-50">
        {pendente ? "Enviando…" : `Falar com a ${imobiliaria}`}
      </button>
      <p className="text-[11px] text-muted">Seus dados vão só para a imobiliária responsável pelo anúncio.</p>
    </form>
  );
}
