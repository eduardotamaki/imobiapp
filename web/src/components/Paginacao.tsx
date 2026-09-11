"use client";

interface Props {
  pagina: number;
  paginas: number;
  aoMudar: (p: number) => void;
}

export default function Paginacao({ pagina, paginas, aoMudar }: Props) {
  if (paginas <= 1) return null;
  const itens: (number | "…")[] = [];
  const vizinhos = 2;
  for (let p = 1; p <= paginas; p++) {
    if (p === 1 || p === paginas || Math.abs(p - pagina) <= vizinhos) itens.push(p);
    else if (itens[itens.length - 1] !== "…") itens.push("…");
  }
  const botao = "min-w-9 rounded-lg border px-2.5 py-1.5 text-sm transition disabled:opacity-40";
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginação">
      <button type="button" className={`${botao} border-line hover:bg-soft`} disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        Anterior
      </button>
      {itens.map((it, k) =>
        it === "…" ? (
          <span key={`e${k}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            aria-current={it === pagina ? "page" : undefined}
            onClick={() => aoMudar(it)}
            className={`${botao} ${it === pagina ? "border-accent bg-accent text-accent-fg" : "border-line hover:bg-soft"}`}
          >
            {it}
          </button>
        ),
      )}
      <button type="button" className={`${botao} border-line hover:bg-soft`} disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
        Próxima
      </button>
    </nav>
  );
}
