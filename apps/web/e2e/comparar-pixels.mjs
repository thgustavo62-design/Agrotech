// Capturas de tela completas para comparar BYTE A BYTE antes/depois de mexer em CSS (cmp dir-antes/x.png dir-depois/x.png).
// uso: node pixels.mjs <pasta> <largura>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const [pasta, largura] = process.argv.slice(2);
mkdirSync(pasta, { recursive: true });
const U = 'f0000001-0000-0000-0000-000000000000', T = 't0000001-0000-0000-0000-000000000000';
const CONSULTOR = ['/app', '/app/talhoes', '/app/analises/nova', '/app/laudos/d0', '/app/inteligencia', `/app/produtores/${U}`, `/app/talhoes/${T}`, '/app/agenda', '/app/financeiro-escritorio', '/app/config'];
const PRODUTOR = ['/produtor', '/produtor/financeiro', '/produtor/talhoes'];
const PUBLICAS = ['/login', '/cadastro', '/produtor/login', '/demo', '/offline'];

const browser = await chromium.launch();
async function lote(papel, caminhos) {
  const ctx = await browser.newContext({ viewport: { width: +largura, height: 900 }, deviceScaleFactor: 1, isMobile: +largura < 600, hasTouch: +largura < 600, reducedMotion: 'reduce' });
  if (papel) {
    const cookie = (await (await fetch(`http://127.0.0.1:54321/__sessao?papel=${papel}`)).json()).cookie;
    await ctx.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
  }
  const page = await ctx.newPage();
  for (const c of caminhos) {
    await page.goto('http://127.0.0.1:3111' + c, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.esq'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(700);
    writeFileSync(`${pasta}/${(papel ?? 'pub')}_${c.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}.png`, await page.screenshot({ fullPage: true }));
  }
  await ctx.close();
}
await lote('consultor', CONSULTOR);
await lote('produtor', PRODUTOR);
await lote(null, PUBLICAS);
await browser.close();
console.log('ok', pasta);
