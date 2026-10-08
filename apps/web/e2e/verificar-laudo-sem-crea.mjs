// Emitir laudo sem CREA: recusado, nada gravado. Simulador com SEM_CREA=1 e LOG=1 (LOG_SIM = arquivo do log).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=agronomico')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1100, height: 900 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
await p.goto('http://127.0.0.1:3111/app/analises/a0000002-0000-0000-0000-000000000000', { waitUntil: 'networkidle' });
await p.click('button:has-text("Emitir laudo")');
await p.waitForTimeout(2000);
console.log('URL:', p.url().replace('http://127.0.0.1:3111', ''));
console.log('mensagem:', ((await p.locator('body').innerText()).match(/Não é possível emitir[^\n]*/) ?? ['(não achou)'])[0]);
console.log('gravou recomendação:', (readFileSync(process.env.LOG_SIM, 'utf8').match(/POST\s+recomendacoes/g) ?? []).length, '(esperado 0)');
await b.close();
