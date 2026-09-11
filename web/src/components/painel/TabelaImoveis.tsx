"use client";
import Link from "next/link";
import { useState } from "react";
import Foto from "@/components/Foto";
import { fmtData, fmtPct, fmtPreco, rotuloTipo, tituloCurto } from "@/lib/format";
import type { ImovelPainel } from "@/lib/painel";
import { BadgeStatus, cls } from "./ui";

interface Props {
  itens: ImovelPainel[];
  volta: string;
  acao: (fd: FormData) => Promise<void>;
  mostraImobiliaria: boolean;
}

const ACOES: { v: string; r: string; confirma?: string }[] = [
  { v: "pausar", r: "Pausar (tirar do ar)" },
  { v: "reativar", r: "Reativar (voltar ao ar)" },
  { v: "vendido", r: "Marcar como vendido" },
  { v: "alugado", r: "Marcar como alugado" },
  { v: "destacar", r: "Destacar na busca" },
  { v: "tirar_destaque", r: "Tirar destaque" },
  { v: "travar", r: "Proteger da coleta automática" },
  { v: "destravar", r: "Liberar para a coleta automática" },
  { v: "excluir", r: "Excluir (só cadastrados aqui)", confirma: "Excluir definitivamente os anúncios cadastrados no painel que estão selecionados? Anúncios coletados do site não são excluídos." },
];

export default function TabelaImoveis({ itens, volta, acao, mostraImobiliaria }: Props) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [acaoSel, setAcaoSel] = useState("pausar");
  const todos = itens.length > 0 && itens.every((i) => sel.has(i.id));
  const alternar = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarTodos = () => setSel(todos ? new Set() : new Set(itens.map((i) => i.id)));
  const def = ACOES.find((a) => a.v === acaoSel);

  return (
    <form
      action={acao}
      onSubmit={(ev) => {
        if (def?.confirma && !confirm(def.confirma)) ev.preventDefault();
      }}
    >
      <input type="hidden" name="volta" value={volta} />
      {[...sel].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <div className={`sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm transition lg:top-2 ${sel.size ? "border-accent/50 bg-accent-soft" : "border-line bg-card"}`}>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={todos} onChange={alternarTodos} aria-label="Selecionar todos" className="h-4 w-4 accent-[var(--accent)]" />
          <span className="text-muted">{sel.size ? `${sel.size} selecionado${sel.size > 1 ? "s" : ""}` : "Selecione para agir em lote"}</span>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <select name="acao" value={acaoSel} onChange={(ev) => setAcaoSel(ev.target.value)} className={`${cls.select} w-auto py-1.5`} disabled={!sel.size} aria-label="Ação em lote">
            {ACOES.map((a) => (
              <option key={a.v} value={a.v}>{a.r}</option>
            ))}
          </select>
          <button type="submit" disabled={!sel.size} className={`${cls.botao} ${acaoSel === "excluir" ? cls.perigo : cls.primario} py-1.5`}>
            Aplicar
          </button>
        </div>
      </div>

      <div className={`${cls.cartao} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-2 py-2 font-medium">Imóvel</th>
              {mostraImobiliaria && <th className="px-2 py-2 font-medium">Imobiliária</th>}
              <th className="px-2 py-2 text-right font-medium">Preço</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Leads</th>
              <th className="px-2 py-2 font-medium">Alterado</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const pend: string[] = [];
              if (!i.capa) pend.push("sem foto");
              if (i.preco == null && i.preco_aluguel == null) pend.push("sem preço");
              if (i.lat == null) pend.push("sem mapa");
              if (!i.descricao_ok) pend.push("descrição curta");
              const marcado = sel.has(i.id);
              return (
                <tr key={i.id} className={`border-t border-line ${marcado ? "bg-accent-soft/40" : "hover:bg-soft/60"}`}>
                  <td className="px-3 py-2 align-top">
                    <input type="checkbox" checked={marcado} onChange={() => alternar(i.id)} aria-label={`Selecionar ${i.codigo ?? i.id}`} className="mt-3 h-4 w-4 accent-[var(--accent)]" />
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`/painel/imoveis/${i.id}`} className="flex gap-3">
                      <Foto src={i.capa} alt="" className="h-14 w-20 flex-none rounded-md object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tituloCurto(i)}</span>
                        <span className="block truncate text-xs text-muted">
                          {i.codigo ? `ref. ${i.codigo} · ` : ""}{i.titulo ?? rotuloTipo(i.tipo)}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                          {i.destaque ? <span className="rounded bg-accent px-1 font-semibold text-accent-fg">destaque</span> : null}
                          {i.origem === "manual" ? <span className="rounded bg-soft px-1 text-muted">cadastrado aqui</span> : i.travado ? <span className="rounded bg-soft px-1 text-muted">protegido</span> : null}
                          {pend.map((p) => (
                            <span key={p} className="rounded bg-alerta-soft px-1 text-alerta">{p}</span>
                          ))}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {mostraImobiliaria && <td className="px-2 py-2 text-xs text-muted">{i.imobiliaria}</td>}
                  <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                    <div className="font-medium">{i.preco != null ? fmtPreco(i.preco) : i.preco_aluguel != null ? `${fmtPreco(i.preco_aluguel)}/mês` : <span className="text-muted">sob consulta</span>}</div>
                    {i.preco != null && i.preco_aluguel != null && <div className="text-xs text-muted">ou {fmtPreco(i.preco_aluguel)}/mês</div>}
                    {i.variacao != null && <div className={`text-xs ${i.variacao < 0 ? "text-queda" : "text-alerta"}`}>{fmtPct(i.variacao)}</div>}
                  </td>
                  <td className="px-2 py-2 align-top"><BadgeStatus status={i.status} /></td>
                  <td className="px-2 py-2 text-right align-top">{i.leads ? <span className="font-semibold">{i.leads}</span> : <span className="text-muted">0</span>}</td>
                  <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-muted">{fmtData(i.atualizado_em)}</td>
                  <td className="px-2 py-2 text-right align-top">
                    <Link href={`/painel/imoveis/${i.id}`} className="text-xs text-accent hover:underline">editar</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
