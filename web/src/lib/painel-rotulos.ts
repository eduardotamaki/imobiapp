/** Rótulos do backoffice, sem dependências: servem em Server e Client Components. */

export const STATUS_IMOVEL: Record<string, string> = {
  disponivel: "No ar",
  pausado: "Pausado",
  vendido: "Vendido",
  alugado: "Alugado",
  removido: "Saiu do site",
};

export const STATUS_LEAD: Record<string, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  fechado: "Fechado",
  descartado: "Descartado",
};

export const PROBLEMAS: Record<string, string> = {
  sem_foto: "Sem foto",
  sem_preco: "Sem preço",
  sem_local: "Sem localização no mapa",
  sem_descricao: "Sem descrição",
  sem_area: "Sem área",
  antigo: "No ar há mais de 180 dias",
};
