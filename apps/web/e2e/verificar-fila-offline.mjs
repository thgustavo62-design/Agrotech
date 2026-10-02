// Fila offline de verdade: com o service worker ativo, fica offline, salva uma visita, volta o sinal e confere o envio.
// Precisa do simulador com LOG=1 gravando em $LOG_SIM:  LOG=1 node e2e/supabase-simulado.mjs > $LOG_SIM
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=campo')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
const erros = [];
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)); });
await p.goto('http://127.0.0.1:3111/app/talhoes', { waitUntil: 'networkidle' });
const href = await p.locator('a[href^="/app/talhoes/"]').first().getAttribute('href');
console.log('talhão:', href);
await p.goto('http://127.0.0.1:3111' + href, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.reload({ waitUntil: 'networkidle' });                    // agora controlada pelo SW e já no cache
console.log('SW controla:', await p.evaluate(() => !!navigator.serviceWorker.controller));
await p.click('button.aba:has-text("Monitoramento")');
await c.setOffline(true);
await p.fill('#v_data', new Date().toISOString().slice(0, 10));
await p.fill('#v_obs', 'visita feita sem sinal');
await p.click('button:has-text("Salvar visita")');
await p.waitForTimeout(1200);
console.log('mensagem:', (await p.locator('[role=status]').allInnerTexts()).join(' | '));
console.log('no IndexedDB:', await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open('agrotech-fila', 1); r.onsuccess = () => { const q = r.result.transaction('pendentes').objectStore('pendentes').count(); q.onsuccess = () => ok(q.result); }; })));
const antes = readFileSync(process.env.LOG_SIM ?? '/tmp/sim.log', 'utf8').split('\n').filter((l) => /POST\tvisitas/.test(l)).length;
await c.setOffline(false);
await p.waitForTimeout(4000);
const depois = readFileSync(process.env.LOG_SIM ?? '/tmp/sim.log', 'utf8').split('\n').filter((l) => /POST\tvisitas/.test(l)).length;
console.log('POST visitas no servidor: antes', antes, 'depois', depois);
console.log('faixa depois:', (await p.locator('[role=status]').allInnerTexts()).join(' | ') || '(sumiu)');
console.log('no IndexedDB:', await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open('agrotech-fila', 1); r.onsuccess = () => { const q = r.result.transaction('pendentes').objectStore('pendentes').count(); q.onsuccess = () => ok(q.result); }; })));
console.log('erros de console:', [...new Set(erros)].slice(0, 4));
await b.close();
