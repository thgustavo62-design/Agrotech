// Fotografa o HTML renderizado (normalizado) de cada página e de cada aba dela.
// uso: node snap.mjs <pasta> [papel]   — compara antes/depois de uma refatoração.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const [pasta, papel = 'consultor'] = process.argv.slice(2);
mkdirSync(pasta, { recursive: true });
const U = 'p0000001-0000-0000-0000-000000000000', T = 't0000001-0000-0000-0000-000000000000', A = 'a0000001-0000-0000-0000-000000000000';
const PAGINAS = papel === 'produtor'
  ? ['/produtor', '/produtor/fazenda', '/produtor/talhoes', '/produtor/recomendacoes', '/produtor/atividades', '/produtor/financeiro', '/produtor/producao', '/produtor/documentos', '/produtor/notificacoes']
  : [
    '/app', '/app/pendencias', '/app/agenda', '/app/produtores', `/app/produtores/${U}`, `/app/produtores/${U}/editar`, '/app/produtores/nova',
    '/app/propriedades', '/app/talhoes', `/app/talhoes/${T}`, `/app/talhoes/${T}/editar`, '/app/analises', '/app/analises/nova', `/app/analises/${A}`,
    '/app/laudos', '/app/laudos/novo', '/app/laudos/d0', '/app/recomendacoes', '/app/monitoramento', '/app/inteligencia', '/app/relatorios',
    '/app/financeiro-escritorio', '/app/tabelas', '/app/equipe', '/app/assinatura', '/app/config', '/app/notificacoes',
  ];

const cookie = (await (await fetch(`http://127.0.0.1:54321/__sessao?papel=${papel}`)).json()).cookie;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const page = await ctx.newPage();

const normalizar = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '')            // marcadores de Suspense do React
  .replace(/<img[^>]*leaflet-tile[^>]*>/g, '') // azulejos do mapa: animação de carregamento, não é conteúdo
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/:R[0-9a-z]*:/g, ':R:')            // useId depende da posição na árvore de componentes
  .replace(/\s+data-nextjs[^=\s>]*="[^"]*"/g, '')
  .replace(/(src|srcset|href)="([^"]*\/_next\/[^"]*)"/g, (m, a) => `${a}="/_next/…"`)
  .replace(/></g, '>\n<');

for (const caminho of PAGINAS) {
  const resp = await page.goto('http://127.0.0.1:3111' + caminho, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => null);
  // com loading.tsx a página chega por streaming: espera o esqueleto sair e o conteúdo real aparecer
  await page.waitForFunction(() => document.querySelector('main.vista') && !document.querySelector('.esq'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500); // mapa/Leaflet e demais efeitos de cliente assentam
  let saida = `# ${caminho}  http ${resp?.status()}\n`;
  const abas = await page.locator('main.vista .abas .aba').count();
  const secoes = abas > 0 ? abas : 1;
  for (let i = 0; i < secoes; i++) {
    if (abas > 0) { await page.locator('main.vista .abas .aba').nth(i).click(); await page.waitForTimeout(120); }
    const html = await page.locator('main.vista').first().innerHTML().catch(() => '(sem main.vista)');
    saida += `\n## ${abas > 0 ? 'aba ' + i : 'página'}\n` + normalizar(html) + '\n';
  }
  writeFileSync(`${pasta}/${caminho.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.html`, saida);
  console.log(caminho.padEnd(60), `http ${resp?.status()} | ${secoes} seção(ões) | ${saida.length} chars`);
}
await browser.close();
