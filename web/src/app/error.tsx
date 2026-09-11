"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Não deu para carregar o catálogo</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <p className="mt-4 text-sm text-muted">
        O site lê o arquivo <code>data/imoveis.db</code> gerado por <code>./run.py coletar</code>. Confira se ele existe ou
        aponte a variável <code>IMOBIAPP_DB</code> para o caminho certo.
      </p>
      <button type="button" onClick={reset} className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
        Tentar de novo
      </button>
    </div>
  );
}
