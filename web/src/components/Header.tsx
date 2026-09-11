"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFavoritos } from "@/lib/favoritos";
import ThemeToggle from "./ThemeToggle";
import { Casa, Coracao, Lupa, Tendencia } from "./Icones";

const LINKS = [
  { href: "/", rotulo: "Buscar", Icone: Lupa },
  { href: "/panorama", rotulo: "Panorama", Icone: Tendencia },
  { href: "/favoritos", rotulo: "Favoritos", Icone: Coracao },
];

export default function Header() {
  const caminho = usePathname();
  const { ids } = useFavoritos();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
            <Casa width={18} height={18} />
          </span>
          <span className="hidden sm:inline">imobiapp</span>
          <span className="hidden text-xs font-normal text-muted md:inline">· Itajubá e região</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {LINKS.map(({ href, rotulo, Icone }) => {
            const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                  ativo ? "bg-soft font-medium" : "text-muted hover:bg-soft hover:text-fg"
                }`}
              >
                {href === "/favoritos" ? <Coracao cheio={ids.length > 0} /> : <Icone />}
                <span className="hidden sm:inline">{rotulo}</span>
                {href === "/favoritos" && ids.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{ids.length}</span>
                )}
              </Link>
            );
          })}
          <span className="ml-1">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
