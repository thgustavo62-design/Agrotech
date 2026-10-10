// Suíte de navegador (Playwright) SEM Supabase real: sobe o simulador (e2e/supabase-simulado.mjs) e o app já compilado
// e confere, de verdade, o que os testes de unidade não alcançam — CSP sem violações, telas bloqueando o que devem,
// cadastro de empregado, fila offline, senha provisória, segundo fator, conta desativada.
// Roda no CI (job "navegador") e na sua máquina:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x NEXT_PUBLIC_APP_URL=http://127.0.0.1:3111 npx next build
//   node e2e/suite.mjs            # todos os cenários     |     node e2e/suite.mjs mfa provisoria   # só alguns
// Cada cenário reinicia o simulador e o app (o app guarda em cache a chave pública do simulador).

import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const exigir = createRequire(import.meta.url);
const NEXT = exigir.resolve('next/dist/bin/next');
const SITE = 'http://127.0.0.1:3111';
const SIM = 'http://127.0.0.1:54321';
const AMBIENTE = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: SIM,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x',
  NEXT_PUBLIC_APP_URL: SITE,
  SUPABASE_SERVICE_ROLE_KEY: 'chave-de-teste',
};

const falhas = [];
let verificacoes = 0;
function conferir(nome, ok, detalhe = '') {
  verificacoes++;
  if (ok) console.log(`  ✓ ${nome}`);
  else { console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`); falhas.push(nome); }
}

// ---- processos ----
let filhos = [];
let logSim = '';
async function esperar(url, ms = 40000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  throw new Error(`não subiu: ${url}`);
}
async function subir(envSim = {}) {
  logSim = '';
  const sim = spawn(process.execPath, ['e2e/supabase-simulado.mjs'], { cwd: raiz, env: { ...AMBIENTE, LOG: '1', ...envSim }, stdio: ['ignore', 'pipe', 'pipe'] });
  sim.stdout.on('data', (d) => { logSim += d; });
  sim.stderr.on('data', (d) => { logSim += d; });
  await esperar(`${SIM}/__sessao`);
  const app = spawn(process.execPath, [NEXT, 'start', '-p', '3111'], { cwd: raiz, env: AMBIENTE, stdio: ['ignore', 'ignore', 'pipe'] });
  app.stderr.on('data', (d) => { if (process.env.E2E_VERBOSO) process.stderr.write(d); });
  filhos = [sim, app];
  await esperar(`${SITE}/login`);
}
function derrubar() {
  for (const f of filhos) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(f.pid), '/T', '/F'], { stdio: 'ignore' });
      else f.kill('SIGKILL');
    } catch { /* já saiu */ }
  }
  filhos = [];
}
const chamadas = (metodo, rota) => (logSim.match(new RegExp(`\\t${metodo}\\t${rota}\\b`, 'g')) ?? []).length;

// ---- navegador ----
let navegador;
async function pagina({ papel = 'consultor', perfis = 'proprietario', anonimo = false, largura = 1280, altura = 900, celular = false } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura }, isMobile: celular, hasTouch: celular });
  if (!anonimo) {
    const { cookie } = await (await fetch(`${SIM}/__sessao?papel=${papel}&perfis=${perfis}`)).json();
    await contexto.addCookies([{ name: 'sb-127-auth-token', value: cookie, domain: '127.0.0.1', path: '/' }]);
  }
  const p = await contexto.newPage();
  const problemas = [];
  p.on('console', (m) => { if (/Content Security Policy|Refused to|violates/i.test(m.text())) problemas.push(m.text().slice(0, 140)); });
  p.on('pageerror', (e) => problemas.push('erro de JS: ' + e.message.slice(0, 120)));
  return { p, contexto, problemas };
}
const corpo = (p) => p.locator('body').innerText();
/** espera o texto aparecer (avisos de server action chegam depois do redirect); não falha: quem confere é `conferir` */
const esperarTexto = (p, re) => p.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout: 8000 }).catch(() => {});
/** espera uma escrita chegar ao simulador (a server action roda no servidor e redireciona) */
async function esperarEscrita(metodo, rota, antes, ms = 6000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim && chamadas(metodo, rota) <= antes) await new Promise((r) => setTimeout(r, 150));
}
const ID_ANALISE = (n) => `a000000${n}-0000-0000-0000-000000000000`;

// ================== cenários ==================
const cenarios = {
  async padrao() {
    await subir();

    // páginas públicas e da área do consultor: hidratam e não violam a CSP
    const anon = await pagina({ anonimo: true });
    for (const rota of ['/login', '/cadastro', '/termos', '/privacidade', '/offline']) {
      await anon.p.goto(SITE + rota, { waitUntil: 'networkidle' });
    }
    conferir('páginas públicas sem violação de CSP nem erro de JS', anon.problemas.length === 0, anon.problemas.join(' | '));
    await anon.contexto.close();

    const dono = await pagina();
    for (const rota of ['/app', '/app/talhoes', '/app/propriedades', '/app/produtores', '/app/config', '/app/config/equipe', '/app/config/escritorio', '/app/agenda', '/app/laudos', '/app/analises']) {
      const r = await dono.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      if (r?.status() !== 200) conferir(`${rota} responde 200`, false, `status ${r?.status()}`);
    }
    conferir('área do consultor (10 telas) sem violação de CSP nem erro de JS', dono.problemas.length === 0, dono.problemas.join(' | '));

    // mapa (Leaflet + mosaicos) funciona sob a CSP
    await dono.p.goto(SITE + '/app/propriedades', { waitUntil: 'networkidle' });
    await dono.p.click('button.aba:has-text("Mapa")');
    await dono.p.waitForSelector('.leaflet-marker-icon', { timeout: 8000 }).catch(() => {});
    conferir('mapa mostra marcadores', (await dono.p.locator('.leaflet-marker-icon').count()) > 0);

    // painel inicial: gráficos reais (atividade, situação dos talhões) e mapa
    await dono.p.goto(SITE + '/app', { waitUntil: 'networkidle' });
    await dono.p.waitForSelector('.panorama .gr', { timeout: 8000 }).catch(() => {});
    const painelInicial = await dono.p.evaluate(() => ({
      graficos: document.querySelectorAll('.panorama svg.gr').length,
      barras: document.querySelectorAll('.panorama .gr-barra').length,
      centro: document.querySelector('.gr-centro-num')?.textContent ?? '',
      fatias: document.querySelectorAll('.panorama .gr-fatia').length,
      mapa: document.querySelectorAll('.panorama .leaflet-container').length,
      larguraDoc: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }));
    conferir('início: gráfico de atividade (3 séries × 6 meses), rosca com os 8 talhões em 3 situações e mapa', painelInicial.graficos === 2 && painelInicial.barras === 18 && painelInicial.centro === '8' && painelInicial.fatias === 3 && painelInicial.mapa === 1 && painelInicial.larguraDoc, JSON.stringify(painelInicial));
    const legenda = (await dono.p.locator('.gr-legenda').first().innerText()).replace(/\s+/g, ' ');
    conferir('início: a legenda soma o que existe (6 análises, 4 visitas, 3 recomendações)', /Análises 6/.test(legenda) && /Visitas 4/.test(legenda) && /Recomendações 3/.test(legenda), legenda);

    // cadastro direto de empregado (senha fraca barrada, senha gerada, mensagem de WhatsApp com o acesso)
    await dono.p.goto(SITE + '/app/config/equipe', { waitUntil: 'networkidle' });
    await dono.p.fill('#ce_nome', 'João da Silva');
    await dono.p.fill('#ce_email', 'joao@exemplo.com');
    await dono.p.fill('#ce_senha', 'curta');
    await dono.p.click('button:has-text("Cadastrar empregado")');
    conferir('senha fraca é barrada', /pelo menos 8 caracteres/.test(await dono.p.locator('p[role=alert]').first().innerText()));
    await dono.p.click('form:has(#ce_senha) button:has-text("Gerar senha")');
    const senha = await dono.p.inputValue('#ce_senha');
    await dono.p.locator('label[for="novo-campo"]').click();
    await dono.p.click('button:has-text("Cadastrar empregado")');
    await dono.p.waitForSelector('text=foi cadastrado', { timeout: 8000 }).catch(() => {});
    const wa = decodeURIComponent((await dono.p.locator('.aviso[role=status] a:has-text("WhatsApp")').getAttribute('href').catch(() => '')) ?? '');
    conferir('empregado cadastrado e acesso (e-mail + senha) pronto para enviar', wa.includes('joao@exemplo.com') && wa.includes(senha) && /primeiro acesso/.test(wa));
    conferir('o servidor criou a conta e colocou no escritório', chamadas('POST', 'auth:admin/users') >= 1 && chamadas('PATCH', 'profiles') >= 1);

    // senha esquecida de um empregado e remoção
    const carlos = dono.p.locator('.membro', { hasText: 'Carlos Pereira' });
    await carlos.locator('summary:has-text("Senha esquecida")').click();
    await carlos.locator('button:has-text("Gerar senha")').click();
    await carlos.locator('button:has-text("Definir nova senha")').click();
    await carlos.locator('text=alterada').waitFor({ timeout: 8000 }).catch(() => {});
    conferir('proprietário define nova senha do empregado', (await carlos.locator('.aviso').first().innerText().catch(() => '')).includes('alterada'));
    const ana = dono.p.locator('.membro', { hasText: 'Ana Lima' });
    const antes = chamadas('PUT', 'auth:admin/users');
    await ana.locator('summary:has-text("Remover do escritório")').click();
    await ana.locator('button:has-text("Confirmar remoção")').click();
    await dono.p.waitForTimeout(1500);
    conferir('remoção bloqueia a conta no Auth e desativa o perfil', chamadas('PUT', 'auth:admin/users') > antes);
    conferir('o proprietário não tem "Senha esquecida" no próprio cartão', (await dono.p.locator('.membro', { hasText: 'Maria Souza' }).locator('summary:has-text("Senha esquecida")').count()) === 0);

    // análise completa emite (a tela não bloqueia)
    await dono.p.goto(`${SITE}/app/analises/${ID_ANALISE(2)}`, { waitUntil: 'networkidle' });
    conferir('análise completa de 0–20 cm: botão "Emitir laudo" habilitado e sem aviso', !(await dono.p.locator('button:has-text("Emitir laudo")').isDisabled()) && (await dono.p.locator('.aviso[role=alert]').count()) === 0);
    await dono.contexto.close();

    // perfil Campo: sem financeiro, com mensagem humana
    const campo = await pagina({ perfis: 'campo' });
    await campo.p.goto(SITE + '/app/financeiro-escritorio', { waitUntil: 'networkidle' });
    conferir('perfil Campo vê "acesso restrito" no financeiro, sem o item no menu', /Acesso restrito/i.test(await corpo(campo.p)) && (await campo.p.locator('.lateral a[href="/app/financeiro-escritorio"]').count()) === 0);

    // fila offline: salva sem sinal, guarda no aparelho, envia quando volta
    await campo.p.goto(SITE + '/app/talhoes', { waitUntil: 'networkidle' });
    const href = await campo.p.locator('a[href^="/app/talhoes/"]').first().getAttribute('href');
    await campo.p.goto(SITE + href, { waitUntil: 'networkidle' });
    await campo.p.waitForTimeout(2500);
    await campo.p.reload({ waitUntil: 'networkidle' });
    await campo.p.click('button.aba:has-text("Monitoramento")');
    await campo.contexto.setOffline(true);
    await campo.p.waitForTimeout(400);
    conferir('faixa "sem sinal" aparece offline', /Sem sinal/.test(await campo.p.locator('.aviso-sem-sinal').innerText().catch(() => '')));
    await campo.p.fill('#v_data', new Date().toISOString().slice(0, 10));
    await campo.p.fill('#v_obs', 'visita sem sinal');
    await campo.p.click('button:has-text("Salvar visita")');
    await campo.p.waitForTimeout(1200);
    const guardados = () => campo.p.evaluate(() => new Promise((ok) => { const r = indexedDB.open('agrotech-fila', 1); r.onsuccess = () => { const q = r.result.transaction('pendentes').objectStore('pendentes').count(); q.onsuccess = () => ok(q.result); }; }));
    conferir('visita offline fica guardada no aparelho', (await guardados()) === 1);
    await campo.contexto.setOffline(false);
    await campo.p.waitForTimeout(4000);
    conferir('ao voltar o sinal, a visita é enviada uma vez e a fila esvazia', chamadas('POST', 'visitas') === 1 && (await guardados()) === 0);
    await campo.contexto.close();
  },

  async incompleta() {
    await subir({ INCOMPLETA: '1' });
    const { p, contexto } = await pagina({ perfis: 'agronomico' });
    await p.goto(`${SITE}/app/analises/${ID_ANALISE(1)}`, { waitUntil: 'networkidle' });
    const texto = await corpo(p);
    conferir('análise sem Ca e Mg: aviso diz o que falta e o botão fica desabilitado', /Cálcio \(Ca\)/.test(texto) && /Magnésio \(Mg\)/.test(texto) && (await p.locator('button:has-text("Emitir laudo")').isDisabled()));
    await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /Emitir laudo/.test(x.textContent)).forEach((x) => x.removeAttribute('disabled')));
    await p.click('button:has-text("Emitir laudo")');
    await p.waitForTimeout(1800);
    conferir('o servidor recusa mesmo com o botão forçado e não grava recomendação', /Não é possível emitir: faltam/.test(await corpo(p)) && chamadas('POST', 'recomendacoes') === 0);
    await contexto.close();
  },

  async camada() {
    await subir({ SUB2040: '1' });
    const { p, contexto } = await pagina({ perfis: 'agronomico' });
    await p.goto(`${SITE}/app/analises/${ID_ANALISE(2)}`, { waitUntil: 'networkidle' });
    conferir('amostra de 20–40 cm: não gera recomendação (aviso + botão desabilitado)', /20–40 cm/.test(await corpo(p)) && (await p.locator('button:has-text("Emitir laudo")').isDisabled()));
    await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => /Emitir laudo/.test(x.textContent)).forEach((x) => x.removeAttribute('disabled')));
    await p.click('button:has-text("Emitir laudo")');
    await p.waitForTimeout(1800);
    conferir('o servidor recusa a amostra de 20–40 cm e não grava recomendação', /subsuperfície/.test(await corpo(p)) && chamadas('POST', 'recomendacoes') === 0);
    await p.goto(`${SITE}/app/analises/${ID_ANALISE(1)}`, { waitUntil: 'networkidle' });
    conferir('a análise de 0–20 cm continua liberada', !(await p.locator('button:has-text("Emitir laudo")').isDisabled()));
    await contexto.close();
  },

  async sem_crea() {
    await subir({ SEM_CREA: '1' });
    const { p, contexto } = await pagina({ perfis: 'agronomico' });
    await p.goto(`${SITE}/app/analises/${ID_ANALISE(2)}`, { waitUntil: 'networkidle' });
    await p.click('button:has-text("Emitir laudo")');
    await p.waitForTimeout(1800);
    conferir('sem CREA do responsável o laudo não sai', /informe o CREA/.test(await corpo(p)) && chamadas('POST', 'recomendacoes') === 0);
    await contexto.close();
  },

  async provisoria() {
    await subir({ PROVISORIA: '1' });
    const { p, contexto, problemas } = await pagina({ perfis: 'agronomico' });
    await p.goto(`${SITE}/app/produtores`, { waitUntil: 'networkidle' });
    conferir('senha provisória: só aparece "Crie a sua senha", sem menu nem dados', /Crie a sua senha/.test(await corpo(p)) && (await p.locator('.lateral').count()) === 0);
    await p.locator('input[type=password]').nth(0).fill('curta');
    conferir('senha curta não habilita o botão', await p.locator('button:has-text("Trocar senha")').isDisabled());
    conferir('sem erro de CSP/JS', problemas.length === 0, problemas.join(' | '));
    await contexto.close();
  },

  async mfa() {
    await subir({ MFA: '1', AAL: 'aal1' });
    const { p, contexto } = await pagina();
    await p.goto(`${SITE}/app`, { waitUntil: 'networkidle' });
    conferir('segundo fator ligado e sessão só com senha → pede o código', p.url().endsWith('/verificar-codigo'));
    await p.fill('input[inputmode=numeric]', '000000');
    await p.click('button:has-text("Entrar")');
    await p.waitForTimeout(800);
    conferir('código errado é recusado', /Código incorreto/.test(await corpo(p)) && p.url().endsWith('/verificar-codigo'));
    await contexto.close();
  },

  async ativar_mfa() {
    await subir();
    const { p, contexto } = await pagina();
    await p.goto(`${SITE}/app/config`, { waitUntil: 'networkidle' });
    await p.click('button:has-text("Ativar verificação em duas etapas")');
    await p.waitForSelector('img[alt*="QR"]');
    conferir('ativação mostra QR code e a chave', /JBSWY3DPEHPK3PXP/.test(await corpo(p)));
    await p.fill('#mfa_codigo', '000000');
    await p.click('button:has-text("Confirmar e ativar")');
    await p.waitForTimeout(700);
    conferir('código errado não ativa', /Código incorreto/.test(await corpo(p)));
    await p.fill('#mfa_codigo', '123456');
    await p.click('button:has-text("Confirmar e ativar")');
    await p.waitForTimeout(1200);
    conferir('código certo ativa', (await p.locator('text=Ativada').count()) > 0);
    await contexto.close();
  },

  async desativado() {
    await subir({ DESATIVADO: '1' });
    const { p, contexto } = await pagina({ perfis: 'campo' });
    for (const rota of ['/app', '/app/produtores', '/app/config/equipe']) {
      await p.goto(SITE + rota, { waitUntil: 'networkidle' });
      conferir(`conta desativada em ${rota}: "Seu acesso foi removido", sem menu`, /Seu acesso foi removido/.test(await corpo(p)) && (await p.locator('.lateral').count()) === 0);
    }
    await contexto.close();
  },

  async sites() {
    await subir();
    const AC = { video: '62aaaaaa-0000-0000-0000-000000000001' };

    // a tela de login oferece os três sites e muda de cara a cada escolha
    const anon = await pagina({ anonimo: true });
    await anon.p.goto(SITE + '/login', { waitUntil: 'networkidle' });
    conferir('o login oferece os três sites', (await anon.p.locator('[data-site-opcao]').count()) === 3);
    await anon.p.click('[data-site-opcao=academy]');
    await esperarTexto(anon.p, /Entrar na Academy/);
    conferir('escolher Academy troca o texto e a cor da entrada', /Entrar na Academy/.test(await corpo(anon.p)) && (await anon.p.locator('.tela-auth[data-site=academy]').count()) === 1);
    await anon.p.click('[data-site-opcao=connect]');
    await esperarTexto(anon.p, /Entrar no Connect/);
    conferir('escolher Connect troca de novo', /Entrar no Connect/.test(await corpo(anon.p)) && (await anon.p.locator('.tela-auth[data-site=connect]').count()) === 1);

    // entrar pela Academy leva à Academy (não ao painel da Assistência)
    await anon.p.click('[data-site-opcao=academy]');
    await esperarTexto(anon.p, /Entrar na Academy/);
    await anon.p.fill('input[type=email]', 'maria@exemplo.com');
    await anon.p.fill('input[type=password]', 'senha1234');
    await anon.p.click('button[type=submit]:has-text("Entrar")');
    await anon.p.waitForURL(/\/academy$/, { timeout: 15000 }).catch(() => {});
    conferir('entrar pela Academy abre o site da Academy', /\/academy$/.test(anon.p.url()) && (await anon.p.locator('.site-academy').count()) === 1, anon.p.url());
    conferir('a Academy tem o molde próprio (barra no topo, sem menu lateral da Assistência)', (await anon.p.locator('.ac-topo').count()) === 1 && (await anon.p.locator('.lateral').count()) === 0);

    // trocar de site
    await anon.p.goto(SITE + '/sites', { waitUntil: 'networkidle' });
    conferir('"Trocar de site" mostra os três cartões', (await anon.p.locator('.hub-cartao').count()) === 3);
    await anon.p.locator('.hub-cartao[data-site=assistencia]').click();
    await anon.p.waitForURL(/\/app$/, { timeout: 15000 }).catch(() => {});
    conferir('o cartão da Assistência leva ao painel do escritório', /\/app$/.test(anon.p.url()) && (await anon.p.locator('.lateral').count()) === 1, anon.p.url());
    conferir('o menu da Assistência não tem mais a Academy', !/\bAcademy\b/.test(await anon.p.locator('.lateral').innerText()));
    await anon.p.goto(SITE + '/sites', { waitUntil: 'networkidle' });
    await anon.p.locator('.hub-cartao[data-site=connect]').click();
    await anon.p.waitForURL(/\/connect$/, { timeout: 15000 }).catch(() => {});
    conferir('o cartão do Connect leva ao Connect', /\/connect$/.test(anon.p.url()), anon.p.url());
    conferir('entrar/trocar de site: sem violação de CSP nem erro de JS', anon.problemas.length === 0, anon.problemas.join(' | '));
    await anon.contexto.close();

    // sem login, cada site manda para a entrada do SEU site
    const sem = await pagina({ anonimo: true });
    for (const [rota, site] of [['/academy', 'academy'], ['/academy/cursos', 'academy'], ['/connect', 'connect'], ['/app', 'assistencia']]) {
      await sem.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      conferir(`sem login, ${rota} vai para a entrada do site ${site}`, sem.p.url().includes(`/login`) && sem.p.url().includes(`site=${site}`), sem.p.url());
    }
    await sem.p.goto(SITE + '/produtor/login', { waitUntil: 'networkidle' });
    conferir('o login antigo do produtor continua valendo (redireciona para a entrada única)', sem.p.url().includes('/login?site=assistencia') && sem.p.url().includes('como=produtor'), sem.p.url());
    await sem.contexto.close();

    // produtor: o portal da Assistência não tem mais "Universidade"
    const pr = await pagina({ papel: 'produtor' });
    await pr.p.goto(SITE + '/produtor', { waitUntil: 'networkidle' });
    conferir('o portal do produtor não tem Universidade, e oferece trocar de site', !/Universidade/.test(await corpo(pr.p)) && (await pr.p.locator('a:has-text("trocar de site")').count()) >= 1);
    await pr.contexto.close();
    void AC;
  },

  async academy_aluno() {
    await subir();
    const AC = { video: '62aaaaaa-0000-0000-0000-000000000001', artigo: '62aaaaaa-0000-0000-0000-000000000002', material: '62aaaaaa-0000-0000-0000-000000000003', rascunho: '62aaaaaa-0000-0000-0000-000000000004', noticia: '62aaaaaa-0000-0000-0000-000000000005' };
    const CU = { cafe: '62cccccc-0000-0000-0000-000000000001', pragas: '62cccccc-0000-0000-0000-000000000002', rascunho: '62cccccc-0000-0000-0000-000000000003' };
    const pr = await pagina({ papel: 'produtor' });

    // vitrine
    await pr.p.goto(SITE + '/academy', { waitUntil: 'networkidle' });
    let t = await corpo(pr.p);
    conferir('início: hero, busca e faixa de números', (await pr.p.locator('.ac-hero').count()) === 1 && /Aprenda no seu ritmo/.test(t) && (await pr.p.locator('.ac-busca-grande input').count()) === 1);
    conferir('início: "Continue de onde parou" com o curso em andamento', /continue de onde parou/i.test(t) && /Calagem e adubação do café na prática/.test(t));
    conferir('início: "Indicado pelo seu agrônomo" e temas', /indicado pelo seu agrônomo/i.test(t) && (await pr.p.locator('.ac-tema').count()) >= 2);
    conferir('início: notícias do agro com fonte', /Notícias do agro/.test(t) && /Chuva volta ao Norte do ES/.test(t));
    conferir('início: o curso em rascunho não aparece', !/Curso em preparação/.test(t));

    // catálogo
    await pr.p.goto(SITE + '/academy/cursos', { waitUntil: 'networkidle' });
    conferir('catálogo mostra os 2 cursos publicados (não o rascunho)', (await pr.p.locator('.ac-cartao').count()) === 2 && !/Curso em preparação/.test(await corpo(pr.p)));
    await pr.p.goto(SITE + '/academy/cursos?q=pragas', { waitUntil: 'networkidle' });
    conferir('busca por "pragas" acha 1 curso', (await pr.p.locator('.ac-cartao').count()) === 1);
    await pr.p.goto(SITE + '/academy/cursos?tema=calagem&nivel=basico', { waitUntil: 'networkidle' });
    conferir('filtros de tema e nível combinam', (await pr.p.locator('.ac-cartao').count()) === 1);
    await pr.p.goto(SITE + '/academy/cursos?q=zzzz', { waitUntil: 'networkidle' });
    conferir('busca sem resultado explica', /Nada encontrado/.test(await corpo(pr.p)));

    // página do curso
    await pr.p.goto(SITE + '/academy/cursos/' + CU.cafe, { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    conferir('curso: título, carga prevista, progresso do aluno', /Calagem e adubação do café na prática/.test(t) && /1 de 3 aulas concluídas \(33%\)/.test(t));
    conferir('curso: módulos e aulas, com a concluída marcada', (await pr.p.locator('.ac-modulo').count()) === 2 && (await pr.p.locator('.ac-linha[data-feita=true]').count()) === 1);
    conferir('curso: o aluno continua de onde parou e vê a indicação', /Continuar o curso/.test(t) && /Indicado pelo seu agrônomo/.test(t) && /Faça este curso antes da safra/.test(t));
    conferir('curso: avisa que o certificado é de participação', /Certificado de participação/.test(t));
    await pr.p.goto(SITE + '/academy/cursos/' + CU.rascunho, { waitUntil: 'networkidle' });
    conferir('curso em rascunho não abre para o aluno', !/Curso em preparação/.test(await corpo(pr.p)));

    // aula em vídeo: o player só carrega depois do clique
    await pr.p.goto(SITE + `/academy/aula/${AC.video}?curso=${CU.cafe}`, { waitUntil: 'networkidle' });
    conferir('aula em vídeo: o player não carrega sozinho', (await pr.p.locator('.ac-video iframe').count()) === 0 && (await pr.p.locator('.ac-video-fachada').count()) === 1);
    await pr.p.click('.ac-video-fachada');
    await pr.p.waitForSelector('.ac-video iframe', { timeout: 5000 }).catch(() => {});
    const origem = await pr.p.locator('.ac-video iframe').getAttribute('src').catch(() => '');
    const permissoes = (await pr.p.locator('.ac-video iframe').getAttribute('sandbox').catch(() => null)) ?? '';
    conferir('depois do clique, o iframe é do YouTube sem cookies e com sandbox (sem navegar a página)', (origem ?? '').startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ') && permissoes.includes('allow-scripts') && !permissoes.includes('allow-top-navigation'), `${origem} | sandbox=${permissoes}`);
    conferir('aula: roteiro do curso ao lado, com a aula atual marcada', (await pr.p.locator('.ac-roteiro .ac-linha[data-atual=true]').count()) === 1);
    const antes = chamadas('POST', 'academy_progresso');
    await pr.p.click('button:has-text("Concluir e ir para a próxima")');
    // a ação roda no servidor e redireciona: espera o POST chegar ao simulador (e a página assentar) antes de conferir
    for (let i = 0; i < 40 && chamadas('POST', 'academy_progresso') <= antes; i++) await new Promise((r) => setTimeout(r, 150));
    await pr.p.waitForLoadState('networkidle').catch(() => {});
    conferir('"Concluir e ir para a próxima" grava o progresso e segue no curso', chamadas('POST', 'academy_progresso') > antes && /\/academy\/aula\//.test(pr.p.url()), `antes=${antes} depois=${chamadas('POST', 'academy_progresso')} url=${pr.p.url()}`);

    // outros tipos de aula
    await pr.p.goto(SITE + `/academy/aula/${AC.artigo}?curso=${CU.cafe}`, { waitUntil: 'networkidle' });
    conferir('artigo: texto com parágrafos', /Primeiro parágrafo da aula/.test(await corpo(pr.p)) && /Segundo parágrafo/.test(await corpo(pr.p)));
    await pr.p.goto(SITE + `/academy/aula/${AC.noticia}`, { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    conferir('notícia: resumo do escritório, fonte e link da matéria original', /Resumo do escritório/.test(t) && /Incaper/.test(t) && (await pr.p.locator('a:has-text("Ler a matéria original")').count()) === 1);
    const rel = await pr.p.locator('a:has-text("Ler a matéria original")').getAttribute('rel');
    conferir('link externo abre em outra aba sem repassar a origem', /noopener/.test(rel ?? ''));
    await pr.p.goto(SITE + `/academy/aula/${AC.rascunho}`, { waitUntil: 'networkidle' });
    conferir('aula em rascunho não abre para o aluno', !/ferrugem do cafeeiro/i.test(await corpo(pr.p)));

    // meus cursos e certificado
    await pr.p.goto(SITE + '/academy/meus-cursos', { waitUntil: 'networkidle' });
    conferir('meus cursos: em andamento mostra o curso do café com progresso', (await pr.p.locator('.ac-cartao').count()) === 1 && /33% concluído/.test(await corpo(pr.p)));
    await pr.p.goto(SITE + '/academy/meus-cursos?aba=concluidos', { waitUntil: 'networkidle' });
    conferir('meus cursos: concluídos mostram o certificado', /Ver certificado/.test(await corpo(pr.p)));
    await pr.p.goto(SITE + '/academy/meus-cursos?aba=indicados', { waitUntil: 'networkidle' });
    conferir('meus cursos: indicados mostram curso e aula com o recado', /Faça este curso antes da safra/.test(await corpo(pr.p)) && (await pr.p.locator('.ac-cartao, .ac-aula-cartao').count()) >= 2);
    await pr.p.goto(SITE + '/academy/certificados/62fffff2-0000-0000-0000-000000000001', { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    conferir('certificado: aluno, curso, responsável e código', /José da Silva Pereira/.test(t) && /Manejo de pragas e doenças do cafeeiro/.test(t) && /AT-1A2B3-C4D5E/.test(t) && /CREA ES-12345/.test(t));
    conferir('certificado: diz que é de participação e não equivale a certificação', /não equivale a certificação acadêmica/i.test(t));
    await pr.p.goto(SITE + '/academy/noticias', { waitUntil: 'networkidle' });
    conferir('notícias: lista com a notícia do escritório', (await pr.p.locator('.ac-aula-cartao').count()) === 1);
    conferir('o aluno não vê o Estúdio no menu', (await pr.p.locator('.ac-menu a:has-text("Estúdio")').count()) === 0);
    await pr.p.goto(SITE + '/academy/estudio', { waitUntil: 'networkidle' });
    conferir('o aluno que abre o Estúdio volta para a vitrine', /\/academy$/.test(pr.p.url()), pr.p.url());
    conferir('site do aluno: sem violação de CSP nem erro de JS', pr.problemas.length === 0, pr.problemas.join(' | '));
    await pr.contexto.close();

    // celular: sem rolagem lateral e com o menu à mão
    const cel = await pagina({ papel: 'produtor', largura: 390, altura: 844, celular: true });
    for (const rota of ['/academy', '/academy/cursos', `/academy/cursos/${CU.cafe}`, `/academy/aula/${AC.artigo}?curso=${CU.cafe}`]) {
      await cel.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      const larguras = await cel.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
      conferir(`celular: ${rota.split('?')[0].replace(/[0-9a-f-]{36}/, ':id')} não rola para o lado`, larguras.doc <= larguras.janela + 1, JSON.stringify(larguras));
    }
    await cel.contexto.close();
  },

  async academy_estudio() {
    await subir();
    const AC = { video: '62aaaaaa-0000-0000-0000-000000000001', rascunho: '62aaaaaa-0000-0000-0000-000000000004' };
    const CU = { cafe: '62cccccc-0000-0000-0000-000000000001', rascunho: '62cccccc-0000-0000-0000-000000000003' };

    const ag = await pagina({ perfis: 'agronomico' });
    await ag.p.goto(SITE + '/academy', { waitUntil: 'networkidle' });
    conferir('a equipe vê o Estúdio no menu e a vitrine como aluno (com aviso de prévia nos cursos)', (await ag.p.locator('.ac-menu a:has-text("Estúdio")').count()) === 1);
    await ag.p.goto(SITE + '/academy/cursos/' + CU.cafe, { waitUntil: 'networkidle' });
    conferir('a equipe vê o curso como o aluno vê, sem gravar progresso', /só são gravados para produtores/.test(await corpo(ag.p)));
    await ag.p.goto(SITE + '/academy/meus-cursos', { waitUntil: 'networkidle' });
    conferir('"Meus cursos" é dos alunos: a equipe é orientada ao Estúdio', /Esta área é dos alunos/.test(await corpo(ag.p)));

    await ag.p.goto(SITE + '/academy/estudio', { waitUntil: 'networkidle' });
    let t = await corpo(ag.p);
    conferir('estúdio: visão geral com números e o acompanhamento dos alunos', /Visão geral da Academy/.test(t) && /Quem está aprendendo/i.test(t) && /José da Silva Pereira/.test(t));

    await ag.p.goto(SITE + '/academy/estudio/cursos', { waitUntil: 'networkidle' });
    conferir('estúdio: lista os 3 cursos (inclusive o rascunho)', (await ag.p.locator('.lista .item').count()) === 3);

    await ag.p.goto(SITE + '/academy/estudio/cursos/' + CU.cafe, { waitUntil: 'networkidle' });
    t = await corpo(ag.p);
    conferir('curso no estúdio: dados, estrutura e alunos', /Dados do curso/.test(t) && /Módulos e aulas/.test(t) && /Alunos \(1\)/.test(t));
    conferir('curso no estúdio: 2 módulos com 3 aulas, na ordem', (await ag.p.locator('#estrutura .ac-modulo').count()) === 2 && (await ag.p.locator('#estrutura .ac-linha').count()) === 3);
    const largura = await ag.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
    conferir('curso no estúdio: a página cabe na tela (sem rolagem lateral)', largura.doc <= largura.janela + 1, JSON.stringify(largura));
    conferir('curso no estúdio: pode indicar a produtores', /Indicar a produtores/.test(t) && (await ag.p.locator('button:has-text("Indicar")').count()) === 1);
    await ag.p.click('button:has-text("Indicar")');
    await esperarTexto(ag.p, /pelo menos um produtor/);
    conferir('indicar o curso sem escolher produtor é recusado', /pelo menos um produtor/.test(await corpo(ag.p)));

    // criar curso: o servidor explica o erro
    await ag.p.goto(SITE + '/academy/estudio/cursos/novo', { waitUntil: 'networkidle' });
    await ag.p.fill('#titulo', 'ab');
    await ag.p.click('button[name=intencao][value=rascunho]');
    await esperarTexto(ag.p, /pelo menos 3 letras/);
    conferir('curso com título curto é recusado com mensagem clara', /pelo menos 3 letras/.test(await corpo(ag.p)));
    await ag.p.goto(SITE + '/academy/estudio/cursos/novo', { waitUntil: 'networkidle' });
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Quem tem a cultura' }).click();
    await ag.p.fill('#titulo', 'Curso por cultura sem cultura');
    await ag.p.click('button[name=intencao][value=rascunho]');
    await esperarTexto(ag.p, /preencha o campo/);
    conferir('"por cultura" sem a cultura é recusado', /preencha o campo "Cultura"/.test(await corpo(ag.p)));

    // conteúdos (biblioteca do estúdio)
    await ag.p.goto(SITE + '/academy/estudio/conteudos', { waitUntil: 'networkidle' });
    conferir('biblioteca do estúdio lista os 5 conteúdos', (await ag.p.locator('.lista .item').count()) === 5);
    await ag.p.goto(SITE + '/academy/estudio/conteudos?q=adubacao', { waitUntil: 'networkidle' });
    conferir('a busca ignora acento', (await ag.p.locator('.lista .item').count()) === 1);
    await ag.p.goto(SITE + '/academy/estudio/conteudos/novo', { waitUntil: 'networkidle' });
    conferir('conteúdo: 4 tipos, incluindo Notícia', (await ag.p.locator('.opcoes-tipo').first().locator('label').count()) === 4);
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Notícia' }).first().click();
    conferir('notícia pede resumo, fonte, data e região', (await ag.p.locator('#data_materia').count()) === 1 && (await ag.p.locator('#regiao').count()) === 1 && /Resumo com as suas palavras/.test(await corpo(ag.p)));
    await ag.p.fill('#titulo', 'Notícia sem nada');
    await ag.p.click('button[name=intencao][value=publicar]');
    await esperarTexto(ag.p, /link da matéria original/);
    conferir('publicar notícia sem link é recusado com mensagem clara', /link da matéria original/.test(await corpo(ag.p)));
    await ag.p.goto(SITE + '/academy/estudio/conteudos/' + AC.video, { waitUntil: 'networkidle' });
    conferir('conteúdo publicado mostra indicação e acompanhamento', /Indicar a produtores/.test(await corpo(ag.p)));
    await ag.p.goto(SITE + '/academy/estudio/conteudos/' + AC.rascunho, { waitUntil: 'networkidle' });
    conferir('conteúdo em rascunho não oferece indicação', /Só conteúdo publicado pode ser indicado/.test(await corpo(ag.p)));
    conferir('estúdio: sem violação de CSP nem erro de JS', ag.problemas.length === 0, ag.problemas.join(' | '));
    await ag.contexto.close();

    // campo: indica, mas não monta
    const campo = await pagina({ perfis: 'campo' });
    await campo.p.goto(SITE + '/academy/estudio/cursos', { waitUntil: 'networkidle' });
    conferir('campo não vê "Novo curso"', (await campo.p.locator('a:has-text("Novo curso")').count()) === 0);
    await campo.p.goto(SITE + '/academy/estudio/cursos/novo', { waitUntil: 'networkidle' });
    conferir('campo que abre "novo curso" volta para a lista', /\/academy\/estudio\/cursos$/.test(campo.p.url()), campo.p.url());
    await campo.p.goto(SITE + '/academy/estudio/cursos/' + CU.cafe, { waitUntil: 'networkidle' });
    conferir('campo vê o curso só para leitura, mas pode indicar', /só consulta/.test(await corpo(campo.p)) && (await campo.p.locator('button[name=intencao]').count()) === 0 && (await campo.p.locator('button:has-text("Indicar")').count()) === 1);
    await campo.contexto.close();

    // consulta: lê, não indica nem edita
    const leitura = await pagina({ perfis: 'leitura' });
    await leitura.p.goto(SITE + '/academy', { waitUntil: 'networkidle' });
    conferir('consulta não tem o Estúdio no menu', (await leitura.p.locator('.ac-menu a:has-text("Estúdio")').count()) === 0);
    await leitura.contexto.close();
  },

  async connect_produtor() {
    await subir();
    const AT = { folhas: '63aaaaaa-0000-0000-0000-000000000001', calagem: '63aaaaaa-0000-0000-0000-000000000002', laudo: '63aaaaaa-0000-0000-0000-000000000003', broca: '63aaaaaa-0000-0000-0000-000000000004' };
    const pr = await pagina({ papel: 'produtor' });

    // início
    await pr.p.goto(SITE + '/connect', { waitUntil: 'networkidle' });
    let t = await corpo(pr.p);
    conferir('início: convite para pedir ajuda e botão "Fazer um pedido"', (await pr.p.locator('.cn-hero').count()) === 1 && /Como podemos ajudar, José\?/.test(t) && (await pr.p.locator('a:has-text("Fazer um pedido")').count()) === 1);
    conferir('início: destaca o pedido em que o técnico espera resposta', /O técnico precisa de uma informação sua/.test(await pr.p.locator('.cn-destaque').innerText().catch(() => '')) && /Dúvida sobre a calagem/.test(await pr.p.locator('.cn-destaque').innerText().catch(() => '')));
    conferir('início: só os pedidos do próprio produtor (3), nunca o de outro', (await pr.p.locator('.cn-pedido').count()) === 3 && !/Assunto de outro produtor|Visita para avaliar a broca/.test(t));
    conferir('menu do produtor: Início, Meus pedidos, Novo pedido e Avisos (com contagem)', (await pr.p.locator('.cn-menu a').count()) === 4 && (await pr.p.locator('.cn-contagem').count()) === 1 && (await pr.p.locator('.cn-menu a:has-text("Fila")').count()) === 0);

    // lista
    await pr.p.goto(SITE + '/connect/pedidos', { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    conferir('meus pedidos: 2 em aberto e 1 resolvido, na linguagem do produtor', /Em aberto \(2\)/.test(t) && /Resolvidos e arquivados \(1\)/.test(t) && /Precisamos de você/.test(t) && /Em atendimento/.test(t) && !/Em acompanhamento|Aguardando o produtor/.test(t));

    // pedido com conversa: nota interna e dados da equipe nunca aparecem
    await pr.p.goto(SITE + '/connect/pedidos/' + AT.folhas, { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    conferir('pedido: 2 mensagens (a nota interna da equipe não aparece)', (await pr.p.locator('.cn-msg').count()) === 2 && !/nota interna|nitrogênio/i.test(t));
    await pr.p.locator('.cn-anexos img').first().scrollIntoViewIfNeeded();
    await pr.p.waitForFunction(() => { const i = document.querySelector('.cn-anexos img'); return Boolean(i && i.complete); }, null, { timeout: 5000 }).catch(() => {});
    conferir('pedido: a foto enviada carrega (link assinado sob a CSP)', await pr.p.evaluate(() => { const i = document.querySelector('.cn-anexos img'); return Boolean(i && i.complete && i.naturalWidth > 0); }));
    conferir('pedido: histórico mostra situação e prazo, mas não responsável nem prioridade', /Situação: Em atendimento/.test(t) && /Prazo previsto/.test(t) && !/Responsável|Prioridade/.test(await pr.p.locator('.cn-tempo').innerText().catch(() => '')));
    conferir('pedido: a equipe aparece como "Seu técnico" (sem nome de colega)', /Seu técnico/.test(t) && !/Carlos Pereira/.test(t));
    let antes = chamadas('POST', 'atendimento_mensagens');
    await pr.p.fill('.cn-resposta textarea', 'Segue mais informação sobre o talhão.');
    await pr.p.click('.cn-resposta button[type=submit]');
    await esperarEscrita('POST', 'atendimento_mensagens', antes);
    await esperarTexto(pr.p, /Segue mais informação sobre o talhão/);
    conferir('responder grava a mensagem e ela aparece na conversa', chamadas('POST', 'atendimento_mensagens') > antes && /Segue mais informação sobre o talhão/.test(await corpo(pr.p)));

    // precisa de resposta: responder tira da fila de espera
    await pr.p.goto(SITE + '/connect/pedidos/' + AT.calagem, { waitUntil: 'networkidle' });
    conferir('pedido aguardando o produtor avisa que ele precisa responder', /O técnico precisa de uma informação sua — responda abaixo/.test(await corpo(pr.p)));
    await pr.p.fill('.cn-resposta textarea', 'Foi em março.');
    await pr.p.click('.cn-resposta button[type=submit]');
    await esperarTexto(pr.p, /Foi em março/);
    conferir('responder volta o pedido para "Em atendimento"', /Em atendimento/.test(await pr.p.locator('.cn-selos').innerText()) && !/Precisamos de você/.test(await pr.p.locator('.cn-selos').innerText()));

    // avaliação do atendimento resolvido
    await pr.p.goto(SITE + '/connect/pedidos/' + AT.laudo, { waitUntil: 'networkidle' });
    conferir('pedido resolvido pede a avaliação', /Como foi o atendimento\?/.test(await corpo(pr.p)) && (await pr.p.locator('.cn-estrelas input').count()) === 5);
    antes = chamadas('POST', 'rpc/avaliar_atendimento');
    await pr.p.click('.cn-estrelas label:has-text("5")');
    await pr.p.fill('.cn-avaliacao textarea', 'Atendimento rápido.');
    await pr.p.click('.cn-avaliacao button[type=submit]');
    await esperarEscrita('POST', 'rpc/avaliar_atendimento', antes);
    await esperarTexto(pr.p, /Você avaliou com/);
    conferir('avaliar grava a nota (uma vez) e agradece', chamadas('POST', 'rpc/avaliar_atendimento') > antes && /Você avaliou com 5 de 5/.test(await corpo(pr.p)) && (await pr.p.locator('.cn-estrelas').count()) === 0);

    // novo pedido, com foto
    await pr.p.goto(SITE + '/connect/pedidos/novo', { waitUntil: 'networkidle' });
    conferir('novo pedido: 5 tipos, propriedade/talhão e campo de foto', (await pr.p.locator('.cn-categoria').count()) === 5 && (await pr.p.locator('select[name=talhao_id] option').count()) > 1 && (await pr.p.locator('.cn-anexos-campo input[type=file]').count()) >= 1);
    await pr.p.goto(SITE + '/connect/pedidos/novo?categoria=problema_lavoura', { waitUntil: 'networkidle' });
    conferir('o tipo pode vir marcado pelo link (?categoria=)', await pr.p.locator('.cn-categoria input[value=problema_lavoura]').isChecked());
    // vindo de "pedir ajuda" em outra tela: assunto e talhão já preenchidos (talhão fora da lista é ignorado)
    await pr.p.goto(SITE + '/connect/pedidos/novo?assunto=Ajuda+no+Talh%C3%A3o+Sede&talhao=t0000001-0000-0000-0000-000000000000', { waitUntil: 'networkidle' });
    conferir('"Pedir ajuda" chega com o assunto e o talhão preenchidos', (await pr.p.inputValue('input[name=assunto]')) === 'Ajuda no Talhão Sede' && (await pr.p.inputValue('select[name=talhao_id]')) === 't0000001-0000-0000-0000-000000000000');
    await pr.p.goto(SITE + '/connect/pedidos/novo?talhao=de-outro-produtor', { waitUntil: 'networkidle' });
    conferir('talhão desconhecido no link é ignorado', (await pr.p.inputValue('select[name=talhao_id]')) === '');
    await pr.p.goto(SITE + '/produtor/talhoes', { waitUntil: 'networkidle' });
    conferir('o portal do produtor oferece "pedir ajuda" em cada talhão', (await pr.p.locator('a:has-text("pedir ajuda")').count()) >= 1 && /\/connect\/pedidos\/novo\?/.test((await pr.p.locator('a:has-text("pedir ajuda")').first().getAttribute('href')) ?? ''));
    await pr.p.goto(SITE + '/connect/pedidos/novo?categoria=problema_lavoura', { waitUntil: 'networkidle' });
    await pr.p.fill('input[name=assunto]', 'Mancha nas folhas do café');
    await pr.p.fill('textarea[name=descricao]', 'Apareceu depois da chuva.');
    await pr.p.setInputFiles('.cn-anexos-campo input[type=file]:not([hidden])', { name: 'folha.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await esperarTexto(pr.p, /1 arquivo\(s\) prontos para enviar/);
    conferir('a foto é preparada no navegador antes de enviar', /1 arquivo\(s\) prontos para enviar/.test(await corpo(pr.p)));
    antes = chamadas('POST', 'atendimentos');
    const antesArq = chamadas('POST', 'atendimento_arquivos');
    await pr.p.click('button:has-text("Enviar pedido")');
    await esperarEscrita('POST', 'atendimento_arquivos', antesArq);
    await pr.p.waitForURL(/\/connect\/pedidos\/63/, { timeout: 8000 }).catch(() => {});
    conferir('pedido criado, foto enviada e registrada, e a pessoa vai para a página do pedido', chamadas('POST', 'atendimentos') > antes && chamadas('POST', 'atendimento_arquivos') > antesArq && /Mancha nas folhas do café/.test(await corpo(pr.p)), pr.p.url());

    // avisos
    await pr.p.goto(SITE + '/connect/avisos', { waitUntil: 'networkidle' });
    conferir('avisos: só os do atendimento, com "marcar todos como lidos"', (await pr.p.locator('.cn-aviso').count()) === 2 && (await pr.p.locator('button:has-text("Marcar todos como lidos")').count()) === 1);

    // o produtor não entra nas telas da equipe
    await pr.p.goto(SITE + '/connect/fila', { waitUntil: 'networkidle' });
    conferir('a fila é da equipe: o produtor volta ao início', /\/connect$/.test(pr.p.url()), pr.p.url());
    await pr.p.goto(SITE + '/connect/atendimentos/' + AT.folhas, { waitUntil: 'networkidle' });
    conferir('o link da equipe leva o produtor ao pedido dele', pr.p.url().endsWith('/connect/pedidos/' + AT.folhas), pr.p.url());
    await pr.p.goto(SITE + '/connect/pedidos/' + AT.broca, { waitUntil: 'networkidle' });
    conferir('pedido de outro produtor não abre', !/Visita para avaliar a broca/.test(await corpo(pr.p)));
    conferir('site Connect do produtor: sem violação de CSP nem erro de JS', pr.problemas.length === 0, pr.problemas.join(' | '));
    await pr.contexto.close();

    // celular
    const cel = await pagina({ papel: 'produtor', largura: 390, altura: 844, celular: true });
    for (const rota of ['/connect', '/connect/pedidos', '/connect/pedidos/novo', '/connect/pedidos/' + AT.folhas, '/connect/avisos']) {
      await cel.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      const larguras = await cel.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
      conferir(`celular: ${rota.replace(/[0-9a-f-]{36}/, ':id')} não rola para o lado`, larguras.doc <= larguras.janela + 1, JSON.stringify(larguras));
    }
    await cel.contexto.close();
  },

  async atlas() {
    await subir();
    const pr = await pagina({ papel: 'produtor' });

    await pr.p.goto(SITE + '/academy/atlas', { waitUntil: 'networkidle' });
    let t = await corpo(pr.p);
    const slugsUnicos = await pr.p.evaluate(() => new Set([...document.querySelectorAll('a.ac-atlas-cartao')].map((a) => a.getAttribute('href'))).size);
    conferir('Atlas: banner com busca, 19 fichas-base + 1 do escritório organizadas em trilhas e o item no menu', slugsUnicos === 20 && (await pr.p.locator('.ac-atlas-hero').count()) === 1 && (await pr.p.locator('.ac-atlas-trilha').count()) >= 5 && (await pr.p.locator('.ac-menu a:has-text("Atlas")').count()) === 1 && /13 doenças 7 pragas 46 fotos Embrapa como fonte 1 do seu escritório/.test(t.replace(/\s+/g, ' ')));
    await pr.p.goto(SITE + '/academy/atlas?parte=raiz', { waitUntil: 'networkidle' });
    conferir('chip "onde aparece" filtra pela raiz (nematoide e roseliniose, não a ferrugem)', (await pr.p.locator('a.ac-atlas-cartao[href$="/nematoide-das-galhas"]').count()) === 1 && (await pr.p.locator('a.ac-atlas-cartao[href$="/ferrugem-alaranjada"]').count()) === 0);
    await pr.p.goto(SITE + '/academy/atlas?tipo=praga', { waitUntil: 'networkidle' });
    conferir('filtro "só pragas" mostra 7', (await pr.p.locator('.ac-atlas-cartao').count()) === 7);
    await pr.p.goto(SITE + '/academy/atlas?q=ferrugem', { waitUntil: 'networkidle' });
    conferir('busca por "ferrugem" acha a ficha e oferece Embrapa/Incaper', (await pr.p.locator('.ac-atlas-cartao').count()) === 1 && (await pr.p.locator('a:has-text("Procurar na Embrapa")').count()) === 1 && (await pr.p.locator('a:has-text("Procurar no Incaper")').count()) === 1);
    await pr.p.goto(SITE + '/academy/atlas?q=zzzzz', { waitUntil: 'networkidle' });
    conferir('busca sem resultado explica e mantém os atalhos de pesquisa', /Nada encontrado no Atlas/.test(await corpo(pr.p)) && (await pr.p.locator('a:has-text("Procurar na Embrapa")').count()) >= 1);
    const rel = await pr.p.locator('a:has-text("Procurar na Embrapa")').first().getAttribute('rel');
    conferir('atalho externo abre em outra aba sem repassar a origem', /noopener/.test(rel ?? ''));

    await pr.p.goto(SITE + '/academy/atlas/ferrugem-alaranjada', { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    await pr.p.locator('.ac-atlas-miniaturas').scrollIntoViewIfNeeded();
    await pr.p.waitForTimeout(500);
    const fotosOk = await pr.p.evaluate(() => [...document.querySelectorAll('.ac-atlas-galeria img')].map((i) => i.complete && i.naturalWidth > 0));
    conferir('ficha: foto grande e 3 miniaturas carregam (estáticas, sob a CSP)', fotosOk.length === 4 && fotosOk.every(Boolean), JSON.stringify(fotosOk));
    const antesSrc = await pr.p.locator('.ac-atlas-principal img').getAttribute('src');
    await pr.p.locator('.ac-atlas-miniaturas a').nth(1).click();
    conferir('clicar numa miniatura troca a foto grande (sem sair da página)', (await pr.p.locator('.ac-atlas-principal img').getAttribute('src')) !== antesSrc && pr.p.url().endsWith('/academy/atlas/ferrugem-alaranjada'));
    conferir('ficha: resumo (importância e onde aparece) e fichas parecidas', (await pr.p.locator('.ac-atlas-fatos li').count()) === 3 && (await pr.p.locator('#t-parecidas').count()) === 1);
    conferir('ficha: o que é, o que favorece, como manejar e monitorar', /Hemileia vastatrix/.test(t) && /O que favorece/.test(t) && /Como manejar/.test(t) && /Como monitorar/.test(t));
    conferir('ficha: avisa que produto e dose são do agrônomo e que as condições são da Amazônia', /Produto, dose e época de aplicação são decisão do seu agrônomo/.test(t) && /Amazônia/.test(t));
    const fonte = pr.p.locator('.ac-atlas-fonte a:has-text("Abrir o documento original")');
    conferir('ficha: cita a Embrapa e leva ao documento original (https, nova aba)', /Embrapa Rondônia/.test(t) && /^https:\/\/www\.infoteca\.cnptia\.embrapa\.br\//.test((await fonte.getAttribute('href')) ?? '') && /noopener/.test((await fonte.getAttribute('rel')) ?? ''));
    conferir('ficha: não mostra dose nem produto', !/\d\s*(L|mL|kg)\s*\/\s*ha/i.test(t) && !/tebuconazol|clorpirif|abamectina/i.test(t));
    await pr.p.goto(SITE + '/academy/atlas/ficha-que-nao-existe', { waitUntil: 'networkidle' });
    conferir('ficha inexistente dá "não encontrada"', !/Hemileia/.test(await corpo(pr.p)));

    // do Atlas para o Connect: pedido já marcado como vindo da ficha
    await pr.p.goto(SITE + '/academy/atlas/broca-do-cafe', { waitUntil: 'networkidle' });
    await pr.p.click('a:has-text("Suspeito disso na minha lavoura")');
    await pr.p.waitForURL(/\/connect\/pedidos\/novo/, { timeout: 8000 }).catch(() => {});
    conferir('"Suspeito disso" abre o pedido com assunto, tipo e origem preenchidos', (await pr.p.inputValue('input[name=assunto]')) === 'Suspeita de broca-do-café' && (await pr.p.locator('.cn-categoria input[value=problema_lavoura]').isChecked()) && (await pr.p.locator('input[type=hidden][name=origem][value=atlas]').count()) === 1, pr.p.url());
    let antes = chamadas('POST', 'atendimentos');
    await pr.p.click('button:has-text("Enviar pedido")');
    await esperarEscrita('POST', 'atendimentos', antes);
    await pr.p.waitForURL(/\/connect\/pedidos\/63/, { timeout: 8000 }).catch(() => {});
    const idNovo = (pr.p.url().match(/pedidos\/([0-9a-f-]{36})/) ?? [])[1] ?? '';
    conferir('o pedido nasce com origem "atlas"', chamadas('POST', 'atendimentos') > antes && idNovo !== '', pr.p.url());
    conferir('Atlas e Connect sem violação de CSP nem erro de JS', pr.problemas.length === 0, pr.problemas.join(' | '));
    await pr.contexto.close();

    // equipe: vê de onde veio e aponta uma ficha na resposta
    const eq = await pagina({ perfis: 'agronomico' });
    await eq.p.goto(SITE + '/connect/atendimentos/' + idNovo, { waitUntil: 'networkidle' });
    conferir('a equipe vê que o pedido veio de uma ficha do Atlas', /veio de uma ficha do Atlas/.test(await corpo(eq.p)));
    antes = chamadas('POST', 'atendimento_mensagens');
    await eq.p.fill('.cn-resposta textarea', 'Parece broca mesmo. Vamos ver na visita.');
    await eq.p.selectOption('select[name=ficha]', 'broca-do-cafe');
    await eq.p.click('.cn-resposta button[type=submit]');
    await esperarEscrita('POST', 'atendimento_mensagens', antes);
    await eq.p.locator('.cn-msg a:has-text("ficha: Broca-do-café")').waitFor({ timeout: 8000 }).catch(() => {});
    const href = await eq.p.locator('.cn-msg a:has-text("ficha: Broca-do-café")').first().getAttribute('href').catch(() => null);
    conferir('a resposta aponta a ficha e a conversa mostra o link', chamadas('POST', 'atendimento_mensagens') > antes && href === '/academy/atlas/broca-do-cafe', String(href));
    await eq.contexto.close();

    // celular
    const cel = await pagina({ papel: 'produtor', largura: 390, altura: 844, celular: true });
    for (const rota of ['/academy/atlas', '/academy/atlas/bicho-mineiro']) {
      await cel.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      const larguras = await cel.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
      conferir(`celular: ${rota} não rola para o lado`, larguras.doc <= larguras.janela + 1, JSON.stringify(larguras));
    }
    await cel.contexto.close();
  },

  async atlas_escritorio() {
    await subir();
    const FI = { publicada: '64aaaaaa-0000-0000-0000-000000000001', rascunho: '64aaaaaa-0000-0000-0000-000000000002' };
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const ag = await pagina({ perfis: 'agronomico' });

    // lista do Estúdio
    await ag.p.goto(SITE + '/academy/estudio/atlas', { waitUntil: 'networkidle' });
    let t = await corpo(ag.p);
    conferir('Estúdio: aba Atlas com as 2 fichas do escritório (uma publicada, uma rascunho) e o botão de nova ficha', (await ag.p.locator('.ac-estudio-abas a:has-text("Atlas")').count()) === 1 && (await ag.p.locator('.item').count()) === 2 && /publicada/.test(t) && /rascunho/.test(t) && (await ag.p.locator('a:has-text("Nova ficha")').count()) === 1);

    // nova ficha: rascunho → foto → publicar
    await ag.p.goto(SITE + '/academy/estudio/atlas/novo', { waitUntil: 'networkidle' });
    await ag.p.fill('input[name=nome]', 'Cercospora do escritório');
    await ag.p.fill('input[name=cultura]', 'Café conilon');
    await ag.p.check('input[name=partes][value=folha]');
    await ag.p.selectOption('select[name=importancia_campo]', 'alta');
    await ag.p.fill('textarea[name=sobre]', 'Manchas circulares com centro claro nas folhas.\nCostuma aparecer em lavoura mal nutrida.');
    await ag.p.fill('textarea[name=manejo]', 'Adubação equilibrada.\nEvitar excesso de sol na muda.');
    conferir('nova ficha: não deixa publicar antes de ter foto', await ag.p.locator('button:has-text("Publicar")').isDisabled());
    let antes = chamadas('POST', 'atlas_fichas');
    await ag.p.click('button:has-text("Salvar rascunho")');
    await esperarEscrita('POST', 'atlas_fichas', antes);
    await ag.p.waitForURL(/\/academy\/estudio\/atlas\/[0-9a-f-]{36}$/, { timeout: 8000 }).catch(() => {});
    const idNova = (ag.p.url().match(/atlas\/([0-9a-f-]{36})$/) ?? [])[1] ?? '';
    conferir('rascunho salvo e a pessoa cai na página da ficha, com 0 fotos', chamadas('POST', 'atlas_fichas') > antes && idNova !== '' && /Fotos da ficha \(0 de 8\)/.test(await corpo(ag.p)), ag.p.url());

    await ag.p.setInputFiles('.ac-estudio-envio input[type=file]:not([hidden])', { name: 'folha.png', mimeType: 'image/png', buffer: PNG });
    await esperarTexto(ag.p, /1 arquivo\(s\) prontos para enviar/);
    await ag.p.fill('input[name=legenda]', 'Folha com a mancha');
    antes = chamadas('POST', 'atlas_fotos');
    await ag.p.click('button:has-text("Enviar fotos")');
    await esperarEscrita('POST', 'atlas_fotos', antes);
    await esperarTexto(ag.p, /Fotos da ficha \(1 de 8\)/);
    conferir('foto enviada (Storage + registro) e a ficha passa a ter 1 foto', chamadas('POST', 'atlas_fotos') > antes && /Fotos da ficha \(1 de 8\)/.test(await corpo(ag.p)) && (await ag.p.locator('.ac-estudio-fotos li').count()) === 1);
    antes = chamadas('PATCH', 'atlas_fichas');
    conferir('com foto, o botão Publicar libera', await ag.p.locator('button:has-text("Publicar")').isEnabled());
    await ag.p.click('button:has-text("Publicar")');
    await esperarEscrita('PATCH', 'atlas_fichas', antes);
    await esperarTexto(ag.p, /Os produtores já veem esta ficha/);
    conferir('publicar muda a situação para "publicada"', /Os produtores já veem esta ficha/.test(await corpo(ag.p)));

    // quem não tem permissão só consulta
    const campo = await pagina({ perfis: 'campo' });
    await campo.p.goto(SITE + '/academy/estudio/atlas', { waitUntil: 'networkidle' });
    conferir('perfil Campo vê a lista, mas sem botão de nova ficha', (await campo.p.locator('.item').count()) >= 2 && (await campo.p.locator('a:has-text("Nova ficha")').count()) === 0);
    await campo.p.goto(SITE + '/academy/estudio/atlas/novo', { waitUntil: 'networkidle' });
    conferir('perfil Campo que abre "nova ficha" volta para a lista', /\/academy\/estudio\/atlas$/.test(campo.p.url()), campo.p.url());
    await campo.contexto.close();

    // equipe vê a ficha como o aluno e acha o atalho de edição
    await ag.p.goto(SITE + '/academy/atlas/' + FI.publicada, { waitUntil: 'networkidle' });
    conferir('equipe: na ficha publicada há "Editar no Estúdio", sem o botão de suspeita (isso é do produtor)', (await ag.p.locator('a:has-text("Editar no Estúdio")').count()) === 1 && (await ag.p.locator('a:has-text("Suspeito disso")').count()) === 0);
    await ag.p.goto(SITE + '/academy/atlas/' + FI.rascunho, { waitUntil: 'networkidle' });
    conferir('equipe: o rascunho abre com o aviso de que só a equipe vê', /Só a equipe vê esta ficha/.test(await corpo(ag.p)));

    // produtor: vê as publicadas (inclusive a nova), nunca o rascunho
    const pr = await pagina({ papel: 'produtor' });
    await pr.p.goto(SITE + '/academy/atlas', { waitUntil: 'networkidle' });
    const unicos = await pr.p.evaluate(() => new Set([...document.querySelectorAll('a.ac-atlas-cartao')].map((a) => a.getAttribute('href'))).size);
    t = await corpo(pr.p);
    conferir('produtor: 19 fichas-base + 2 do escritório (a nova e a publicada), sem o rascunho', unicos === 21 && /Mancha-de-phoma do escritório/.test(t) && /Cercospora do escritório/.test(t) && !/Ficha em redação/.test(t), String(unicos));
    await pr.p.locator('a.ac-atlas-cartao[href*="64aaaaaa"] img').first().scrollIntoViewIfNeeded();
    await pr.p.waitForTimeout(700);
    conferir('produtor: o cartão mostra o selo "Do escritório" e a foto carrega', (await pr.p.locator('.ac-atlas-selo-escritorio').count()) >= 2 && await pr.p.evaluate(() => { const i = document.querySelector('a.ac-atlas-cartao[href*="64aaaaaa"] img'); return Boolean(i && i.complete && i.naturalWidth > 0); }));
    await pr.p.goto(SITE + '/academy/atlas?q=phoma', { waitUntil: 'networkidle' });
    conferir('a busca acha a ficha do escritório pelo nome', (await pr.p.locator('a.ac-atlas-cartao').count()) === 1);
    await pr.p.goto(SITE + '/academy/atlas?parte=ramo', { waitUntil: 'networkidle' });
    conferir('o filtro por parte da planta inclui a ficha do escritório (ramo)', (await pr.p.locator('a.ac-atlas-cartao[href*="64aaaaaa"]').count()) === 1);

    await pr.p.goto(SITE + '/academy/atlas/' + FI.publicada, { waitUntil: 'networkidle' });
    t = await corpo(pr.p);
    await pr.p.locator('.ac-atlas-miniaturas').scrollIntoViewIfNeeded();
    await pr.p.waitForTimeout(500);
    const fotosOk = await pr.p.evaluate(() => [...document.querySelectorAll('.ac-atlas-galeria img')].map((i) => i.complete && i.naturalWidth > 0));
    conferir('ficha do escritório: texto, fonte do escritório e 2 fotos (foto grande + miniaturas) carregando', /Phoma tarda/.test(t) && /Quebra-vento/.test(t) && /Ficha escrita pelo seu escritório/.test(t) && fotosOk.length === 3 && fotosOk.every(Boolean), JSON.stringify(fotosOk));
    conferir('ficha do escritório: sem a nota da Embrapa/Amazônia e com o botão de suspeita', !/Reprodução com autorização da Embrapa/.test(t) && (await pr.p.locator('a:has-text("Suspeito disso")').count()) === 1);
    await pr.p.goto(SITE + '/academy/atlas/' + FI.rascunho, { waitUntil: 'networkidle' });
    conferir('produtor não abre o rascunho do escritório', !/Ficha em redação/.test(await corpo(pr.p)));
    await pr.p.goto(SITE + '/academy/estudio/atlas', { waitUntil: 'networkidle' });
    conferir('produtor não entra no Estúdio', /\/academy$/.test(pr.p.url()), pr.p.url());
    conferir('Atlas do escritório sem violação de CSP nem erro de JS', pr.problemas.length === 0 && ag.problemas.length === 0, pr.problemas.concat(ag.problemas).join(' | '));
    await pr.contexto.close();

    // Connect: a equipe aponta a ficha do escritório e a conversa mostra o link com o nome
    await ag.p.goto(SITE + '/connect/atendimentos/63aaaaaa-0000-0000-0000-000000000001', { waitUntil: 'networkidle' });
    conferir('Connect: a lista de fichas da resposta inclui o grupo "Do seu escritório"', (await ag.p.locator('select[name=ficha] optgroup[label="Do seu escritório"] option').count()) >= 2);
    antes = chamadas('POST', 'atendimento_mensagens');
    await ag.p.fill('.cn-resposta textarea', 'Veja se bate com o que você viu.');
    await ag.p.selectOption('select[name=ficha]', FI.publicada);
    await ag.p.click('.cn-resposta button[type=submit]');
    await esperarEscrita('POST', 'atendimento_mensagens', antes);
    const link = ag.p.locator(`.cn-msg a:has-text("ficha: Mancha-de-phoma do escritório")`);
    await link.first().waitFor({ timeout: 8000 }).catch(() => {});
    conferir('a resposta cita a ficha do escritório e a conversa mostra o link com o nome', chamadas('POST', 'atendimento_mensagens') > antes && (await link.first().getAttribute('href').catch(() => '')) === `/academy/atlas/${FI.publicada}`);
    await ag.contexto.close();

    // celular
    const cel = await pagina({ papel: 'produtor', largura: 390, altura: 844, celular: true });
    for (const rota of ['/academy/atlas', '/academy/atlas/' + FI.publicada]) {
      await cel.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      const larguras = await cel.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
      conferir(`celular: ${rota.replace(/[0-9a-f-]{36}/, ':id')} não rola para o lado`, larguras.doc <= larguras.janela + 1, JSON.stringify(larguras));
    }
    await cel.contexto.close();
  },

  async atlas_indicacao() {
    await subir();
    const EXTRA = 'f0000007-0000-0000-0000-000000000000';
    const FI = '64aaaaaa-0000-0000-0000-000000000001'; // ficha do escritório publicada (semente)
    const FR = '64aaaaaa-0000-0000-0000-000000000002'; // rascunho

    // produtor: a ficha indicada aparece no topo do Atlas, marcada como nova
    const pr = await pagina({ papel: 'produtor' });
    await pr.p.goto(SITE + '/academy/atlas', { waitUntil: 'networkidle' });
    const sec = pr.p.locator('#t-indicadas');
    conferir('produtor: "Indicadas para você" no topo do Atlas, com a ficha e o selo "Nova"', (await sec.count()) === 1 && (await pr.p.locator('section[aria-labelledby=t-indicadas] a.ac-atlas-cartao[href$="/ferrugem-alaranjada"]').count()) === 1 && /nova/i.test(await pr.p.locator('section[aria-labelledby=t-indicadas]').innerText()));
    await pr.p.goto(SITE + '/academy/atlas/ferrugem-alaranjada', { waitUntil: 'networkidle' });
    let t = await corpo(pr.p);
    conferir('produtor: a ficha mostra "indicada para você" com o recado do agrônomo', /indicada para você/.test(t) && /Veja antes da nossa visita de quinta/.test(t));
    conferir('produtor: não vê o formulário de indicar (é da equipe)', (await pr.p.locator('text=Indicar a um produtor').count()) === 0);
    for (let i = 0; i < 40 && chamadas('PATCH', 'atlas_indicacoes') < 1; i++) await new Promise((r) => setTimeout(r, 150));
    conferir('abrir a ficha registra a abertura da indicação', chamadas('PATCH', 'atlas_indicacoes') >= 1);
    await pr.p.goto(SITE + '/academy/atlas', { waitUntil: 'networkidle' });
    conferir('depois de aberta, o selo passa de "Nova" para "Indicada"', /indicada/i.test(await pr.p.locator('section[aria-labelledby=t-indicadas]').innerText()) && !/nova/i.test(await pr.p.locator('section[aria-labelledby=t-indicadas]').innerText()));
    conferir('Atlas do produtor sem violação de CSP nem erro de JS', pr.problemas.length === 0, pr.problemas.join(' | '));
    await pr.contexto.close();

    // equipe com permissão: indica uma ficha-base e uma do escritório
    const ag = await pagina({ perfis: 'agronomico' });
    await ag.p.goto(SITE + '/academy/atlas/broca-do-cafe', { waitUntil: 'networkidle' });
    conferir('equipe: a ficha traz "Indicar a um produtor" com a lista de produtores', (await ag.p.locator('#t-indicar').count()) === 1 && (await ag.p.locator('select[name=produtor_id] option').count()) >= 3);
    let antes = chamadas('POST', 'atlas_indicacoes');
    await ag.p.selectOption('select[name=produtor_id]', EXTRA);
    await ag.p.fill('textarea[name=mensagem]', 'Confira na próxima colheita.');
    await ag.p.click('button:has-text("Indicar ficha")');
    await esperarEscrita('POST', 'atlas_indicacoes', antes);
    await ag.p.waitForURL(/indicado=1/, { timeout: 8000 }).catch(() => {});
    await ag.p.locator('.ac-atlas-ok').waitFor({ timeout: 8000 }).catch(() => {});
    t = await corpo(ag.p);
    conferir('indicar grava, avisa e mostra quem recebeu (ainda não abriu)', chamadas('POST', 'atlas_indicacoes') > antes && /Indicação enviada/.test(t) && /Produtor de teste do Atlas/.test(t) && /ainda não abriu/.test(t) && /Confira na próxima colheita/.test(t));
    conferir('quem já recebeu sai da lista de escolha', (await ag.p.locator(`select[name=produtor_id] option[value="${EXTRA}"]`).count()) === 0);

    await ag.p.goto(SITE + '/academy/atlas/' + FI, { waitUntil: 'networkidle' });
    antes = chamadas('POST', 'atlas_indicacoes');
    await ag.p.selectOption('select[name=produtor_id]', EXTRA);
    await ag.p.click('button:has-text("Indicar ficha")');
    await esperarEscrita('POST', 'atlas_indicacoes', antes);
    conferir('também indica uma ficha do escritório', chamadas('POST', 'atlas_indicacoes') > antes);

    await ag.p.goto(SITE + '/academy/atlas/ferrugem-alaranjada', { waitUntil: 'networkidle' });
    antes = chamadas('DELETE', 'atlas_indicacoes');
    await ag.p.click('button:has-text("Desfazer")');
    for (let i = 0; i < 40 && chamadas('DELETE', 'atlas_indicacoes') <= antes; i++) await new Promise((r) => setTimeout(r, 150));
    conferir('"Desfazer" apaga a indicação', chamadas('DELETE', 'atlas_indicacoes') > antes);

    await ag.p.goto(SITE + '/academy/atlas/' + FR, { waitUntil: 'networkidle' });
    conferir('rascunho não pode ser indicado: o formulário nem aparece', (await ag.p.locator('#t-indicar').count()) === 0);
    await ag.contexto.close();

    // atalho "Indicar ficha" nas telas do escritório: a análise leva ao Atlas com o produtor já escolhido
    const ag2 = await pagina({ perfis: 'agronomico' });
    const ID_ANALISE1 = 'a0000001-0000-0000-0000-000000000000';
    const ID_PRODUTOR1 = 'f0000001-0000-0000-0000-000000000000';
    await ag2.p.goto(SITE + '/app/analises/' + ID_ANALISE1, { waitUntil: 'networkidle' });
    const atalho = ag2.p.locator('a:has-text("Indicar ficha do Atlas")');
    conferir('análise: botão "Indicar ficha do Atlas" leva ao Atlas com o produtor e a análise', (await atalho.count()) === 1 && (await atalho.getAttribute('href')) === `/academy/atlas?indicar=${ID_PRODUTOR1}&analise=${ID_ANALISE1}`, (await atalho.getAttribute('href').catch(() => '')) ?? '');
    await atalho.click();
    await ag2.p.waitForURL(/\/academy\/atlas\?indicar=/, { timeout: 8000 }).catch(() => {});
    conferir('Atlas com contexto: avisa para quem é a indicação e oferece cancelar', /Escolha uma ficha para indicar a José da Silva Pereira/.test(await corpo(ag2.p)) && /a partir de uma análise/.test(await corpo(ag2.p)) && (await ag2.p.locator('a:has-text("Cancelar")').count()) === 1);
    const hrefCartao = (await ag2.p.locator('a.ac-atlas-cartao').first().getAttribute('href')) ?? '';
    conferir('os cartões levam o contexto para a ficha', hrefCartao.includes(`indicar=${ID_PRODUTOR1}`) && hrefCartao.includes(`analise=${ID_ANALISE1}`), hrefCartao);
    await ag2.p.goto(SITE + `/academy/atlas/broca-do-cafe?indicar=${ID_PRODUTOR1}&analise=${ID_ANALISE1}`, { waitUntil: 'networkidle' });
    conferir('na ficha, o produtor já vem escolhido e a análise vai junto (campo escondido)', (await ag2.p.inputValue('select[name=produtor_id]')) === ID_PRODUTOR1 && (await ag2.p.locator(`input[type=hidden][name=analise_id][value="${ID_ANALISE1}"]`).count()) === 1);
    antes = chamadas('POST', 'atlas_indicacoes');
    await ag2.p.click('button:has-text("Indicar ficha")');
    await esperarEscrita('POST', 'atlas_indicacoes', antes);
    conferir('a indicação sai ligada à análise', chamadas('POST', 'atlas_indicacoes') > antes);
    await ag2.p.goto(SITE + '/academy/atlas?indicar=nao-e-id', { waitUntil: 'networkidle' });
    conferir('contexto inválido na URL é ignorado (sem aviso de indicação)', !/Escolha uma ficha para indicar/.test(await corpo(ag2.p)));

    await ag2.contexto.close();
    // perfil de consulta não indica
    const le = await pagina({ perfis: 'leitura' });
    await le.p.goto(SITE + '/app/analises/' + ID_ANALISE1, { waitUntil: 'networkidle' });
    conferir('perfil Consulta não vê o botão "Indicar ficha" na análise', (await le.p.locator('a:has-text("Indicar ficha do Atlas")').count()) === 0);
    await le.p.goto(SITE + '/academy/atlas/broca-do-cafe', { waitUntil: 'networkidle' });
    conferir('perfil Consulta vê a ficha, mas não o formulário de indicar', (await le.p.locator('h1:has-text("Broca-do-café")').count()) === 1 && (await le.p.locator('#t-indicar').count()) === 0);
    await le.contexto.close();

    // celular
    const cel = await pagina({ perfis: 'agronomico', largura: 390, altura: 844, celular: true });
    await cel.p.goto(SITE + '/academy/atlas/broca-do-cafe', { waitUntil: 'networkidle' });
    const larguras = await cel.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
    conferir('celular: a ficha com o formulário de indicar não rola para o lado', larguras.doc <= larguras.janela + 1, JSON.stringify(larguras));
    await cel.contexto.close();
  },

  async connect_equipe() {
    await subir();
    const AT = { folhas: '63aaaaaa-0000-0000-0000-000000000001', broca: '63aaaaaa-0000-0000-0000-000000000004' };
    const CARLOS = 'c1000000-0000-0000-0000-000000000002';
    const eq = await pagina({ perfis: 'agronomico' });

    await eq.p.goto(SITE + '/connect', { waitUntil: 'networkidle' });
    conferir('a equipe cai direto na fila de atendimento', /\/connect\/fila$/.test(eq.p.url()), eq.p.url());
    conferir('menu da equipe: Fila, Novo atendimento e Avisos', (await eq.p.locator('.cn-menu a:has-text("Fila de atendimento")').count()) === 1 && (await eq.p.locator('.cn-menu a:has-text("Novo atendimento")').count()) === 1 && (await eq.p.locator('.cn-menu a:has-text("Meus pedidos")').count()) === 0);
    conferir('fila: 5 colunas e todos os 5 pedidos do escritório', (await eq.p.locator('.cn-coluna').count()) === 5 && (await eq.p.locator('.cn-card').count()) === 5);
    const resumo = (await eq.p.locator('.cn-resumo > *').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
    conferir('resumo: 4 em aberto, 2 sem responsável, 1 prazo vencido, 1 urgente', resumo[0]?.startsWith('4') && resumo[1]?.startsWith('2') && resumo[2]?.startsWith('1') && resumo[3]?.startsWith('1'), resumo.join(' | '));
    const broca = eq.p.locator('.cn-card', { hasText: 'Visita para avaliar a broca' });
    conferir('o pedido urgente e vencido aparece destacado, sem responsável', (await broca.getAttribute('class'))?.includes('cn-card-atrasado') && /Sem responsável/.test(await broca.innerText()) && /Venceu/.test(await broca.innerText()) && /urgente/.test(await broca.innerText()));
    await eq.p.goto(SITE + '/connect/fila?quem=sem_responsavel', { waitUntil: 'networkidle' });
    conferir('filtro "sem responsável" mostra 2', (await eq.p.locator('.cn-card').count()) === 2);
    await eq.p.goto(SITE + '/connect/fila?atrasados=1', { waitUntil: 'networkidle' });
    conferir('filtro "só atrasados" mostra 1', (await eq.p.locator('.cn-card').count()) === 1);
    await eq.p.goto(SITE + '/connect/fila?q=folhas+jose', { waitUntil: 'networkidle' });
    conferir('busca por assunto e produtor (sem acento) acha o pedido', (await eq.p.locator('.cn-card').count()) === 1);

    // atendimento: tudo à vista, inclusive a nota interna
    await eq.p.goto(SITE + '/connect/atendimentos/' + AT.folhas, { waitUntil: 'networkidle' });
    let t = await corpo(eq.p);
    conferir('atendimento: 3 mensagens, a nota interna marcada', (await eq.p.locator('.cn-msg').count()) === 3 && (await eq.p.locator('.cn-msg-interna').count()) === 1 && /nitrogênio/.test(t));
    const tempo = await eq.p.locator('.cn-tempo').innerText();
    conferir('atendimento: histórico com responsável e prioridade (nome da pessoa)', /Responsável: Carlos Pereira/.test(tempo) && /Prioridade: alta/.test(tempo));
    const whats = await eq.p.locator('a:has-text("WhatsApp")').getAttribute('href').catch(() => '');
    conferir('botão do WhatsApp abre a conversa com o número do produtor e o texto pronto', /^https:\/\/wa\.me\/5527990123405\?text=Ol%C3%A1%2C%20Jos%C3%A9/.test(whats ?? ''), whats ?? '');
    conferir('atendimento: link para o cadastro do produtor', (await eq.p.locator('a:has-text("Ver cadastro")').count()) === 1);

    // responder com nota interna
    let antes = chamadas('POST', 'atendimento_mensagens');
    await eq.p.fill('.cn-resposta textarea', 'Combinar visita na quinta.');
    await eq.p.check('input[name=interna]');
    await eq.p.click('.cn-resposta button[type=submit]');
    await esperarEscrita('POST', 'atendimento_mensagens', antes);
    await esperarTexto(eq.p, /Combinar visita na quinta/);
    conferir('resposta como nota interna fica marcada para a equipe', chamadas('POST', 'atendimento_mensagens') > antes && (await eq.p.locator('.cn-msg-interna').count()) === 2);

    // situação, responsável/prazo, assumir e retorno
    antes = chamadas('PATCH', 'atendimentos');
    await eq.p.selectOption('select[aria-label="Situação do pedido"]', 'resolvido');
    await eq.p.click('button:has-text("Mudar")');
    await esperarEscrita('PATCH', 'atendimentos', antes);
    // o texto "Resolvido" já existe na lista de situações: espera o SELO mudar
    await eq.p.locator('.cn-selos', { hasText: 'Resolvido' }).waitFor({ timeout: 8000 }).catch(() => {});
    conferir('mudar a situação grava e o selo muda', chamadas('PATCH', 'atendimentos') > antes && /Resolvido/.test(await eq.p.locator('.cn-selos').innerText()));
    antes = chamadas('PATCH', 'atendimentos');
    await eq.p.selectOption('select[name=responsavel_id]', CARLOS);
    await eq.p.selectOption('select[name=prioridade]', 'urgente');
    await eq.p.fill('input[name=vencimento]', '2030-01-15');
    await eq.p.click('button:has-text("Salvar")');
    await esperarEscrita('PATCH', 'atendimentos', antes);
    await eq.p.locator('.cn-selos', { hasText: 'urgente' }).waitFor({ timeout: 8000 }).catch(() => {});
    conferir('responsável, prioridade e prazo são salvos de uma vez', chamadas('PATCH', 'atendimentos') > antes && /urgente/.test(await eq.p.locator('.cn-selos').innerText()));
    antes = chamadas('PATCH', 'atendimentos');
    await eq.p.click('button:has-text("Assumir este atendimento")');
    await esperarEscrita('PATCH', 'atendimentos', antes);
    conferir('"Assumir" grava a mudança de responsável', chamadas('PATCH', 'atendimentos') > antes);
    antes = chamadas('POST', 'agenda_eventos');
    await eq.p.fill('input[name=data]', '2030-02-01');
    await eq.p.click('button:has-text("Marcar")');
    await esperarEscrita('POST', 'agenda_eventos', antes);
    await esperarTexto(eq.p, /Retorno marcado na agenda/);
    conferir('retorno vai para a agenda do escritório com aviso na tela', chamadas('POST', 'agenda_eventos') > antes && /Retorno marcado na agenda/.test(await corpo(eq.p)));

    // novo atendimento: passo 1 (escolher o produtor)
    await eq.p.goto(SITE + '/connect/atendimentos/novo', { waitUntil: 'networkidle' });
    conferir('novo atendimento: primeiro escolhe o produtor', (await eq.p.locator('select[name=produtor] option').count()) > 3);
    await eq.p.goto(SITE + '/connect/atendimentos/novo?produtor=nao-e-um-id', { waitUntil: 'networkidle' });
    conferir('produtor inválido volta à escolha', (await eq.p.locator('select[name=produtor]').count()) === 1);
    await eq.p.goto(SITE + '/connect/pedidos', { waitUntil: 'networkidle' });
    conferir('a equipe que abre a tela do produtor volta para a fila', /\/connect\/fila$/.test(eq.p.url()), eq.p.url());
    conferir('site Connect da equipe: sem violação de CSP nem erro de JS', eq.problemas.length === 0, eq.problemas.join(' | '));
    await eq.contexto.close();

    // perfil que só consulta (financeiro): vê, mas não atende
    const fin = await pagina({ perfis: 'financeiro' });
    await fin.p.goto(SITE + '/connect/atendimentos/' + AT.folhas, { waitUntil: 'networkidle' });
    t = await corpo(fin.p);
    conferir('perfil sem permissão só consulta: sem resposta e sem painel de gestão', /só consulta/.test(t) && (await fin.p.locator('.cn-resposta').count()) === 0 && (await fin.p.locator('button:has-text("Mudar")').count()) === 0);
    await fin.contexto.close();

    // celular
    const cel = await pagina({ perfis: 'agronomico', largura: 390, altura: 844, celular: true });
    for (const rota of ['/connect/fila', '/connect/atendimentos/' + AT.folhas, '/connect/atendimentos/novo']) {
      await cel.p.goto(SITE + rota, { waitUntil: 'networkidle' });
      const larguras = await cel.p.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
      conferir(`celular: ${rota.replace(/[0-9a-f-]{36}/, ':id')} não rola para o lado`, larguras.doc <= larguras.janela + 1, JSON.stringify(larguras));
    }
    await cel.contexto.close();
  },

  async senhas() {
    await subir();
    // "esqueci minha senha": resposta sempre igual
    const anon = await pagina({ anonimo: true });
    await anon.p.goto(SITE + '/login', { waitUntil: 'networkidle' });
    await anon.p.click('button:has-text("Esqueci minha senha")');
    conferir('sem e-mail digitado pede o e-mail', /Digite seu e-mail/.test(await corpo(anon.p)));
    await anon.p.fill('input[type=email]', 'alguem@exemplo.com');
    await anon.p.click('button:has-text("Esqueci minha senha")');
    await anon.p.waitForTimeout(800);
    conferir('resposta não revela se a conta existe', /Se este e-mail tiver cadastro/.test(await corpo(anon.p)));
    await anon.contexto.close();

    // link de nova senha: inválido, expirado e válido (aberto em outro navegador, sem sessão)
    const outro = await pagina({ anonimo: true });
    await outro.p.goto(`${SITE}/redefinir-senha?token_hash=x&type=recovery`, { waitUntil: 'networkidle' });
    conferir('link adulterado → "Link inválido"', /Link inválido/.test(await corpo(outro.p)));
    await outro.p.goto(`${SITE}/redefinir-senha#error=access_denied&error_code=otp_expired`, { waitUntil: 'networkidle' });
    await outro.p.waitForTimeout(400);
    conferir('link expirado → "Link inválido"', /Link inválido/.test(await corpo(outro.p)));
    await outro.p.goto(`${SITE}/redefinir-senha?token_hash=a1b2c3d4e5f6a7b8c9d0e1f2&type=recovery`, { waitUntil: 'networkidle' });
    conferir('link válido mostra o formulário de nova senha', (await outro.p.locator('input[type=password]').count()) === 2);
    await outro.p.locator('input[type=password]').nth(0).fill('senhaNova123');
    await outro.p.locator('input[type=password]').nth(1).fill('senhaNova123');
    await outro.p.click('button[type=submit]');
    await outro.p.waitForTimeout(2500);
    conferir('senha salva e a pessoa entra no painel', outro.p.url().endsWith('/app'));
    await outro.contexto.close();
  },
};

// ================== execução ==================
const escolhidos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(cenarios);
navegador = await chromium.launch();
let abortou = false;
for (const nome of escolhidos) {
  if (!cenarios[nome]) { console.error(`cenário desconhecido: ${nome} (existem: ${Object.keys(cenarios).join(', ')})`); process.exit(2); }
  console.log(`\n▸ ${nome}`);
  try { await cenarios[nome](); }
  catch (e) { console.log(`  ✗ cenário interrompido: ${String(e.message).split('\n')[0]}`); falhas.push(`${nome}: ${e.message.split('\n')[0]}`); abortou = true; }
  finally { derrubar(); }
}
await navegador.close();
console.log(`\n${verificacoes} verificações, ${falhas.length} falha(s)${abortou ? ' (houve cenário interrompido)' : ''}`);
if (falhas.length) { console.log(falhas.map((f) => ' - ' + f).join('\n')); process.exit(1); }
