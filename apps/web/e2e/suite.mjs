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
