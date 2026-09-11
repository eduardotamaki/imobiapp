# imobiapp — catálogo de imóveis de Itajubá/MG

Raspa os sites das imobiliárias de Itajubá e guarda tudo num SQLite único,
para dar pra comparar preço, m² e bairro entre imobiliárias — e para ver
quando um anúncio **baixa de preço** ou **sai do ar**.

Só usa a biblioteca padrão do Python (3.10+). Sem `pip install`.

```bash
./run.py coletar        # raspa todos os sites e grava em data/imoveis.db
./run.py resumo         # panorama do que foi coletado
./run.py buscar --max-preco 600000 --quartos 3 --cidade Itajuba
./run.py novidades --dias 7
```

## Site de busca (Next.js)

Em `web/` há a interface web sobre o mesmo banco: busca com filtros e facetas,
mapa, página do imóvel com histórico de preço e comparação com o bairro,
panorama do mercado e favoritos. Veja [web/README.md](web/README.md).

```bash
cd web && npm install && npm run dev    # http://localhost:3000
```

## Publicar só o site (Render)

O `render.yaml` na raiz sobe apenas `web/`. Como o Render free não tem disco
persistente, o banco vai dentro do repositório como snapshot em
`web/data/imoveis.db`, sem WAL, gerado a partir do banco vivo:

```bash
./run.py coletar     # atualiza data/imoveis.db
./run.py exportar    # copia limpa em web/data/imoveis.db
git add web/data/imoveis.db && git commit -m "Atualiza catálogo" && git push
```

Cada push redeploya o site com os dados novos. Localmente o site continua
lendo `data/imoveis.db`; o snapshot só é usado quando o banco vivo não existe
ou quando `IMOBIAPP_DB` aponta para ele.

## Comandos

| Comando | Para quê |
|---|---|
| `exportar` | Gera `web/data/imoveis.db`, o snapshot que o site publicado usa. |
| `coletar` | Roda os scrapers. `--só galhardo,dfc` limita os sites, `--limite 5` limita imóveis por site, `--sem-cache` força rede. |
| `listar` | Mostra os 31 sites registrados, plataforma e situação. |
| `buscar` | Consulta o catálogo: `--max-preco --min-preco --quartos --vagas --area --tipo --cidade --bairro --ordem preco_m2`. |
| `resumo` | Contagem e faixa de preço por imobiliária e por tipo. |
| `novidades` | O que entrou, o que mudou de preço e o que saiu do ar. |

## Como está organizado

```
run.py                    CLI
imobiapp/
  db.py                   esquema SQLite, gravação e histórico de preço
  http.py                 GET com cache em disco, retry e limite de taxa
  htmlx.py                parser HTML + subconjunto de seletores CSS
  normalize.py            preço, área, tipo, finalidade, bairro...
  base.py                 classe Scraper (listar_urls + extrair)
  platforms/              um módulo por plataforma de mercado
scrapers/                 um módulo por imobiliária (31)
tools/                    diagnóstico com navegador (uso pontual)
data/imoveis.db           o catálogo
data/cache/               páginas baixadas, comprimidas
web/                      site de busca (Next.js) sobre o banco
```

**Por que "plataformas" e não 31 parsers independentes:** quase nenhuma
imobiliária de Itajubá tem site próprio — elas contratam uma das plataformas
do setor. Catorze plataformas cobrem os 27 sites que publicam catálogo, então
o parsing mora em `imobiapp/platforms/` e cada arquivo em `scrapers/`
só declara nome, site e qual plataforma aquele cliente usa. Ainda é um
scraper por site (`./run.py coletar --só galhardo`), sem o código repetido.

### Plataformas e como cada uma entrega o dado

| Plataforma | Sites | De onde sai o dado |
|---|---|---|
| ImobiBrasil | 7 | `og:title` estruturado + ficha em tabela; dois templates (moderno e legado) |
| USO | 3 | HTML com classes próprias; ainda expõe o histórico de valores num input oculto |
| Kenlo / inGaia | 3 | JSON-LD `RealEstateListing`; enumeração via `ItemList` das páginas de busca |
| ImoAlert / Ville Imob | 2 | `var imovel = {...}` com o registro inteiro |
| Universal Software | 2 | API `POST /imoveis/ajax/` que o próprio `busca.js` documenta |
| detalhes_imovel | 2 | Seções DESCRIÇÃO / CÔMODOS / MEDIDAS |
| Tecimob | 1 | JSON-LD + "Ficha do imóvel" |
| Jetimob | 1 | JSON-LD dentro do payload de hidratação do Next.js |
| Apre | 1 | JSON-LD + ficha técnica |
| Widesys (Joomla) | 1 | HTML, preço em bloco `title="Valor Venda"` |
| MeuImobiSite | 1 | Bloco de texto `.boxrightinfo` |
| WordPress | 1 | Lista `<li><b>Rótulo:</b> valor</li>` |
| Waysoft | 2 | API JSON (`buscar-im`), descoberta com navegador |
| Arbo | 1 | `__NEXT_DATA__` do Next.js + sitemap por cidade |

## Os sites que só um navegador revelou

Três sites da lista pareciam mortos para um cliente HTTP: LBraga e NS de
Fátima devolviam ~1 KB de HTML vazio, e Mohallem falhava no TLS. Abrir cada
um num Chromium de verdade mostrou outra coisa:

- **LBraga e NS de Fátima** são aplicações JavaScript sobre a plataforma
  **Waysoft**, que carrega tudo de uma API JSON. O navegador entregou o
  endereço da API e o token de cada imobiliária.
- **Mohallem** está no ar normalmente em `www.mohallemimoveis.com.br` — o
  domínio sem `www` é que tem certificado inválido. O site é Next.js e traz
  o imóvel inteiro no `__NEXT_DATA__`.

