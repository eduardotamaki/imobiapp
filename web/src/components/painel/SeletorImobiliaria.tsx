"use client";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { cls } from "./ui";

interface Props {
  opcoes: { id: number; nome: string }[];
  atual: number | null;
  acao: (fd: FormData) => Promise<void>;
}

/** Admin escolhe sobre qual imobiliária está trabalhando; envia ao mudar. */
export default function SeletorImobiliaria({ opcoes, atual, acao }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const caminho = usePathname();
  return (
    <form ref={ref} action={acao}>
      <input type="hidden" name="volta" value={caminho} />
      <select
        name="imobiliaria_id"
        defaultValue={atual ?? ""}
        onChange={() => ref.current?.requestSubmit()}
        className={`${cls.select} py-1.5`}
        aria-label="Imobiliária"
      >
        <option value="">Todas as imobiliárias</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </form>
  );
}
