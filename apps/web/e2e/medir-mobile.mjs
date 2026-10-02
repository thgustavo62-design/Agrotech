import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Mede o app em tamanho de celular: rolagem lateral, alvos de toque < 36 px, erros de JS; salva capturas.
// uso: node e2e/medir-mobile.mjs <largura> <altura> <pasta> <topo|cheia> <caminho>...   (PAPEL=produtor para o portal)
// uso: node shot2.mjs <largura> <altura> <pasta> <modo: topo|cheia> <caminho>...
const [w, h, pasta, modo, ...caminhos] = process.argv.slice(2);
mkdirSync(pasta, { recursive: true });
const papelCookie = process.env.PAPEL ?? 'consultor';
const cookie = (await (await fetch(`http://127.0.0.1:54321/__sessao?papel=${papelCookie}&perfis=${process.env.PERFIS ?? ""}`)).json()).cookie; // assinado pelo simulador

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 600, hasTouch: +w < 600 });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message.slice(0, 120)));
for (const c of caminhos) {
  erros.length = 0;
  const resp = await page.goto('http://127.0.0.1:3111' + c, { waitUntil: 'networkidle', timeout: 90000 }).catch((e) => ({ status: () => 'ERRO ' + e.message.slice(0, 60) }));
  await page.waitForTimeout(500);
  const nome = c.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: modo === 'cheia' });
  const info = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const estouram = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      // ignora o que está dentro de contêiner com rolagem horizontal própria
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return false;
      }
      return r.right > vw + 1;
    }).slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}(${Math.round(el.getBoundingClientRect().right)})`);
    const pequenos = [...document.querySelectorAll('a, button, select, input:not([type=hidden])')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 36 || r.width < 36) && getComputedStyle(el).visibility !== 'hidden' && !el.closest('nextjs-portal');
    }).length;
    return { vw, scrollW: document.documentElement.scrollWidth, estouram, pequenos, titulo: document.title };
  });
  console.log(`${c.padEnd(26)} http ${resp.status?.() ?? '?'} | rolagem lateral: ${info.scrollW > info.vw ? 'SIM ' + info.scrollW : 'não'} | alvos <36px: ${info.pequenos} | estouram: ${info.estouram.join(' ') || '-'}${erros.length ? ' | JS: ' + erros[0] : ''}`);
}
await browser.close();
