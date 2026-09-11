"use client";
import { useFavoritos } from "@/lib/favoritos";
import { Coracao } from "./Icones";

export default function BotaoFavorito({ id, grande }: { id: number; grande?: boolean }) {
  const { tem, alternar } = useFavoritos();
  const ativo = tem(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternar(id);
      }}
      aria-pressed={ativo}
      aria-label={ativo ? "Remover dos favoritos" : "Salvar nos favoritos"}
      title={ativo ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={`grid place-items-center rounded-full border transition ${
        grande ? "h-10 gap-2 px-4" : "h-8 w-8"
      } ${
        ativo
          ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
          : "border-line bg-card/90 text-muted hover:text-rose-500"
      }`}
    >
      <span className="flex items-center gap-2">
        <Coracao cheio={ativo} width={grande ? 18 : 16} height={grande ? 18 : 16} />
        {grande && <span className="text-sm font-medium">{ativo ? "Salvo" : "Salvar"}</span>}
      </span>
    </button>
  );
}
