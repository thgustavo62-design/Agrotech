// "Esqueci minha senha": o pedido sai de um navegador e o link do e-mail (tokens na âncora) é aberto em OUTRO, sem nada guardado.
import { chromium } from 'playwright';
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor')).json()).cookie;
const jwt = JSON.parse(Buffer.from(cookie.replace('base64-', ''), 'base64url').toString()).access_token;
const b = await chromium.launch();
const msgs = [];
// aparelho A: pede a redefinição (o e-mail padrão do Supabase sai daqui)
const a = await (await b.newContext()).newPage();
a.on('console', (m) => { if (m.type() === 'error') msgs.push('A: ' + m.text().slice(0, 200)); });
await a.goto('http://127.0.0.1:3111/login', { waitUntil: 'networkidle' });
await a.fill('input[type=email]', 'gustavo@exemplo.com');
await a.click('button:has-text("Esqueci minha senha")'); await a.waitForTimeout(800);
console.log('pedido:', await a.locator('p[role=status]').innerText());
// aparelho B (outro navegador, sem nada guardado): abre o link do e-mail, que traz os tokens na âncora
const q = await (await b.newContext()).newPage();
q.on('console', (m) => { if (m.type() === 'error') msgs.push('B: ' + m.text().slice(0, 200)); });
await q.goto(`http://127.0.0.1:3111/redefinir-senha#access_token=${jwt}&expires_in=3600&refresh_token=abcdef123456&token_type=bearer&type=recovery`, { waitUntil: 'networkidle' });
console.log('formulário aparece:', await q.locator('input[type=password]').count() === 2);
await q.locator('input[type=password]').nth(0).fill('senhaNova123');
await q.locator('input[type=password]').nth(1).fill('senhaNova123');
await q.click('button[type=submit]'); await q.waitForTimeout(2500);
console.log('depois de salvar (em outro aparelho):', q.url());
// link expirado: erro na âncora
const e = await (await b.newContext()).newPage();
await e.goto('http://127.0.0.1:3111/redefinir-senha#error=access_denied&error_code=otp_expired', { waitUntil: 'networkidle' });
await e.waitForTimeout(500);
console.log('link expirado ->', (await e.content()).includes('Link inválido') ? 'Link inválido (ok)' : 'NÃO tratou');
console.log('erros de console:', [...new Set(msgs)].slice(0, 3));
await b.close();
