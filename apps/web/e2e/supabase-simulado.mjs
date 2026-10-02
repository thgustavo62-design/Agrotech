// Supabase SIMULADO para ver e medir o app logado sem backend (auth + REST + RPC com dados de exemplo).
// Não valida nada e não substitui teste contra o Supabase de verdade. Uso (ver e2e/LEIA-ME.md):
//   PAPEL=consultor|produtor node e2e/supabase-simulado.mjs
import http from 'node:http';
import crypto from 'node:crypto';

// Chaves ASSIMÉTRICAS (ES256) como nos projetos novos do Supabase: o app valida o token localmente com o JWKS.
// SIMETRICO=1 emite tokens HS256 (projeto antigo): aí o app cai na validação pela rede (getUser).
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const SIMETRICO = process.env.SIMETRICO === '1';
const KID = 'chave-simulada-1';
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
function assinar(corpo) {
  const cab = SIMETRICO ? { alg: 'HS256', typ: 'JWT' } : { alg: 'ES256', typ: 'JWT', kid: KID };
  const dados = b64(cab) + '.' + b64(corpo);
  const sig = SIMETRICO
    ? crypto.createHmac('sha256', 'segredo-simulado').update(dados).digest()
    : crypto.sign('sha256', Buffer.from(dados), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return dados + '.' + sig.toString('base64url');
}

const hoje = new Date();
const dia = (n) => new Date(hoje.getTime() + n * 86400000).toISOString().slice(0, 10);
const U = 'u0000000-0000-0000-0000-000000000001';
const O = 'o0000000-0000-0000-0000-000000000001';

const nomes = ['José da Silva Pereira', 'Maria Aparecida Souza', 'Antônio Carlos Ferreira', 'Sebastião Lima Rodrigues', 'Ana Paula dos Santos', 'Joaquim Alves de Oliveira'];
const mun = ['Colatina', 'Baixo Guandu', 'Marilândia', 'São Domingos do Norte', 'Pancas', 'Itaguaçu'];
const produtores = nomes.map((nome, i) => ({
  id: `p000000${i + 1}-0000-0000-0000-000000000000`, org_id: O, nome, email: `contato${i + 1}@exemplo.com`,
  telefone: `(27) 99${i}12-34${i}5`, municipio: mun[i], user_id: i === 0 ? U : (i === 1 ? 'pu000001' : null), cpf_cnpj: `123.456.78${i}-00`, criado_em: dia(-90 + i * 10),
}));
const propriedades = produtores.map((p, i) => ({ id: `r000000${i + 1}-0000-0000-0000-000000000000`, produtor_id: p.id, nome: ['Sítio Boa Vista', 'Fazenda Santa Rita', 'Chácara Esperança', 'Sítio Córrego Fundo', 'Fazenda Três Irmãos', 'Sítio Alto Verde'][i], municipio: mun[i], area_ha: 12 + i * 7, lat: -19.5 - i / 10, lng: -40.6 - i / 10 }));
const culturas = ['cafe-conilon', 'cafe-conilon', 'milho', 'cafe-arabica', 'pimenta-do-reino', 'cafe-conilon', 'eucalipto', 'cafe-conilon'];
const talhoes = culturas.map((c, i) => ({
  id: `t000000${i + 1}-0000-0000-0000-000000000000`, propriedade_id: propriedades[i % 6].id, produtor_id: produtores[i % 6].id, org_id: O,
  nome: `Talhão ${['Sede', 'Pé de Serra', 'Baixada', 'Mirante', 'Cabeceira', 'Grota', 'Lavoura Nova', 'Córrego'][i]}`,
  cultura: c, variedade: 'Vitória INCAPER 8142', area_ha: 3.5 + i * 1.25, prod_esperada: 60, espacamento: '3x1', ano_implantacao: 2015 + (i % 6), obs: null,
}));
const val = (i) => ({ ph: 4.8 + i * 0.2, mo: 1.9 + i * 0.3, p: 4 + i * 3, k: 40 + i * 12, na: 0, ca: 1.2 + i * 0.4, mg: 0.3 + i * 0.15, al: 1.1 - i * 0.15, h_al: 6.5 - i * 0.5, s: 4, b: 0.2, zn: 0.6, cu: 0.8, mn: 6, fe: 30, argila: 42, prnt: 80, incorporacao: 20 });
const analises = talhoes.slice(0, 6).map((t, i) => ({
  id: `a000000${i + 1}-0000-0000-0000-000000000000`, talhao_id: t.id, org_id: O, produtor_id: t.produtor_id, data_coleta: dia(-20 - i * 25), profundidade: '0-20', laboratorio: 'Laboratório Água Limpa',
  origem: i % 2 ? 'pdf' : 'manual', criado_em: dia(-19 - i * 25), arquivado_em: null, documento_id: null, prod_esperada: 60, ...val(i),
}));
const visitas = talhoes.slice(0, 4).map((t, i) => ({
  id: `v000000${i + 1}-0000-0000-0000-000000000000`, talhao_id: t.id, org_id: O, produtor_id: t.produtor_id, data: dia(-5 - i * 12), fenologia: ['Florada', 'Chumbinho', 'Granação', 'Colheita'][i],
  condicao: ['Boa', 'Regular', 'Preocupante', 'Boa'][i], observacoes: 'Lavoura em bom estado geral, atenção ao mato na entrelinha.', recomendacao: 'Roçar entrelinha e repetir adubação em 30 dias.', proxima_visita: dia(10 + i * 7), consultor_id: U,
}));
const ocorrencias = visitas.slice(0, 3).map((v, i) => ({ id: `oc${i}`, visita_id: v.id, alvo: ['Broca-do-café', 'Ferrugem', 'Cercospora'][i], valor: `${3 + i}% infestação`, acima_nivel: i === 0 }));
const fotos = [];
const agenda = [0, 1, 2, 3, 4].map((i) => ({ id: `ag${i}`, org_id: O, talhao_id: talhoes[i].id, produtor_id: talhoes[i].produtor_id, tipo: i % 2 ? 'visita' : 'coleta', titulo: ['Visita técnica', 'Coleta de solo', 'Retorno pós-calagem', 'Avaliação de colheita', 'Reunião com o produtor'][i], data: dia(i === 0 ? -2 : i * 3), hora: '08:30', status: i === 0 ? 'agendado' : 'agendado', obs: null, consultor_id: U }));
const notificacoes = [0, 1, 2].map((i) => ({ id: `n${i}`, org_id: O, destinatario_user_id: U, tipo: 'nova_analise', titulo: ['Laudo processado e aguardando conferência.', 'Visita marcada para amanhã.', 'Análise sem recomendação há 7 dias.'][i], corpo: null, link: '/app/laudos', lida_em: i === 2 ? dia(-1) : null, criado_em: new Date(hoje.getTime() - i * 3600000).toISOString() }));
const documentos = [0, 1, 2].map((i) => ({ id: `d${i}`, org_id: O, nome_arquivo: ['tomazin.pdf', 'laudo_boa_vista.pdf', 'analise_santa_rita.pdf'][i], status: ['revisao', 'confirmado', 'extraindo'][i], laboratorio: 'Laboratório Água Limpa', confianca_media: 0.86, criado_em: new Date(hoje.getTime() - i * 86400000).toISOString(), erro: null, storage_path: `x/${i}.pdf`, payload: null }));
const recomendacoes = analises.slice(0, 3).map((a, i) => ({ id: `rc${i}`, org_id: O, analise_id: a.id, produtor_id: a.produtor_id, emitida_em: new Date(hoje.getTime() - i * 5 * 86400000).toISOString(), motor_versao: '0.1.0', arquivada_em: null, pdf_path: null, resultado: {}, observacoes: null }));
const lancamentos = [0, 1, 2, 3, 4].map((i) => ({ id: `l${i}`, org_id: O, produtor_id: produtores[0].id, descricao: ['Adubo NPK 20-05-20', 'Mão de obra colheita', 'Venda de café', 'Combustível', 'Energia'][i], tipo: i === 2 ? 'receita' : 'despesa', valor: [3200, 4800, 18500, 640, 380][i], data: dia(-i * 6), status: i === 4 ? 'pendente' : 'pago', vencimento: dia(-i * 6), categoria_id: null, conta_id: null }));
const planos = [{ id: 'free', nome: 'Gratuito', preco_mes: 0, limites: {} }, { id: 'pro', nome: 'Profissional', preco_mes: 149, limites: {} }];

const T = {
  profiles: [{ id: U, org_id: O, role: process.env.PAPEL ?? 'consultor', nome: process.env.PAPEL === 'produtor' ? 'José da Silva Pereira' : 'Maria Souza', crea: 'ES-12345', art: null, fone: '(27) 99999-0000', titulo: 'Engenheira Agrônoma' }],
  orgs: [{ id: O, nome: 'Campo Forte Assistência Técnica', municipio: 'Colatina', uf: 'ES', plano: 'pro', cnpj: null, criado_em: dia(-200) }],
  produtores, propriedades, talhoes, analises, visitas, visita_ocorrencias: ocorrencias, visita_fotos: fotos, agenda_eventos: agenda, notificacoes, documentos, recomendacoes,
  vw_talhao_situacao: talhoes.map((t, i) => ({ talhao_id: t.id, nome: t.nome, cultura: t.cultura, area_ha: t.area_ha, data_coleta: analises[i % 6]?.data_coleta ?? null, situacao: ['precisa_correcao', 'em_ordem', 'sem_analise'][i % 3], produtor_id: t.produtor_id })),
  tabelas_referencia: [], financeiro_lancamentos: lancamentos, financeiro_escrit_lancamentos: lancamentos.map((l) => ({ ...l, produtor_id: null })),
  financeiro_categorias: [], financeiro_contas: [], financeiro_centros_custo: [], financeiro_orcamentos: [], financeiro_escrit_contas: [], financeiro_escrit_categorias: [],
  planos, assinaturas: [{ id: 's1', org_id: O, plano: 'pro', status: 'ativa', trial_expira_em: null, atual_ate: dia(20) }], cobrancas: [], convites_equipe: [], convites: [], compartilhamentos: [], safras: [], producao_registros: [],
  metricas_diarias: [], audit_log: [],
};

const PLURAL = { talhao: 'talhoes', produtor: 'produtores', propriedade: 'propriedades', analise: 'analises', visita: 'visitas', documento: 'documentos', consultor: 'profiles', org: 'orgs', recomendacao: 'recomendacoes' };

function divide(s) { // separa por vírgula respeitando parênteses
  const out = []; let nivel = 0; let atual = '';
  for (const ch of s) { if (ch === '(') nivel++; if (ch === ')') nivel--; if (ch === ',' && nivel === 0) { out.push(atual); atual = ''; } else atual += ch; }
  if (atual) out.push(atual);
  return out.map((x) => x.trim()).filter(Boolean);
}

function montar(linha, select) {
  const campos = divide(select || '*');
  const out = {};
  for (const c of campos) {
    const ab = c.indexOf('(');
    if (ab < 0) { if (c === '*') Object.assign(out, linha); else out[c] = linha[c] ?? null; continue; }
    const cabeca = c.slice(0, ab).replace(/!.*$/, ''); const interno = c.slice(ab + 1, c.lastIndexOf(')'));
    const [alias, alvo] = cabeca.includes(':') ? cabeca.split(':') : [cabeca, cabeca];
    if (alvo.endsWith('_id') || PLURAL[alvo]) { // objeto (FK)
      const base = alvo.replace(/_id$/, ''); const tab = T[PLURAL[base] ?? base];
      const fk = linha[alvo.endsWith('_id') ? alvo : `${alvo}_id`];
      const achado = tab?.find((r) => r.id === fk) ?? (tab && fk === undefined ? tab[0] : null);
      out[alias] = achado ? montar(achado, interno) : null;
    } else { // lista
      const tab = T[alvo] ?? [];
      const dono = Object.keys(linha).includes('id') ? linha.id : null;
      const filhos = tab.filter((r) => Object.values(r).includes(dono));
      out[alias] = filhos.map((r) => montar(r, interno));
    }
  }
  return out;
}

const painel = {
  produtores: produtores.length, talhoes: talhoes.length, area_total: talhoes.reduce((s, t) => s + t.area_ha, 0), analises: analises.length, laudos_fila: 2,
  pendencias: talhoes.slice(0, 3).map((t, i) => ({ talhao_id: t.id, nome: t.nome, analise_id: analises[i].id, cultura: t.cultura, v: 22 + i * 6, m: 41 - i * 8, data_coleta: analises[i].data_coleta })),
  area_por_cultura: { 'cafe-conilon': 21.5, milho: 5.0, 'cafe-arabica': 6.25, 'pimenta-do-reino': 7.5, eucalipto: 10 },
  visitas_atrasadas_total: 2, visitas_atrasadas: talhoes.slice(3, 5).map((t) => ({ talhao_id: t.id, nome: t.nome, data: dia(-9) })),
  proximas_visitas: talhoes.slice(0, 2).map((t) => ({ talhao_id: t.id, nome: t.nome, data: dia(3) })),
  recomendacoes_pendentes_total: 2, recomendacoes_pendentes: analises.slice(3, 5).map((a, i) => ({ talhao_id: a.talhao_id, nome: talhoes[3 + i].nome, analise_id: a.id, data_coleta: a.data_coleta })),
  recomendacoes_emitidas_mes: 7, produtores_sem_visita_recente: 2, talhoes_sem_analise_atualizada: 3,
  atividade_recente: [],
};

const jwt = assinar;

// LATENCIA_MS simula a ida e volta até o Supabase (ex.: 80); LOG=1 imprime cada chamada com o instante.
const LATENCIA = Number(process.env.LATENCIA_MS ?? 0);
const t0 = Date.now();
http.createServer((req0, res0) => {
  const rotulo = new URL(req0.url, 'http://x').pathname.replace('/rest/v1/', '').replace('/auth/v1/', 'auth:');
  if (process.env.LOG) console.log(`${Date.now() - t0}	${req0.method}	${rotulo}`);
  setTimeout(() => atender(req0, res0), LATENCIA);
}).listen(54321, '127.0.0.1', () => console.log('supabase simulado em :54321'));

// o papel (consultor|produtor) vem do token da requisição: uma instância atende os dois portais
function papelDaRequisicao(req) {
  try {
    const carga = (req.headers.authorization ?? '').split('.')[1];
    return JSON.parse(Buffer.from(carga, 'base64url').toString()).user_role ?? process.env.PAPEL ?? 'consultor';
  } catch { return process.env.PAPEL ?? 'consultor'; }
}
function atender(req, res) {
  const url = new URL(req.url, 'http://x');
  const papel = papelDaRequisicao(req);
  T.profiles = [{ id: U, org_id: O, role: papel, nome: papel === 'produtor' ? 'José da Silva Pereira' : 'Maria Souza', crea: 'ES-12345', art: null, fone: '(27) 99999-0000', titulo: 'Engenheira Agrônoma' }];
  const json = (obj, status = 200, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...extra }); res.end(JSON.stringify(obj)); };

  if (url.pathname === '/auth/v1/.well-known/jwks.json') return json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' }] });
  if (url.pathname === '/__sessao') { // valor do cookie de sessão para os scripts de teste
    const papel = url.searchParams.get('papel') ?? 'consultor';
    const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
    const sessao = { access_token: jwt({ sub: U, exp, iat: exp - 3600, aud: 'authenticated', role: 'authenticated', user_role: papel, org_id: O }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: { id: U, email: 'maria@exemplo.com' } };
    return json({ cookie: 'base64-' + Buffer.from(JSON.stringify(sessao)).toString('base64url') });
  }
  if (url.pathname === '/auth/v1/user') return json({ id: U, aud: 'authenticated', role: 'authenticated', email: 'maria@exemplo.com', user_metadata: {}, app_metadata: {} });
  if (url.pathname === '/auth/v1/token') return json({ access_token: jwt({ sub: U, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated', user_role: process.env.PAPEL ?? 'consultor', org_id: O }), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: U, email: 'maria@exemplo.com' } });
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }

  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').pop();
    if (fn === 'painel_consultor') return json(painel);
    if (fn === 'tenho_feature') return json(true);
    if (fn === 'producao_visivel_consultor' || fn === 'casar_produtor') return json([]);
    return json(null);
  }

  if (url.pathname.startsWith('/rest/v1/')) {
    const tabela = url.pathname.split('/').pop();
    let linhas = [...(T[tabela] ?? [])];
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v); if (m) linhas = linhas.filter((r) => String(r[k]) === m[1]);
      const i = /^in\.\((.*)\)$/.exec(v); if (i) { const lista = i[1].split(',').map((x) => x.replace(/"/g, '')); linhas = linhas.filter((r) => lista.includes(String(r[k]))); }
    }
    const lim = Number(url.searchParams.get('limit')); if (lim) linhas = linhas.slice(0, lim);
    const total = linhas.length;
    const extra = { 'content-range': total ? `0-${total - 1}/${total}` : '*/0' };
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(201, { 'content-type': 'application/json' }); return res.end('[]'); }
    if (req.method === 'HEAD') { res.writeHead(200, extra); return res.end(); }
    const montadas = linhas.map((r) => montar(r, url.searchParams.get('select')));
    if ((req.headers.accept ?? '').includes('vnd.pgrst.object')) {
      if (!montadas.length) return json({ code: 'PGRST116', message: 'The result contains 0 rows', details: null, hint: null }, 406, extra);
      return json(montadas[0], 200, extra);
    }
    return json(montadas, 200, extra);
  }
  json({}, 404);
}
