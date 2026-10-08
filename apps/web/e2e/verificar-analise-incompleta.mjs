// Análise incompleta: aviso, botão "Emitir laudo" desabilitado. Rode o simulador com INCOMPLETA=1 (a 1ª análise perde Ca e Mg).
import { chromium } from 'playwright';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=agronomico')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1100, height: 1000 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
const erros = []; p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 150)); });
for (const [id, nome] of [['a0000001-0000-0000-0000-000000000000', 'incompleta'], ['a0000002-0000-0000-0000-000000000000', 'completa']]) {
  await p.goto('http://127.0.0.1:3111/app/analises/' + id, { waitUntil: 'networkidle' });
  const btn = p.locator('button:has-text("Emitir laudo")');
  console.log(nome, '→ botão desabilitado:', await btn.isDisabled(), '| aviso:', (await p.locator('.aviso[role=alert]').allInnerTexts()).join(' ').replace(/\n+/g, ' ').slice(0, 230) || '(nenhum)');
  if (nome === 'incompleta') await p.screenshot({ path: 'incompleta.png' });
}
console.log('erros de console:', erros.slice(0, 3));
await b.close();
