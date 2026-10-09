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

  async academy() {
    await subir();
    const AC = { video: '62aaaaaa-0000-0000-0000-000000000001', artigo: '62aaaaaa-0000-0000-0000-000000000002', material: '62aaaaaa-0000-0000-0000-000000000003', rascunho: '62aaaaaa-0000-0000-0000-000000000004' };

    // agronômico: biblioteca, filtros, formulário que muda por tipo, validações do servidor, indicar
    const ag = await pagina({ perfis: 'agronomico' });
    await ag.p.goto(SITE + '/app/academy', { waitUntil: 'networkidle' });
    conferir('biblioteca lista os 4 conteúdos do escritório (publicados e rascunho)', (await ag.p.locator('.lista .item').count()) === 4);
    await ag.p.goto(SITE + '/app/academy?q=adubacao', { waitUntil: 'networkidle' });
    conferir('a busca ignora acento ("adubacao" acha "Adubação")', (await ag.p.locator('.lista .item').count()) === 1);
    await ag.p.goto(SITE + '/app/academy?status=rascunho', { waitUntil: 'networkidle' });
    conferir('filtro por situação mostra só o rascunho', (await ag.p.locator('.lista .item').count()) === 1);
    await ag.p.goto(SITE + '/app/academy?tipo=video&tema=calagem', { waitUntil: 'networkidle' });
    conferir('filtros combinam (vídeo + calagem)', (await ag.p.locator('.lista .item').count()) === 1);

    await ag.p.goto(SITE + '/app/academy/novo', { waitUntil: 'networkidle' });
    conferir('vídeo pede o link e não pede texto nem arquivo', (await ag.p.locator('#url').count()) === 1 && (await ag.p.locator('#corpo').count()) === 0 && (await ag.p.locator('#arquivo').count()) === 0);
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Artigo' }).first().click();
    conferir('artigo pede o texto e não pede link', (await ag.p.locator('#corpo').count()) === 1 && (await ag.p.locator('#url').count()) === 0);
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Material' }).first().click();
    conferir('material pede arquivo (ou link)', (await ag.p.locator('#arquivo').count()) === 1 && (await ag.p.locator('#url').count()) === 1);
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Só os que eu escolher' }).click();
    conferir('"só os que eu escolher" abre a lista de produtores', (await ag.p.locator('.marcar-lista input[type=checkbox]').count()) > 0);

    // o servidor explica o que falta (e o banco não deixa passar mesmo que a tela falhe)
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Vídeo' }).first().click();
    await ag.p.locator('.opcoes-tipo label', { hasText: 'Todos os meus produtores' }).click();
    await ag.p.fill('#titulo', 'Aula sem link');
    await ag.p.click('button[name=intencao][value=publicar]');
    await esperarTexto(ag.p, /cole o link dele/);
    conferir('publicar vídeo sem link é recusado com mensagem clara', /cole o link dele/.test(await corpo(ag.p)), (await corpo(ag.p)).slice(0, 300));
    await ag.p.goto(SITE + '/app/academy/novo', { waitUntil: 'networkidle' });
    await ag.p.fill('#titulo', 'Aula com link ruim');
    await ag.p.evaluate(() => { const u = document.querySelector('#url'); if (u) u.type = 'text'; });
    await ag.p.fill('#url', 'http://exemplo.com/aula');
    await ag.p.click('button[name=intencao][value=rascunho]');
    await esperarTexto(ag.p, /começar com https/);
    conferir('link sem https é recusado até em rascunho', /começar com https/.test(await corpo(ag.p)), (await corpo(ag.p)).slice(0, 300));

    // indicar: sem escolher ninguém o servidor recusa
    await ag.p.goto(SITE + '/app/academy/' + AC.video, { waitUntil: 'networkidle' });
    conferir('conteúdo publicado mostra o acompanhamento de indicações', /Indicar a produtores/.test(await corpo(ag.p)));
    await ag.p.click('button:has-text("Indicar")');
    await esperarTexto(ag.p, /pelo menos um produtor/);
    conferir('indicar sem escolher produtor é recusado', /pelo menos um produtor/.test(await corpo(ag.p)), (await corpo(ag.p)).slice(0, 300));
    await ag.p.goto(SITE + '/app/academy/' + AC.rascunho, { waitUntil: 'networkidle' });
    conferir('rascunho não oferece indicação', /Só conteúdo publicado pode ser indicado/.test(await corpo(ag.p)));
    conferir('academy: sem violação de CSP nem erro de JS', ag.problemas.length === 0, ag.problemas.join(' | '));
    await ag.contexto.close();

    // campo: lê e indica, mas não cria nem edita; consulta só lê
    const campo = await pagina({ perfis: 'campo' });
    await campo.p.goto(SITE + '/app/academy', { waitUntil: 'networkidle' });
    conferir('campo não vê "Novo conteúdo"', (await campo.p.locator('a:has-text("Novo conteúdo")').count()) === 0);
    await campo.p.goto(SITE + '/app/academy/novo', { waitUntil: 'networkidle' });
    conferir('campo que abre "novo" volta para a biblioteca', campo.p.url().endsWith('/app/academy'));
    await campo.p.goto(SITE + '/app/academy/' + AC.video, { waitUntil: 'networkidle' });
    conferir('campo vê o conteúdo só para leitura, mas pode indicar', /só consulta/.test(await corpo(campo.p)) && (await campo.p.locator('button[name=intencao]').count()) === 0 && (await campo.p.locator('button:has-text("Indicar")').count()) === 1);
    await campo.contexto.close();
    const leitura = await pagina({ perfis: 'leitura' });
    await leitura.p.goto(SITE + '/app/academy/' + AC.video, { waitUntil: 'networkidle' });
    conferir('consulta não indica', /não indica conteúdos/.test(await corpo(leitura.p)) && (await leitura.p.locator('button:has-text("Indicar")').count()) === 0);
    await leitura.contexto.close();

    // produtor: universidade, abrir (marca "abriu"), concluir
    const pr = await pagina({ papel: 'produtor' });
    await pr.p.goto(SITE + '/produtor/universidade', { waitUntil: 'networkidle' });
    const textoUni = await corpo(pr.p);
    // o rótulo da seção sai em MAIÚSCULAS (text-transform): o texto lido do navegador vem assim
    conferir('produtor vê o que foi indicado e o progresso', /indicado pelo seu agrônomo/i.test(textoUni) && /1 de 2 concluído/.test(textoUni));
    conferir('a biblioteca do produtor não mostra rascunho', !/ferrugem do cafeeiro/.test(textoUni));
    await pr.p.goto(SITE + '/produtor/universidade?q=calagem', { waitUntil: 'networkidle' });
    conferir('o produtor também busca por palavra', (await pr.p.locator('.lista .item').count()) >= 1);

    const antesAbrir = chamadas('PATCH', 'academy_indicacoes');
    await pr.p.goto(SITE + '/produtor/universidade/' + AC.video, { waitUntil: 'networkidle' });
    const link = pr.p.locator('a:has-text("Assistir ao vídeo")');
    conferir('vídeo abre em outra aba, sem repassar a página de origem', (await link.getAttribute('target')) === '_blank' && /noopener/.test((await link.getAttribute('rel')) ?? ''));
    conferir('mostra o recado do agrônomo', /Assista antes da nossa visita de quinta/.test(await corpo(pr.p)));
    conferir('abrir uma indicação nova registra que abriu', chamadas('PATCH', 'academy_indicacoes') > antesAbrir);
    const antesConcluir = chamadas('PATCH', 'academy_indicacoes');
    await pr.p.click('button:has-text("Marcar como concluído")');
    await pr.p.waitForTimeout(1200);
    conferir('"Marcar como concluído" chega ao banco', chamadas('PATCH', 'academy_indicacoes') > antesConcluir);

    await pr.p.goto(SITE + '/produtor/universidade/' + AC.artigo, { waitUntil: 'networkidle' });
    conferir('artigo aparece como texto, com os parágrafos', /Primeiro parágrafo da aula/.test(await corpo(pr.p)) && /Segundo parágrafo/.test(await corpo(pr.p)));
    await pr.p.goto(SITE + '/produtor/universidade/' + AC.material, { waitUntil: 'networkidle' });
    conferir('o que já foi concluído mostra a data', /Concluído em/.test(await corpo(pr.p)));
    // a página do portal começa a ser enviada antes da busca terminar (loading.tsx), então o status HTTP já é 200: o que vale é o conteúdo
    await pr.p.goto(SITE + '/produtor/universidade/' + AC.rascunho, { waitUntil: 'networkidle' });
    const textoRasc = await corpo(pr.p);
    conferir('rascunho não abre para o produtor (nem título nem conteúdo)', !/ferrugem do cafeeiro/i.test(textoRasc) && !(await pr.p.locator('a:has-text("Assistir ao vídeo")').count()), textoRasc.slice(0, 200));
    conferir('universidade do produtor: sem violação de CSP nem erro de JS', pr.problemas.length === 0, pr.problemas.join(' | '));
    await pr.contexto.close();
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
