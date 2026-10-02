// Fluxos de senha no navegador: proprietário gera link para o empregado, o empregado define a senha, link inválido, "esqueci minha senha".
// Precisa do simulador (CORS + rotas admin/verify/recover) e do app com SUPABASE_SERVICE_ROLE_KEY=qualquer-valor.
import { chromium } from 'playwright';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=proprietario')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
const msgs = [];
p.on('console', (m) => { if (m.type() === 'error') msgs.push(m.text().slice(0, 200)); });
// 1) proprietário gera o link do empregado
await p.goto('http://127.0.0.1:3111/app/config/equipe', { waitUntil: 'networkidle' });
const card = p.locator('.membro', { hasText: 'Carlos Pereira' });
console.log('Ana/Carlos têm "Senha esquecida":', await p.locator('.membro summary:has-text("Senha esquecida")').count(), '| a própria Maria tem:', await p.locator('.membro', { hasText: 'Maria Souza' }).locator('summary:has-text("Senha esquecida")').count());
await card.locator('summary:has-text("Senha esquecida")').click();
await card.locator('button:has-text("Gerar link")').click();
await p.waitForSelector('code');
const link = await card.locator('code').innerText();
console.log('link gerado:', link, '| WhatsApp:', await card.locator('a:has-text("WhatsApp")').count());
// 2) o empregado abre o link em outra aba (sem sessão) e define a senha
const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
const q = await c2.newPage();
q.on('console', (m) => { if (m.type() === 'error') msgs.push('q: ' + m.text().slice(0, 200)); });
await q.goto(link, { waitUntil: 'networkidle' });
console.log('título:', await q.locator('.tela-auth-cartao h1, .tela-auth-cartao h2, main h1, main h2, form').first().innerText().catch(async () => (await q.content()).includes('Criar nova senha') ? 'Criar nova senha' : (await q.content()).includes('Link inválido') ? 'Link inválido' : '?'));
await q.locator('input[type=password]').nth(0).fill('curta');
console.log('botão desabilitado com senha curta:', await q.locator('button[type=submit]').isDisabled());
await q.locator('input[type=password]').nth(0).fill('senhaNova123');
await q.locator('input[type=password]').nth(1).fill('senhaNova123');
await q.click('button[type=submit]');
await q.waitForTimeout(2500);
console.log('depois de salvar:', q.url());
// 3) link adulterado
await q.goto('http://127.0.0.1:3111/redefinir-senha?token_hash=x&type=recovery', { waitUntil: 'networkidle' });
console.log('link inválido ->', await q.locator('.tela-auth-cartao h1, .tela-auth-cartao h2, main h1, main h2, form').first().innerText().catch(async () => (await q.content()).includes('Criar nova senha') ? 'Criar nova senha' : (await q.content()).includes('Link inválido') ? 'Link inválido' : '?'));
// 4) esqueci minha senha na tela de login
const c3 = await b.newContext();
const r = await c3.newPage();
await r.goto('http://127.0.0.1:3111/login', { waitUntil: 'networkidle' });
await r.click('button:has-text("Esqueci minha senha")');
console.log('sem e-mail ->', await r.locator('p[style*="c-mb"]').innerText());
await r.fill('input[type=email]', 'gustavo@exemplo.com');
await r.click('button:has-text("Esqueci minha senha")'); await r.waitForTimeout(800);
console.log('com e-mail ->', await r.locator('p[role=status]').innerText());
console.log('erros de console (CSP etc.):', [...new Set(msgs)].slice(0, 4));
await b.close();
