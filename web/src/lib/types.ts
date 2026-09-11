export type Finalidade = "venda" | "aluguel" | "todos";
export type Vista = "grade" | "lista" | "mapa";

export interface Filtros {
  q: string;
  fin: Finalidade;
  tipo: string[];
  cidade: string[];
  bairro: string[];
  pmin: number | null;
  pmax: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  amin: number | null;
  amax: number | null;
  imob: string[];
  foto: boolean;
  comPreco: boolean;
  baixou: boolean;
  novos: boolean;
  removidos: boolean;
  oportunidade: boolean;
  /** "sul,oeste,norte,leste" — só imóveis com coordenada dentro da área do mapa. */
  bbox: [number, number, number, number] | null;
  ordem: string;
  pagina: number;
  porPagina: number;
  vista: Vista;
}

export interface Imovel {
  id: number;
  codigo: string | null;
  tipo: string | null;
  finalidade: string | null;
  titulo: string | null;
  preco: number | null;
  preco_aluguel: number | null;
  condominio: number | null;
  iptu: number | null;
  area: number | null;
  area_util: number | null;
  area_total: number | null;
  preco_m2: number | null;
  aluguel_m2: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  capa: string | null;
  n_fotos: number;
  imobiliaria: string;
  imobiliaria_slug: string;
  imobiliaria_site: string;
  url: string;
  status: string;
  novo: number;
  variacao: number | null;
  preco_anterior: number | null;
  lat: number | null;
  lng: number | null;
  criado_em: string;
  visto_em: string;
  /** Até 6 fotos para o carrossel do card. */
  fotos: string[];
  /** 1 - (R$/m² deste) / (mediana do bairro ou cidade, mesmo tipo). Positivo = abaixo da mediana. */
  desconto: number | null;
  ref_escopo: "bairro" | "cidade" | null;
  ref_n: number | null;
  ref_m2: number | null;
}

export interface HistoricoPreco {
  data: string;
  preco: number | null;
  preco_aluguel: number | null;
}

export interface Contexto {
  escopo: "bairro" | "cidade";
  nome: string;
  n: number;
  mediana_m2: number | null;
  mediana_preco: number | null;
}

export interface ImovelDetalhe extends Imovel {
  origem: string;
  imobiliaria_whatsapp: string | null;
  imobiliaria_telefone: string | null;
  imobiliaria_email: string | null;
  descricao: string | null;
  endereco: string | null;
  cep: string | null;
  fotos: string[];
  caracteristicas: string[];
  historico: HistoricoPreco[];
  similares: Imovel[];
  contexto: Contexto[];
  atualizado_em: string;
}

export interface FacetaItem {
  chave: string;
  nome: string;
  n: number;
}

export interface Facetas {
  tipo: FacetaItem[];
  cidade: FacetaItem[];
  bairro: FacetaItem[];
  imob: FacetaItem[];
}

export interface Estatisticas {
  n: number;
  mediana_preco: number | null;
  mediana_m2: number | null;
  minimo: number | null;
  maximo: number | null;
}

export interface Histograma {
  /** Limites "redondos" em escala logarítmica; contagens[i] cobre [limites[i], limites[i+1]). */
  limites: number[];
  contagens: number[];
}

export interface Sugestao {
  tipo: "bairro" | "cidade" | "tipo" | "imob" | "codigo" | "texto";
  chave: string;
  nome: string;
  detalhe?: string;
  n?: number;
}

export interface Resultado {
  total: number;
  estatisticas: Estatisticas;
  histograma: Histograma;
  pagina: number;
  paginas: number;
  porPagina: number;
  itens: Imovel[];
  facetas: Facetas;
  comCoordenadas: number;
}

export interface Ponto {
  id: number;
  lat: number;
  lng: number;
  preco: number | null;
  preco_aluguel: number | null;
  tipo: string | null;
  titulo: string | null;
  bairro: string | null;
  capa: string | null;
  quartos: number | null;
  area: number | null;
}

export interface Resumo {
  geral: {
    total: number;
    disponiveis: number;
    comPreco: number;
    novos: number;
    quedas: number;
    oportunidades: number;
    imobiliarias: number;
    ultimaColeta: string | null;
  };
  cidade: string;
  fin: Finalidade;
  porTipo: { tipo: string; n: number; mediana: number | null; mediana_m2: number | null }[];
  porBairro: {
    chave: string;
    nome: string;
    n: number;
    mediana: number | null;
    mediana_m2: number | null;
    casas: number;
    aptos: number;
    terrenos: number;
  }[];
  porImobiliaria: {
    slug: string;
    nome: string;
    site: string;
    plataforma: string | null;
    status: string;
    n: number;
    disponiveis: number;
    comPreco: number;
    ultimaColeta: string | null;
  }[];
  faixas: { rotulo: string; n: number }[];
  quedas: Imovel[];
  novos: Imovel[];
  oportunidades: Imovel[];
}
