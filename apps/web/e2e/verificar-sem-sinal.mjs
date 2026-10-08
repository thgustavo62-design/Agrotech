// Faixa "sem sinal" (aparece offline, some ao voltar) e o endereço /api/saude. No simulador /api/saude dá 503 porque ele não tem /auth/v1/health — é o esperado.
import { chromium } from 'playwright';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=campo')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
await p.goto('http://127.0.0.1:3111/app', { waitUntil: 'networkidle' });
console.log('com sinal, faixa aparece?', await p.locator('.aviso-sem-sinal').count());
await c.setOffline(true); await p.waitForTimeout(500);
console.log('sem sinal, faixa:', (await p.locator('.aviso-sem-sinal').innerText()).slice(0, 120));
await p.screenshot({ path: 'semsinal.png' });
await c.setOffline(false); await p.waitForTimeout(500);
console.log('voltou o sinal, faixa some?', await p.locator('.aviso-sem-sinal').count() === 0);
// /api/saude e a rota pública
const r = await fetch('http://127.0.0.1:3111/api/saude'); console.log('/api/saude →', r.status, JSON.stringify(await r.json()).slice(0, 140));
await b.close();
