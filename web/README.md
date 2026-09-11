# imobiapp · site de busca

Interface web (Next.js 16, App Router) sobre o catálogo `../data/imoveis.db`
gerado pelos scrapers Python. Lê o SQLite direto com `better-sqlite3`; não
precisa de outro serviço.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

Variáveis:

- `IMOBIAPP_DB` — caminho do banco (padrão `../data/imoveis.db`).
- `PORT` — porta do servidor (padrão 3000).

## O que tem

- **Busca** (`/`): campo com autocomplete (bairros, cidades, tipos,
  imobiliárias e códigos; `/` foca a busca) e texto livre com FTS5 sem acento.
  Filtros por finalidade, tipo, cidade, bairro, cômodos, vagas, área e
  imobiliária com contagem em cada opção; faixa de preço com histograma e
  slider duplo. Grade, lista ou **mapa lado a lado** com a lista (hover no card
  destaca o marcador, "buscar ao mover o mapa"). Cards com carrossel de fotos.
  Resumo com mediana de preço e de R$/m² dos resultados. Ordenação por preço,
  R$/m², área, quedas e **melhor oportunidade**. Tudo fica na URL.
- **Oportunidade**: para casas, apartamentos e terrenos, o índice calcula a
  mediana de R$/m² do mesmo tipo no mesmo bairro (mínimo de 5 anúncios com área
  plausível) e marca quanto cada anúncio está abaixo dela. Vira badge no card,
  filtro ("abaixo da mediana do bairro") e ordenação.
- **Imóvel** (`/imovel/:id`): galeria em mosaico com lightbox, ficha completa,
  histórico de preço, posição frente à mediana do bairro, mapa, parecidos,
  compartilhar (link/WhatsApp) e registro em "vistos recentemente".
- **Panorama** (`/panorama`): medianas por bairro e por tipo, faixas de preço,
  maiores quedas, novidades e situação de cada imobiliária.
- **Favoritos** (`/favoritos`): guardados no navegador, com tabela comparativa
  e os imóveis vistos recentemente.
- **API JSON**: `/api/imoveis` (mesmos parâmetros da busca; `formato=csv`
  exporta; `ids=1,2,3` busca por id), `/api/imoveis/:id`, `/api/mapa`,
  `/api/resumo`, `/api/sugestoes?q=`.

- **Painel** (`/painel`): backoffice por imobiliária. Login com e-mail e
  senha (scrypt, sessão em cookie httpOnly, tabela `sessoes`), `src/proxy.ts`
  barra quem não tem cookie. Páginas em `src/app/painel/(app)/`, ações em
  `src/app/painel/acoes.ts` (Server Actions, todas conferem sessão e dono do
  imóvel), consultas em `src/lib/painel.ts`, autenticação em `src/lib/auth.ts`.
  Admin (usuário sem imobiliária) escolhe sobre qual imobiliária trabalha no
  seletor da barra lateral. Cada gravação chama `invalida()` para o índice em
  memória ser refeito na próxima leitura.

Variáveis do painel: `PAINEL_ADMIN_EMAIL`, `PAINEL_ADMIN_SENHA` (e
`PAINEL_ADMIN_NOME`) criam o administrador quando o banco não tem usuários.

## Como funciona por dentro

`src/lib/db.ts` abre o banco e monta, num SQLite em memória anexado, uma
tabela auxiliar por imóvel (cidade/bairro normalizados, capa válida, variação
de preço, "novo no catálogo", coordenadas plausíveis) e um índice FTS5. O
índice é refeito quando `PRAGMA data_version` mostra que os scrapers gravaram
algo, então basta rodar `./run.py coletar` e recarregar a página.

`src/lib/catalogo.ts` tem as consultas (busca com facetas, detalhe, mapa,
resumo, CSV). As páginas são Server Components; a interatividade dos filtros
fica em `src/components/Busca.tsx`, que só troca a query string.
