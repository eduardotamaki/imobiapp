"use client";
import { useEffect, useState } from "react";

export default function Compartilhar({ titulo, texto }: { titulo: string; texto: string }) {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 1800);
    return () => clearTimeout(t);
  }, [aviso]);

  const compartilhar = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: texto, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado");
    } catch {
      setAviso("Não foi possível compartilhar");
    }
  };
  const zap = `https://wa.me/?text=${encodeURIComponent(`${texto}\n`)}`;

  return (
    <div className="relative flex items-center gap-1">
      <button type="button" onClick={compartilhar} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-soft hover:text-fg">
        Compartilhar
      </button>
      <a
        href={zap}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // O link do WhatsApp precisa da URL atual, que só existe no cliente.
          e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${texto}\n${window.location.href}`)}`;
        }}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-soft hover:text-fg"
      >
        WhatsApp
      </a>
      {aviso && (
        <span role="status" className="absolute -bottom-8 left-0 rounded-md bg-fg px-2 py-1 text-xs text-bg shadow">
          {aviso}
        </span>
      )}
    </div>
  );
}
