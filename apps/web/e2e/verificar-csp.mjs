// Abre cada rota com um navegador e conta violações de CSP / erros de JS e se a página hidratou.
// uso: [PAPEL=consultor|produtor|anon] node e2e/verificar-csp.mjs /login /app ...   (no Git Bash: MSYS_NO_PATHCONV=1)
import { chromium } from 'playwright';
const papel = process.env.PAPEL ?? 'consultor';
const cookie = (await (await fetch(`http://127.0.0.1:54321/__sessao?papel=${papel}`)).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
if (papel !== 'anon') await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
let achados = [];
p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused/i.test(m.text())) achados.push(m.text().slice(0, 220)); });
p.on('pageerror', (e) => achados.push('pageerror: ' + e.message.slice(0, 160)));
for (const rota of process.argv.slice(2)) {
  achados = [];
  const r = await p.goto('http://127.0.0.1:3111' + rota, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => 'ERRO ' + e.message.slice(0, 50) }));
  await p.waitForTimeout(600);
  // a página hidratou? (React pendura __reactFiber nos nós)
  const hidratou = await p.evaluate(() => { const el = document.querySelector('main, form, body > div'); return !!el && Object.keys(el).some((k) => k.startsWith('__react')); });
  console.log(rota.padEnd(34), r.status(), 'hidratou:', hidratou, '| violações/erros:', achados.length);
  for (const a of [...new Set(achados)].slice(0, 4)) console.log('    ', a);
}
await b.close();
