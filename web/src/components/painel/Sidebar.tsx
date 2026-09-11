"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Casa, Externo, Grade, Lista, Lupa, Tendencia } from "@/components/Icones";

export interface ItemNav {
  href: string;
  rotulo: string;
  icone: "inicio" | "imoveis" | "leads" | "imobiliaria" | "usuarios" | "atividade";
  badge?: number;
}

const ICONES = {
  inicio: Tendencia,
  imoveis: Grade,
  leads: Lupa,
  imobiliaria: Casa,
  usuarios: Lista,
  atividade: Lista,
};

interface Props {
  itens: ItemNav[];
  usuario: { nome: string; email: string };
  contexto: string;
  seletor?: React.ReactNode;
  sair: React.ReactNode;
}

export default function Sidebar({ itens, usuario, contexto, seletor, sair }: Props) {
  const caminho = usePathname();
  const ativo = (href: string) => (href === "/painel" ? caminho === "/painel" : caminho.startsWith(href));
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-line bg-card lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
            <Casa width={18} height={18} />
          </span>
          <div className="min-w-0">
            <div className="font-semibold leading-tight">imobiapp</div>
            <div className="truncate text-[11px] text-muted">painel da imobiliária</div>
          </div>
        </div>
        {seletor && <div className="px-3 pb-3">{seletor}</div>}
        <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted">{contexto}</div>
        <nav className="flex-1 space-y-0.5 px-2">
          {itens.map((it) => {
            const Icone = ICONES[it.icone];
            const on = ativo(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${on ? "bg-soft font-medium" : "text-muted hover:bg-soft hover:text-fg"}`}
              >
                <Icone width={16} height={16} />
                <span className="flex-1">{it.rotulo}</span>
                {it.badge ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{it.badge}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3 text-sm">
          <div className="truncate font-medium">{usuario.nome}</div>
          <div className="truncate text-xs text-muted">{usuario.email}</div>
          <div className="mt-2 flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
              Ver site <Externo width={12} height={12} />
            </Link>
            <span className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              {sair}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg">
            <Casa width={16} height={16} />
          </span>
          <span className="truncate text-sm font-semibold">{contexto}</span>
          <span className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {sair}
          </span>
        </div>
        {seletor && <div className="px-3 pb-2">{seletor}</div>}
        <nav className="rolagem flex gap-1 overflow-x-auto px-2 pb-2">
          {itens.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-none items-center gap-1 rounded-full px-3 py-1.5 text-sm ${ativo(it.href) ? "bg-soft font-medium" : "text-muted"}`}
            >
              {it.rotulo}
              {it.badge ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{it.badge}</span> : null}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