O navegador foi a ferramenta de **investigação**; os scrapers em produção
não precisam dele, porque consomem direto as fontes que ele revelou — o que
é mais rápido, mais estável e sem dependência de browser na coleta.

Detalhe achado de graça: a API da Waysoft devolve o próprio SQL na resposta
(`LIMIT 12 OFFSET n`), o que esclareceu que o campo chamado `LIMIT` no corpo
do POST é na verdade o *offset*, com página fixa de 12.

### Ferramenta de diagnóstico

`tools/diagnostico_browser.js` abre qualquer URL num Chromium e lista o que
a página renderizou **e todas as chamadas JSON que ela fez** — use quando um
site novo chegar vazio no scraper:

```bash
npm i playwright-core                 # o Chromium vem de ~/.cache/ms-playwright
node tools/diagnostico_browser.js https://site-que-nao-funciona.com.br
```

Se não houver Chromium na máquina: `npx playwright install chromium`. Sem
root, as bibliotecas do sistema (`libnss3`, `libnspr4`, `libasound2t64`)
podem ser baixadas com `apt-get download` e extraídas com `dpkg -x`, com o
caminho em `LD_LIBRARY_PATH`; aponte `CHROME_PATH` para o binário.

## O banco

`imoveis` é a tabela principal, com `preco`, `preco_aluguel`, `condominio`,
`iptu`, áreas, cômodos e localização já normalizados. Em volta dela:

- `historico_preco` — só recebe linha **quando o preço muda**, então a série
  fica enxuta e `novidades` consegue mostrar as quedas.
- `imobiliarias` — inclui os sites sem catálogo, com o motivo em `status`.
- `coletas` — uma linha por execução, com contagens e erro, para saber se um
  site parou de funcionar.
- `fotos`, `caracteristicas`.
- `v_imoveis` — visão pronta com **preço por m²** calculado.

Consulta direta, se preferir SQL:

```sql
SELECT preco, preco_m2, quartos, bairro, imobiliaria, url
FROM v_imoveis
WHERE status='disponivel' AND finalidade LIKE 'venda%'
  AND cidade='Itajubá' AND quartos >= 3 AND preco <= 600000
ORDER BY preco_m2;
```

### Como o catálogo se mantém honesto

- **Chave é a URL canônica** da própria página: vários sites servem o mesmo
  imóvel em dois caminhos, e sem isso o catálogo duplicaria.
- **Anúncio que some vira `status='removido'`**, não é apagado — foi vendido
  ou alugado, e isso é informação. A marcação só roda se a coleta trouxe
  algum resultado, para um site fora do ar não zerar o histórico.
- **Preço só entra com rótulo explícito.** Esses sites citam preço por m² e
  valores de imóveis parecidos no meio do texto; chutar daria número errado.
- **Valor simbólico não vira preço.** Várias imobiliárias cadastram R$ 0,01
  ou R$ 1,00 como "consulte-nos"; abaixo de R$ 1.000 em venda (R$ 50 em
  aluguel) o campo fica nulo.
- `cidade_busca` e `bairro_busca` guardam a versão sem acento, porque o
  SQLite não compara "Itajuba" com "Itajubá".
- `bruto` guarda o payload original, para reprocessar sem baixar de novo.
  Dados de proprietário que algumas plataformas vazam no HTML não são
  gravados.

## Coleta educada

Cache em disco (`data/cache`, 24h por padrão), no máximo uma requisição por
segundo por domínio (`--intervalo`), até 3 tentativas com espera crescente.
Ajustar parsers não gera tráfego novo: o cache responde.

## Sites sem coleta

| Site | Motivo |
|---|---|
| Pamplona, Mothici | o domínio não resolve mais (DNS) |
| Grechi | servidor não responde (timeout, verificado também no navegador) |
| Faria & Mandolesi | a própria página diz "Este site está temporariamente desativado" |
| Karol Imóveis | backend da plataforma responde 401 e o site redireciona para `/manutencao` |

Faria e Karol já têm scraper pronto e voltam a render sozinhos quando os
sites forem corrigidos — cada coleta tenta de novo e registra 0. Todos
continuam registrados em `imobiliarias` com o motivo em `status`/`obs`.

## Cobertura obtida

Coleta completa: **3.935 imóveis** de 26 imobiliárias, em ~25 min com cache
frio e ~1 min com cache quente.

| Campo | Preenchido |
|---|---|
| preço (venda ou aluguel) | 95% |
| tipo | 99% |
| cidade | 94% |
| bairro | 94% |
| foto | 95% |
| área | 54% |
| quartos | 48% |
| coordenadas | 26% |

Quartos e área ficam mais baixos porque vários sites simplesmente não
publicam esses campos na página do imóvel. Os templates antigos do
ImobiBrasil (Sul Minas, JHS, Vilas Boas, Alpes) e o DFC não publicam nem
preço nem cômodos — o catálogo grava o que existe e deixa o resto nulo, em
vez de inventar. `./run.py resumo` mostra quanto cada imobiliária rendeu.

Preço por m² abaixo de R$ 100 aparece e está certo: são terrenos rurais e
chácaras grandes, onde R$ 6–30/m² é o preço da região.

## Adicionar uma imobiliária

Crie `scrapers/nome.py`:

```python
from imobiapp.platforms.imobibrasil import ImobiBrasil

class Nome(ImobiBrasil):
    slug = "nome"
    nome = "Nome Imóveis"
    site = "https://exemplo.com.br"
```

Se for uma plataforma nova, crie o módulo em `imobiapp/platforms/` com
`listar_urls()` e `extrair(url, html)`. O registro é automático.
