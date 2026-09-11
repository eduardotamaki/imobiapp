import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "imobiapp · imóveis em Itajubá", template: "%s · imobiapp" },
  description:
    "Busca unificada nos anúncios das imobiliárias de Itajubá/MG: compare preço, m² e bairro, e veja quem baixou de preço.",
};

const TEMA_SCRIPT = `(function(){try{var t=localStorage.getItem('imobiapp:tema');var d=t?t==='escuro':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
          Dados coletados dos sites das imobiliárias de Itajubá e região. Preços e disponibilidade podem ter mudado
          desde a última coleta; confirme no anúncio original.
        </footer>
      </body>
    </html>
  );
}
