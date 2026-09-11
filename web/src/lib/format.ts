export const TIPOS: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
  chacara: "Chácara / Sítio",
  comercial: "Comercial",
  casa_condominio: "Casa em condomínio",
  cobertura: "Cobertura",
  garagem: "Garagem",
};

export const ORDENS: { valor: string; rotulo: string }[] = [
  { valor: "relevancia", rotulo: "Relevância" },
  { valor: "preco_asc", rotulo: "Menor preço" },
  { valor: "preco_desc", rotulo: "Maior preço" },
  { valor: "m2_asc", rotulo: "Menor R$/m²" },
  { valor: "m2_desc", rotulo: "Maior R$/m²" },
  { valor: "area_desc", rotulo: "Maior área" },
  { valor: "quartos_desc", rotulo: "Mais quartos" },
  { valor: "oportunidade", rotulo: "Melhor oportunidade (R$/m² vs. bairro)" },
  { valor: "baixou", rotulo: "Maior queda de preço" },
  { valor: "recentes", rotulo: "Mais recentes" },
];

export function rotuloTipo(t?: string | null): string {
  return t ? TIPOS[t] ?? t : "Imóvel";
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function fmtPreco(v?: number | null): string {
  if (v == null || !isFinite(v)) return "Sob consulta";
  return brl.format(v);
}

/** Forma curta para marcadores e etiquetas: R$ 450 mil, R$ 1,2 mi. */
export function fmtPrecoCurto(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1_000_000) return `R$ ${num1.format(v / 1_000_000)} mi`;
  if (v >= 1_000) return `R$ ${num.format(Math.round(v / 1_000))} mil`;
  return brl.format(v);
}

export function fmtNum(v?: number | null, casas = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return (casas ? num1 : num).format(v);
}

export function fmtArea(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 10_000) return `${num1.format(v / 10_000)} ha`;
  return `${num.format(v)} m²`;
}

export function fmtM2(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return `${brl.format(v)}/m²`;
}

export function fmtPct(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  const s = (v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0).replace(".", ",");
  return `${v > 0 ? "+" : ""}${s}%`;
}

export function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function plural(n: number, um: string, varios: string): string {
  return `${num.format(n)} ${n === 1 ? um : varios}`;
}

/** "Casa 3 quartos no Pinheirinho": título uniforme, já que cada site escreve de um jeito. */
export function tituloCurto(i: {
  tipo: string | null;
  quartos: number | null;
  bairro: string | null;
  cidade: string | null;
}): string {
  let t = rotuloTipo(i.tipo);
  if (i.quartos) t += ` ${i.quartos} ${i.quartos === 1 ? "quarto" : "quartos"}`;
  if (i.bairro) t += ` no ${i.bairro}`;
  else if (i.cidade) t += ` em ${i.cidade}`;
  return t;
}

/** Preço que interessa na finalidade escolhida. */
export function precoRef(i: { preco: number | null; preco_aluguel: number | null }, fin: string): number | null {
  if (fin === "aluguel") return i.preco_aluguel;
  if (fin === "venda") return i.preco;
  return i.preco ?? i.preco_aluguel;
}
