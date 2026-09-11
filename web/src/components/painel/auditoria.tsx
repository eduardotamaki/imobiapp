import { fmtPreco, TIPOS } from "@/lib/format";
import type { Auditoria } from "@/lib/painel";
import { STATUS_IMOVEL, STATUS_LEAD } from "@/lib/painel-rotulos";

const ROTULO_ACAO: Record<string, string> = {
  "imovel.criado": "cadastrou o imóvel",
  "imovel.editado": "editou o imóvel",
  "imovel.excluido": "excluiu o imóvel",
  "imovel.pausar": "pausou o anúncio",
  "imovel.reativar": "reativou o anúncio",
  "imovel.vendido": "marcou como vendido",
  "imovel.alugado": "marcou como alugado",
  "imovel.destacar": "destacou o anúncio",
  "imovel.tirar_destaque": "tirou o destaque",
  "imovel.travar": "protegeu da coleta",
  "imovel.destravar": "liberou para a coleta",
  "lead.atualizado": "atualizou um lead",
  "imobiliaria.editada": "editou os dados da imobiliária",
  "imobiliaria.criada": "criou a imobiliária",
  "usuario.criado": "criou um usuário",
  "usuario.editado": "editou um usuário",
  "usuario.desativado": "desativou um usuário",
  "usuario.reativado": "reativou um usuário",
  "usuario.senha_alterada": "alterou a própria senha",
};

const ROTULO_CAMPO: Record<string, string> = {
  preco: "preço", preco_aluguel: "aluguel", condominio: "condomínio", iptu: "IPTU", area_util: "área útil", area_total: "área total",
  quartos: "quartos", suites: "suítes", banheiros: "banheiros", vagas: "vagas", endereco: "endereço", bairro: "bairro", cidade: "cidade",
  uf: "UF", cep: "CEP", latitude: "latitude", longitude: "longitude", foto_capa: "capa", status: "status", destaque: "destaque",
  obs_interna: "observações", titulo: "título", descricao: "descrição", tipo: "tipo", finalidade: "finalidade", codigo: "código", travado: "proteção",
};

function valor(campo: string, v: unknown): string {
  if (v == null || v === "") return "vazio";
  if (campo === "preco" || campo === "preco_aluguel" || campo === "condominio" || campo === "iptu") return fmtPreco(Number(v));
  if (campo === "status") return STATUS_IMOVEL[String(v)] ?? String(v);
  if (campo === "tipo") return TIPOS[String(v)] ?? String(v);
  if (campo === "destaque" || campo === "travado") return v ? "sim" : "não";
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

export function rotuloAcao(acao: string): string {
  return ROTULO_ACAO[acao] ?? acao;
}

/** Texto curto e legível para uma linha da auditoria. */
export function descreveAuditoria(a: Auditoria): string {
  const base = rotuloAcao(a.acao);
  let det: Record<string, unknown> | null = null;
  try {
    det = a.detalhes ? (JSON.parse(a.detalhes) as Record<string, unknown>) : null;
  } catch {
    det = null;
  }
  if (!det) return base;
  if (a.acao === "imovel.editado") {
    const partes = Object.entries(det)
      .filter(([k]) => !["cidade_busca", "bairro_busca"].includes(k))
      .map(([k, v]) => {
        const m = v as { de: unknown; para: unknown };
        return `${ROTULO_CAMPO[k] ?? k}: ${valor(k, m.de)} → ${valor(k, m.para)}`;
      });
    return partes.length ? `${base}: ${partes.join("; ")}` : `${base} (sem mudanças nos campos)`;
  }
  if (a.acao === "lead.atualizado") return `${base} para "${STATUS_LEAD[String(det.status)] ?? det.status}"`;
  if (a.acao.startsWith("usuario.") && det.email) return `${base} (${det.email})`;
  if (a.acao === "imovel.excluido") return `${base} ${det.codigo ? `ref. ${det.codigo}` : `#${det.id}`}`;
  return base;
}
