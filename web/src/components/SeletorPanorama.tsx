"use client";
import { useRouter } from "next/navigation";
import type { FacetaItem } from "@/lib/types";

export default function SeletorPanorama({ cidades, cidade, fin }: { cidades: FacetaItem[]; cidade: string; fin: string }) {
  const router = useRouter();
  const ir = (c: string, f: string) => {
    const p = new URLSearchParams();
    if (c !== "itajuba") p.set("cidade", c);
    if (f !== "venda") p.set("fin", f);
    const qs = p.toString();
    router.replace(qs ? `/panorama?${qs}` : "/panorama");
  };
  const campo = "rounded-lg border border-line bg-card px-2 py-1.5 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={cidade} onChange={(e) => ir(e.target.value, fin)} className={campo} aria-label="Cidade">
        {cidades.map((c) => (
          <option key={c.chave} value={c.chave}>
            {c.nome} ({c.n})
          </option>
        ))}
      </select>
      <select value={fin} onChange={(e) => ir(cidade, e.target.value)} className={campo} aria-label="Finalidade">
        <option value="venda">Venda</option>
        <option value="aluguel">Aluguel</option>
      </select>
    </div>
  );
}
