// Mede o tempo de resposta do servidor por página e quantas chamadas ao Supabase cada uma faz.
//   LATENCIA_MS=100 LOG=1 node e2e/supabase-simulado.mjs > /tmp/chamadas.log &   (simula 100 ms até o banco)
//   node e2e/medir-tempo.mjs /tmp/chamadas.log /app /app/talhoes ...
// Saída por página: tempo até o 1º byte (TTFB), chamadas ao banco, e a "profundidade" (chamadas em sequência).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [arquivoLog, ...caminhos] = process.argv.slice(2);
const papel = process.env.PAPEL ?? 'consultor';
const papelCookie = process.env.PAPEL ?? 'consultor';
const cookie = (await (await fetch(`http://127.0.0.1:54321/__sessao?papel=${papelCookie}`)).json()).cookie; // assinado pelo simulador

const linhasDoLog = () => readFileSync(arquivoLog, 'utf8').split('\n').filter((l) => /^\d+\t/.test(l)).map((l) => { const [t, m, r] = l.split('\t'); return { t: +t, m, r }; });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const page = await ctx.newPage();

// aquece (compilação/cache frio não entra na conta)
await page.goto('http://127.0.0.1:3111' + caminhos[0], { waitUntil: 'load', timeout: 90000 }).catch(() => {});

for (const c of caminhos) {
  const antes = linhasDoLog().length;
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:3111' + c, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  const total = Date.now() - t0;
  const ttfb = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].responseStart));
  await page.waitForTimeout(250);
  const chamadas = linhasDoLog().slice(antes);
  // profundidade: agrupa chamadas que começaram a menos de 25 ms uma da outra (paralelas) e conta os grupos (sequência)
  let grupos = 0, ultimo = -1e9;
  for (const x of chamadas) { if (x.t - ultimo > 25) grupos++; ultimo = x.t; }
  const porTipo = chamadas.reduce((a, x) => { const k = x.r.startsWith('auth:') ? 'auth' : x.r.startsWith('rpc/') ? 'rpc' : 'tabela'; a[k] = (a[k] ?? 0) + 1; return a; }, {});
  console.log(`${c.padEnd(30)} ttfb ${String(ttfb).padStart(5)} ms | carga ${String(total).padStart(5)} ms | banco: ${String(chamadas.length).padStart(2)} chamadas em ${grupos} etapas sequenciais | ${JSON.stringify(porTipo)}`);
}
await browser.close();
