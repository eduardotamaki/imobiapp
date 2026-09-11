"use client";
import Link from "next/link";
import { useState } from "react";
import Foto from "@/components/Foto";
import { fmtDataHora, fmtPreco, rotuloTipo } from "@/lib/format";
import type { LeadPainel } from "@/lib/painel";
import { STATUS_LEAD } from "@/lib/painel-rotulos";
import { BadgeLead, cls } from "./ui";

interface Props {
  lead: LeadPainel;
  acao: (fd: FormData) => Promise<void>;
  volta: string;
  mostraImobiliaria: boolean;
}

function linkWhatsapp(tel: string | null, texto: string): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export default function LeadItem({ lead: l, acao, volta, mostraImobiliaria }: Props) {
  const [aberto, setAberto] = useState(l.status === "novo");
  const imovel = l.imovel_id ? `${rotuloTipo(l.imovel_tipo)}${l.imovel_bairro ? ` no ${l.imovel_bairro}` : ""}${l.imovel_codigo ? ` (ref. ${l.imovel_codigo})` : ""}` : null;
  const wa = linkWhatsapp(l.telefone, `Olá, ${l.nome.split(" ")[0]}! Vi seu interesse${imovel ? ` no ${imovel.toLowerCase()}` : ""} e estou à disposição.`);
  return (
    <li className={`${cls.cartao} ${l.status === "novo" ? "border-accent/50" : ""}`}>
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
        <BadgeLead status={l.status} />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{l.nome}</span>
          <span className="block truncate text-xs text-muted">
            {[l.telefone, l.email].filter(Boolean).join(" · ") || "sem contato informado"}
            {imovel && ` · ${imovel}`}
            {mostraImobiliaria && ` · ${l.imobiliaria}`}
          </span>
        </span>
        <span className="text-xs text-muted">{fmtDataHora(l.criado_em)}</span>
      </button>
      {aberto && (
        <div className="grid gap-4 border-t border-line px-4 py-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 text-sm">
            {l.mensagem ? <p className="descricao rounded-lg bg-soft px-3 py-2">{l.mensagem}</p> : <p className="text-muted">Sem mensagem.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${cls.botao} ${cls.primario} py-1.5`}>WhatsApp</a>
              )}
              {l.telefone && <a href={`tel:${l.telefone.replace(/\D/g, "")}`} className={`${cls.botao} ${cls.secundario} py-1.5`}>Ligar</a>}
              {l.email && <a href={`mailto:${l.email}`} className={`${cls.botao} ${cls.secundario} py-1.5`}>E-mail</a>}
            </div>
            {l.imovel_id && (
              <Link href={`/painel/imoveis/${l.imovel_id}`} className="mt-3 flex items-center gap-3 rounded-lg border border-line p-2 hover:bg-soft">
                <Foto src={l.imovel_capa} alt="" className="h-12 w-16 flex-none rounded object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{imovel}</span>
                  <span className="block text-xs text-muted">{fmtPreco(l.imovel_preco)} · abrir anúncio no painel</span>
                </span>
              </Link>
            )}
          </div>
          <form action={acao} className="space-y-2 text-sm">
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="volta" value={volta} />
            <label className="block">
              <span className={cls.rotulo}>Situação</span>
              <select name="status" defaultValue={l.status} className={cls.select}>
                {Object.entries(STATUS_LEAD).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={cls.rotulo}>Anotações</span>
              <textarea name="obs" defaultValue={l.obs ?? ""} rows={3} className={cls.input} placeholder="Ligou, agendou visita, não atende…" />
            </label>
            <button type="submit" className={`${cls.botao} ${cls.secundario} w-full`}>Salvar</button>
          </form>
        </div>
      )}
    </li>
  );
}
