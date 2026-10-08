// Senha provisória e verificação em duas etapas. Simulador: PROVISORIA=1 | MFA=1 AAL=aal1 | sem flags. Uso: node e2e/verificar-identidade.mjs provisoria|mfa-sessao-so-senha|ativar
import { chromium } from 'playwright';
// Uso: o simulador precisa estar com o cenário certo (PROVISORIA=1, ou MFA=1 AAL=aal1, ou nenhum).
const cenario = process.argv[2];
const cookie = (await (await fetch('http://127.0.0.1:54321/__sessao?papel=consultor&perfis=proprietario')).json()).cookie;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1100, height: 900 } });
await c.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
const p = await c.newPage();
const erros = []; p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)); });
const url = () => p.url().replace('http://127.0.0.1:3111', '');

if (cenario === 'provisoria') {
  await p.goto('http://127.0.0.1:3111/app/produtores', { waitUntil: 'networkidle' });
  console.log('rota /app/produtores →', (await p.locator('h1').first().innerText()), '| menu lateral:', await p.locator('.lateral').count(), '| URL:', url());
  await p.locator('input[type=password]').nth(0).fill('curta');
  console.log('botão com senha curta desabilitado:', await p.locator('button:has-text("Trocar senha")').isDisabled());
}

if (cenario === 'mfa-sessao-so-senha') {
  await p.goto('http://127.0.0.1:3111/app', { waitUntil: 'networkidle' });
  console.log('sessão só com senha →', url());
  await p.fill('input[inputmode=numeric]', '000000'); await p.click('button:has-text("Entrar")'); await p.waitForTimeout(800);
  console.log('código errado →', (await p.locator('[role=alert]').allInnerTexts()).join(' ').slice(0, 90), '| URL:', url());
  await p.fill('input[inputmode=numeric]', '123456'); await p.click('button:has-text("Entrar")'); await p.waitForTimeout(1500);
  console.log('código certo → navegou para', url(), '(no simulador a sessão volta aal1, então o layout pede de novo — o que importa é que o Auth aceitou o código)');
}

if (cenario === 'ativar') {
  await p.goto('http://127.0.0.1:3111/app/config', { waitUntil: 'networkidle' });
  await p.click('button:has-text("Ativar verificação em duas etapas")');
  await p.waitForSelector('img[alt*="QR"]');
  console.log('QR e chave aparecem:', await p.locator('img[alt*="QR"]').count() === 1, '|', (await p.locator('code').first().innerText()));
  await p.fill('#mfa_codigo', '000000'); await p.click('button:has-text("Confirmar e ativar")'); await p.waitForTimeout(700);
  console.log('código errado →', (await p.locator('p[role=alert]').innerText()).slice(0, 70));
  await p.fill('#mfa_codigo', '123456'); await p.click('button:has-text("Confirmar e ativar")'); await p.waitForTimeout(1200);
  console.log('código certo → estado:', (await p.locator('text=Ativada').count()) ? 'Ativada' : '(não ativou)');
}
console.log('erros de console:', [...new Set(erros)].slice(0, 3));
await b.close();
