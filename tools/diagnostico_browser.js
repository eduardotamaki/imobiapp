#!/usr/bin/env node
/**
 * Abre um site num Chromium de verdade e mostra o que ele carrega.
 *
 * Serve para sites que chegam vazios no scraper: o navegador executa o
 * JavaScript e revela de onde vêm os dados. Foi assim que LBraga, NS de
 * Fátima e Mohallem entraram no catálogo -- as três parecem sites vazios
 * (ou fora do ar) para um cliente HTTP comum.
 *
 * Uso:
 *   node tools/diagnostico_browser.js https://exemplo.com.br [mais urls...]
 *
 * Mostra, para cada URL:
 *   - status, URL final (revela redirecionamento para /manutencao e afins)
 *   - título e começo do texto renderizado
 *   - links que parecem de imóvel
 *   - TODAS as chamadas JSON que a página fez, com corpo e resposta
 *
 * É a última linha que costuma resolver: quase sempre existe uma API JSON
 * por trás, e aí o scraper de produção consome ela direto, sem navegador.
 *
 * Requisitos (ver README, seção "Ferramenta de diagnóstico"):
 *   npm i playwright-core   e um Chromium em ~/.cache/ms-playwright
 */
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH
  || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const ESPERA = Number(process.env.ESPERA_MS || 6000);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/153.0.0.0 Safari/537.36';

const alvos = process.argv.slice(2);
if (!alvos.length) {
  console.error('uso: node tools/diagnostico_browser.js <url> [url...]');
  process.exit(1);
}

(async () => {
  const navegador = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  // ignoreHTTPSErrors: há site da lista cujo apex tem certificado inválido.
  const ctx = await navegador.newContext({
    ignoreHTTPSErrors: true, userAgent: UA, locale: 'pt-BR',
  });

  for (const alvo of alvos) {
    const pagina = await ctx.newPage();
    const chamadas = [];
    pagina.on('response', async (r) => {
      const tipo = r.headers()['content-type'] || '';
      if (!/json/.test(tipo) || r.request().resourceType() === 'image') return;
      let corpo = '';
      try { corpo = (await r.text()).slice(0, 400); } catch { /* resposta já descartada */ }
      chamadas.push({
        metodo: r.request().method(), url: r.url(), status: r.status(),
        envio: (r.request().postData() || '').slice(0, 300), corpo,
      });
    });

    console.log(`\n${'='.repeat(70)}\n${alvo}`);
    try {
      const r = await pagina.goto(alvo, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await pagina.waitForTimeout(ESPERA);
      const info = await pagina.evaluate(() => {
        const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.href);
        const imoveis = hrefs.filter((h) => /imovel|imoveis|propriedade|detalhe|resultado|codigo=|categoria=/i.test(h));
        const texto = document.body ? document.body.innerText.replace(/\s+/g, ' ') : '';
        return {
          titulo: document.title,
          texto: texto.slice(0, 300),
          precos: (texto.match(/R\$\s?[\d.]+(?:,\d\d)?/g) || []).slice(0, 4),
          totalLinks: hrefs.length,
          imoveis: [...new Set(imoveis)].slice(0, 6),
        };
      });
      console.log(`  status ${r ? r.status() : '?'} -> ${pagina.url()}`);
      console.log(`  título: ${info.titulo}`);
      console.log(`  texto:  ${info.texto}`);
      console.log(`  preços: ${JSON.stringify(info.precos)}`);
      console.log(`  links:  ${info.totalLinks} no total; de imóvel:`);
      info.imoveis.forEach((u) => console.log(`     ${u}`));
    } catch (e) {
      console.log(`  ERRO: ${e.message.split('\n')[0]}`);
    }

    console.log(`  chamadas JSON (${chamadas.length}):`);
    for (const c of chamadas) {
      console.log(`     ${c.metodo} ${c.status} ${c.url}`);
      if (c.envio) console.log(`        envio: ${c.envio}`);
      if (c.corpo) console.log(`        resp:  ${c.corpo.replace(/\s+/g, ' ')}`);
    }
    await pagina.close();
  }
  await navegador.close();
})();
