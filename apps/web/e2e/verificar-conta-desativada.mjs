// Conta desativada: com DESATIVADO=1 no simulador, toda rota /app mostra "Seu acesso foi removido", sem menu nem dados.
import { chromium } from 'playwright';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=campo')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
for (const rota of ['/app', '/app/produtores', '/app/config/equipe']) {
  await p.goto('http://127.0.0.1:3111' + rota, { waitUntil: 'networkidle' });
  console.log(rota.padEnd(22), '->', (await p.locator('h1').first().innerText()), '| menu lateral:', await p.locator('.lateral').count(), '| URL:', p.url().replace('http://127.0.0.1:3111', ''));
}
await p.screenshot({ path: 'removido.png' });
await b.close();
