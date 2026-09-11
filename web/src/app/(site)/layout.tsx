import Link from "next/link";
import Header from "@/components/Header";

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        <p>
          Dados coletados dos sites das imobiliárias de Itajubá e região. Preços e disponibilidade podem ter mudado desde a
          última coleta; confirme no anúncio original.
        </p>
        <p className="mt-2">
          <Link href="/painel" className="underline-offset-2 hover:text-fg hover:underline">
            Área da imobiliária
          </Link>
        </p>
      </footer>
    </>
  );
}
