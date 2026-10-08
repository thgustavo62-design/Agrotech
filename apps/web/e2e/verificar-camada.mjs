// Amostra de 20-40 cm: aviso, botão desabilitado e servidor recusa. Simulador com SUB2040=1 e LOG=1 (LOG_SIM = arquivo do log).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=agronomico')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1100, height: 900 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
const id = (n) => `a000000${n}-0000-0000-0000-000000000000`;
for (const [n, nome] of [[2, '20-40 cm'], [1, '0-20 cm']]) {
  await p.goto('http://127.0.0.1:3111/app/analises/' + id(n), { waitUntil: 'networkidle' });
  console.log(nome, '→ botão desabilitado:', await p.locator('button:has-text("Emitir laudo")').isDisabled(), '| aviso:', ((await p.locator('.aviso[role=alert]').allInnerTexts()).join(' ') || '(nenhum)').replace(/\n+/g, ' ').slice(0, 170));
}
await p.goto('http://127.0.0.1:3111/app/analises/' + id(2), { waitUntil: 'networkidle' });
await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /Emitir laudo/.test(x.textContent)).forEach((x) => x.removeAttribute('disabled')));
await p.click('button:has-text("Emitir laudo")'); await p.waitForTimeout(1800);
console.log('servidor (botão forçado):', ((await p.locator('body').innerText()).match(/Esta amostra é de 20[^\n]*/) ?? ['(não achou)'])[0].slice(0, 120));
console.log('gravou recomendação:', (readFileSync(process.env.LOG_SIM, 'utf8').match(/POST\s+recomendacoes/g) ?? []).length, '(esperado 0)');
await b.close();
