/** Peças pequenas e sem estado do painel (servem em Server e Client Components). */
import Link from "next/link";
import { STATUS_IMOVEL, STATUS_LEAD } from "@/lib/painel-rotulos";

export const cls = {
  input:
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60",
  select:
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25",
  botao: "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50",
  primario: "bg-accent text-accent-fg hover:opacity-90",
  secundario: "border border-line bg-card hover:bg-soft",
  perigo: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40",
  cartao: "rounded-xl border border-line bg-card",
  rotulo: "mb-1 block text-xs font-medium uppercase tracking-wide text-muted",
};

export function Campo({
  rotulo,
  children,
  erro,
  dica,
  className = "",
}: {
  rotulo: string;
  children: React.ReactNode;
  erro?: string;
  dica?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={cls.rotulo}>{rotulo}</span>
      {children}
      {erro ? <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{erro}</span> : dica ? <span className="mt-1 block text-xs text-muted">{dica}</span> : null}
    </label>
  );
}

export function Kpi({ rotulo, valor, sub, href, tom }: { rotulo: string; valor: string | number; sub?: string; href?: string; tom?: "alerta" | "ok" | "neutro" }) {
  const cor = tom === "alerta" ? "text-alerta" : tom === "ok" ? "text-queda" : "";
  const corpo = (
    <div className={`${cls.cartao} h-full p-4 ${href ? "transition hover:border-accent/60" : ""}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${cor}`}>{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{corpo}</Link> : corpo;
}

const COR_STATUS: Record<string, string> = {
  disponivel: "bg-queda-soft text-queda",
  pausado: "bg-alerta-soft text-alerta",
  vendido: "bg-accent-soft text-accent",
  alugado: "bg-accent-soft text-accent",
  removido: "bg-soft text-muted",
};

export function BadgeStatus({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${COR_STATUS[status] ?? "bg-soft text-muted"}`}>
      {STATUS_IMOVEL[status] ?? status}
    </span>
  );
}

const COR_LEAD: Record<string, string> = {
  novo: "bg-accent text-accent-fg",
  em_contato: "bg-alerta-soft text-alerta",
  fechado: "bg-queda-soft text-queda",
  descartado: "bg-soft text-muted",
};

export function BadgeLead({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${COR_LEAD[status] ?? "bg-soft text-muted"}`}>
      {STATUS_LEAD[status] ?? status}
    </span>
  );
}

export function Aviso({ tipo, children }: { tipo: "ok" | "erro" | "info"; children: React.ReactNode }) {
  const c =
    tipo === "ok"
      ? "border-queda/30 bg-queda-soft text-queda"
      : tipo === "erro"
        ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        : "border-line bg-soft text-fg";
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${c}`}>
      {children}
    </div>
  );
}

export function Titulo({ children, sub, acao }: { children: React.ReactNode; sub?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
    </div>
  );
}

/** Paginação por links (Server Component), preservando a query atual. */
export function PaginacaoLinks({ pagina, paginas, base }: { pagina: number; paginas: number; base: URLSearchParams }) {
  if (paginas <= 1) return null;
  const link = (p: number) => {
    const q = new URLSearchParams(base);
    if (p > 1) q.set("pagina", String(p));
    else q.delete("pagina");
    const s = q.toString();
    return s ? `?${s}` : "?";
  };
  const b = "min-w-9 rounded-lg border border-line px-2.5 py-1.5 text-center text-sm transition hover:bg-soft";
  const desab = "pointer-events-none opacity-40";
  return (
    <nav className="mt-4 flex items-center justify-center gap-1" aria-label="Paginação">
      <Link href={link(pagina - 1)} className={`${b} ${pagina <= 1 ? desab : ""}`}>Anterior</Link>
      <span className="px-2 text-sm text-muted">
        {pagina} / {paginas}
      </span>
      <Link href={link(pagina + 1)} className={`${b} ${pagina >= paginas ? desab : ""}`}>Próxima</Link>
    </nav>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className={`${cls.cartao} px-4 py-10 text-center text-sm text-muted`}>{children}</div>;
}
