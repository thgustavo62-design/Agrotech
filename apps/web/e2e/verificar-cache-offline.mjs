// Pré-aquecimento do cache: abre a agenda com sinal, fica offline e abre talhões que nunca foram visitados.
import { chromium } from 'playwright';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=campo')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
await p.goto('http://127.0.0.1:3111/app', { waitUntil: 'networkidle' }); // registra o SW
await p.waitForTimeout(2500);
await p.goto('http://127.0.0.1:3111/app/agenda', { waitUntil: 'networkidle' });
await p.waitForTimeout(6000);
console.log('aviso:', await p.locator('p[role=status]').allInnerTexts());
// um talhão que NUNCA foi aberto no navegador: precisa abrir offline vindo do cache
const alvo = (await p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\/app\/talhoes\/t0/.test(n)))).length;
await c.setOffline(true);
for (const id of ['t0000001', 't0000002', 't0000004']) {
  const r = await p.goto(`http://127.0.0.1:3111/app/talhoes/${id}-0000-0000-0000-000000000000`, { waitUntil: 'domcontentloaded' }).catch((e) => ({ status: () => 'ERRO' }));
  await p.waitForTimeout(1500); console.log(id, '->', r.status(), '| h1:', (await p.locator('h1').first().innerText().catch(() => '-')).slice(0, 40), '| aba Monitoramento:', await p.locator('button.aba:has-text("Monitoramento")').count());
}
await b.close();
