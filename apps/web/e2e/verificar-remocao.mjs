// Remover empregado: o proprietário confirma, o servidor bane a conta (Auth) e desativa o perfil.
// Precisa do simulador com LOG=1 gravando em $LOG_SIM e do app com SUPABASE_SERVICE_ROLE_KEY=qualquer-valor.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=proprietario')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
const erros = [];
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)); });
await p.goto('http://127.0.0.1:3111/app/config/equipe', { waitUntil: 'networkidle' });
const card = p.locator('.membro', { hasText: 'Ana Lima' });
await card.locator('summary:has-text("Remover do escritório")').click();
console.log('aviso de remoção:', (await card.locator('details.perigo p').innerText()).slice(0, 90));
await card.locator('button:has-text("Confirmar remoção")').click();
await p.waitForTimeout(2000);
const log = readFileSync(process.env.LOG_SIM, 'utf8');
console.log('ban/renomeio no Auth (PUT admin/users):', (log.match(/PUT\s+auth:admin\/users/g) ?? []).length);
console.log('perfil desativado (PATCH profiles):', (log.match(/PATCH\s+profiles/g) ?? []).length);
console.log('mensagem na tela:', (await p.locator('[role=status], .aviso').allInnerTexts()).join(' | ').slice(0, 120) || '(nenhuma)');
console.log('erros de console:', [...new Set(erros)].slice(0, 3));
await b.close();
