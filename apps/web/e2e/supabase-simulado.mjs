// Supabase SIMULADO para ver e medir o app logado sem backend (auth + REST + RPC com dados de exemplo).
// Não valida nada e não substitui teste contra o Supabase de verdade. Uso (ver e2e/LEIA-ME.md):
//   PAPEL=consultor|produtor node e2e/supabase-simulado.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

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
  telefone: `(27) 99${i}12-34${i}5`, fone: `(27) 99${i}12-34${i}5`, municipio: mun[i], user_id: i === 0 ? U : (i === 1 ? 'pu000001' : null), cpf_cnpj: `123.456.78${i}-00`, criado_em: dia(-90 + i * 10),
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
  origem: i % 2 ? 'pdf' : 'manual', criado_em: dia(-19 - i * 25), arquivado_em: null, documento_id: null, prod_esperada: 60, ...val(i), ...(process.env.INCOMPLETA && i === 0 ? { ca: null, mg: '', b: null } : {}), ...(process.env.SUB2040 && i === 1 ? { profundidade: '20-40' } : {}),
}));
const visitas = talhoes.slice(0, 4).map((t, i) => ({
  id: `v000000${i + 1}-0000-0000-0000-000000000000`, talhao_id: t.id, org_id: O, produtor_id: t.produtor_id, data: dia(-5 - i * 12), fenologia: ['Florada', 'Chumbinho', 'Granação', 'Colheita'][i],
  condicao: ['Boa', 'Regular', 'Preocupante', 'Boa'][i], observacoes: 'Lavoura em bom estado geral, atenção ao mato na entrelinha.', recomendacao: 'Roçar entrelinha e repetir adubação em 30 dias.', proxima_visita: dia(10 + i * 7), consultor_id: U,
}));
const ocorrencias = visitas.slice(0, 3).map((v, i) => ({ id: `oc${i}`, visita_id: v.id, alvo: ['Broca-do-café', 'Ferrugem', 'Cercospora'][i], valor: `${3 + i}% infestação`, acima_nivel: i === 0 }));
const fotos = [];
const agenda = [0, 1, 2, 3, 4].map((i) => ({ id: `ag${i}`, org_id: O, talhao_id: talhoes[i].id, produtor_id: talhoes[i].produtor_id, tipo: i % 2 ? 'visita' : 'coleta', titulo: ['Visita técnica', 'Coleta de solo', 'Retorno pós-calagem', 'Avaliação de colheita', 'Reunião com o produtor'][i], data: dia(i === 0 ? -2 : i * 3), hora: '08:30', status: 'planejado', obs: null, consultor_id: U }));
const notificacoes = [0, 1, 2].map((i) => ({ id: `n${i}`, org_id: O, destinatario_user_id: U, tipo: 'nova_analise', titulo: ['Laudo processado e aguardando conferência.', 'Visita marcada para amanhã.', 'Análise sem recomendação há 7 dias.'][i], corpo: null, link: '/app/laudos', lida_em: i === 2 ? dia(-1) : null, criado_em: new Date(hoje.getTime() - i * 3600000).toISOString() }));
const documentos = [0, 1, 2].map((i) => ({ id: `d${i}`, org_id: O, nome_arquivo: ['tomazin.pdf', 'laudo_boa_vista.pdf', 'analise_santa_rita.pdf'][i], status: ['revisao', 'confirmado', 'extraindo'][i], laboratorio: 'Laboratório Água Limpa', confianca_media: 0.86, criado_em: new Date(hoje.getTime() - i * 86400000).toISOString(), erro: null, storage_path: `x/${i}.pdf`, payload: null }));
const recomendacoes = analises.slice(0, 3).map((a, i) => ({ id: `rc${i}`, org_id: O, analise_id: a.id, produtor_id: a.produtor_id, emitida_em: new Date(hoje.getTime() - i * 5 * 86400000).toISOString(), motor_versao: '0.1.0', arquivada_em: null, pdf_path: null, resultado: {}, observacoes: null }));
const lancamentos = [0, 1, 2, 3, 4].map((i) => ({ id: `l${i}`, org_id: O, produtor_id: produtores[0].id, descricao: ['Adubo NPK 20-05-20', 'Mão de obra colheita', 'Venda de café', 'Combustível', 'Energia'][i], tipo: i === 2 ? 'receita' : 'despesa', valor: [3200, 4800, 18500, 640, 380][i], data: dia(-i * 6), status: i === 4 ? 'pendente' : 'pago', vencimento: dia(-i * 6), categoria_id: null, conta_id: null }));
const planos = [{ id: 'free', nome: 'Gratuito', preco_mes: 0, limites: {}, usuarios_max: 1 }, { id: 'pro', nome: 'Profissional', preco_mes: 149, limites: {}, usuarios_max: 5 }];
// equipe do escritório (a pessoa logada é a primeira; os perfis dela vêm do token — ver __sessao?perfis=)
const COLEGAS = [
  { id: 'c1000000-0000-0000-0000-000000000002', org_id: O, role: 'consultor', nome: 'Carlos Pereira', crea: 'ES-22222', art: null, fone: null, titulo: 'Técnico de campo', perfis: ['campo'] },
  { id: 'c1000000-0000-0000-0000-000000000003', org_id: O, role: 'consultor', nome: 'Ana Lima', crea: null, art: null, fone: null, titulo: 'Financeiro', perfis: ['financeiro'] },
];
const convitesEquipe = [{ id: 'cv1', org_id: O, email: 'joao@exemplo.com', titulo: 'Agrônomo', perfis: ['agronomico', 'campo'], token: '71111111-0000-0000-0000-000000000001', expira_em: dia(6), usado_em: null, criado_em: dia(-1) }];
const auditoria = [
  { id: 3, org_id: O, user_id: U, acao: 'equipe.convidado', dados: { email: 'joao@exemplo.com', perfis: ['agronomico', 'campo'] }, criado_em: dia(-1) + 'T10:00:00Z' },
  { id: 2, org_id: O, user_id: U, acao: 'equipe.perfis_alterados', dados: { nome: 'Ana Lima', perfis: ['financeiro'] }, criado_em: dia(-4) + 'T10:00:00Z' },
  { id: 1, org_id: O, user_id: U, acao: 'escritorio.editado', dados: null, criado_em: dia(-9) + 'T10:00:00Z' },
];

// Academy: ids em formato UUID (as páginas validam)
const AC = { video: '62aaaaaa-0000-0000-0000-000000000001', artigo: '62aaaaaa-0000-0000-0000-000000000002', material: '62aaaaaa-0000-0000-0000-000000000003', rascunho: '62aaaaaa-0000-0000-0000-000000000004', noticia: '62aaaaaa-0000-0000-0000-000000000005' };
const CU = { cafe: '62cccccc-0000-0000-0000-000000000001', pragas: '62cccccc-0000-0000-0000-000000000002', rascunho: '62cccccc-0000-0000-0000-000000000003' };
const conteudoBase = { org_id: O, autor_id: U, descricao: null, cultura: null, tema: null, nivel: 'basico', duracao_min: null, url: null, corpo: null, arquivo_path: null, fonte: null, status: 'publicado', visibilidade: 'todos', revisado_em: dia(-3) + 'T10:00:00Z', publicado_em: dia(-3) + 'T10:00:00Z', criado_em: dia(-4) + 'T10:00:00Z', atualizado_em: dia(-3) + 'T10:00:00Z' };
const academy_conteudos = [
  { ...conteudoBase, id: AC.video, tipo: 'video', titulo: 'Calagem na prática: quando e quanto aplicar', descricao: 'Como ler a análise e decidir a calagem.', cultura: 'Café', tema: 'calagem', duracao_min: 12, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', fonte: 'Produzido pelo escritório' },
  { ...conteudoBase, id: AC.artigo, tipo: 'artigo', titulo: 'Adubação de cobertura no café', descricao: 'Parcelamento do nitrogênio.', cultura: 'Café', tema: 'adubacao', nivel: 'intermediario', corpo: ['Primeiro parágrafo da aula.', '', 'Segundo parágrafo, depois de uma linha em branco.'].join('\n'), visibilidade: 'selecionados' },
  { ...conteudoBase, id: AC.material, tipo: 'material', titulo: 'Cartilha: coleta de solo', tema: 'solo', url: 'https://www.embrapa.br/cartilha-coleta', fonte: 'Embrapa (link)' },
  { ...conteudoBase, id: AC.rascunho, tipo: 'video', titulo: 'Rascunho: ferrugem do cafeeiro', cultura: 'Café', tema: 'doencas', status: 'rascunho', revisado_em: null, publicado_em: null },
  { ...conteudoBase, id: AC.noticia, tipo: 'noticia', titulo: 'Chuva volta ao Norte do ES e preocupa cafeicultores', descricao: 'Resumo do escritório: as chuvas devem voltar na próxima semana.', url: 'https://www.incaper.es.gov.br/noticia-exemplo', fonte: 'Incaper', data_materia: dia(-5), regiao: 'Norte do ES', nivel: 'basico' },
];
const cursoBase = { org_id: O, autor_id: U, resumo: null, descricao: null, cultura: null, tema: null, nivel: 'basico', capa_path: null, destaque: false, certificado: true, status: 'publicado', visibilidade: 'todos', revisado_em: dia(-3) + 'T10:00:00Z', publicado_em: dia(-3) + 'T10:00:00Z', criado_em: dia(-4) + 'T10:00:00Z', atualizado_em: dia(-3) + 'T10:00:00Z' };
const academy_cursos = [
  { ...cursoBase, id: CU.cafe, titulo: 'Calagem e adubação do café na prática', resumo: 'Da análise de solo à decisão: quanto aplicar e quando.', descricao: 'Neste curso você aprende a ler a análise de solo e a decidir calagem e adubação de cobertura.', cultura: 'Café', tema: 'calagem', destaque: true },
  { ...cursoBase, id: CU.pragas, titulo: 'Manejo de pragas e doenças do cafeeiro', resumo: 'Reconhecer, monitorar e agir a tempo.', cultura: 'Café', tema: 'doencas', nivel: 'intermediario', publicado_em: dia(-8) + 'T10:00:00Z' },
  { ...cursoBase, id: CU.rascunho, titulo: 'Curso em preparação', status: 'rascunho', revisado_em: null, publicado_em: null },
];
const MO = { a: '62dddddd-0000-0000-0000-000000000001', b: '62dddddd-0000-0000-0000-000000000002', c: '62dddddd-0000-0000-0000-000000000003' };
const academy_curso_modulos = [
  { id: MO.a, org_id: O, curso_id: CU.cafe, titulo: 'Entendendo a análise', posicao: 0 },
  { id: MO.b, org_id: O, curso_id: CU.cafe, titulo: 'Adubação de cobertura', posicao: 1 },
  { id: MO.c, org_id: O, curso_id: CU.pragas, titulo: 'Pragas e doenças', posicao: 0 },
];
const academy_curso_aulas = [
  { id: '62eeeeee-0000-0000-0000-000000000001', org_id: O, curso_id: CU.cafe, modulo_id: MO.a, conteudo_id: AC.video, posicao: 0, conteudo: null },
  { id: '62eeeeee-0000-0000-0000-000000000002', org_id: O, curso_id: CU.cafe, modulo_id: MO.a, conteudo_id: AC.material, posicao: 1, conteudo: null },
  { id: '62eeeeee-0000-0000-0000-000000000003', org_id: O, curso_id: CU.cafe, modulo_id: MO.b, conteudo_id: AC.artigo, posicao: 0, conteudo: null },
  { id: '62eeeeee-0000-0000-0000-000000000004', org_id: O, curso_id: CU.pragas, modulo_id: MO.c, conteudo_id: AC.noticia, posicao: 0, conteudo: null },
];
const academy_matriculas = [
  { id: '62fffff1-0000-0000-0000-000000000001', org_id: O, curso_id: CU.cafe, produtor_id: produtores[0].id, criado_em: dia(-3) + 'T10:00:00Z', concluido_em: null },
  { id: '62fffff1-0000-0000-0000-000000000002', org_id: O, curso_id: CU.pragas, produtor_id: produtores[0].id, criado_em: dia(-7) + 'T10:00:00Z', concluido_em: dia(-6) + 'T10:00:00Z' },
];
const academy_progresso = [
  { produtor_id: produtores[0].id, conteudo_id: AC.video, org_id: O, iniciado_em: dia(-2) + 'T10:00:00Z', concluido_em: null },
  { produtor_id: produtores[0].id, conteudo_id: AC.material, org_id: O, iniciado_em: dia(-5) + 'T10:00:00Z', concluido_em: dia(-4) + 'T09:00:00Z' },
  { produtor_id: produtores[0].id, conteudo_id: AC.noticia, org_id: O, iniciado_em: dia(-7) + 'T10:00:00Z', concluido_em: dia(-6) + 'T10:00:00Z' },
];
const academy_certificados = [
  { id: '62fffff2-0000-0000-0000-000000000001', org_id: O, curso_id: CU.pragas, produtor_id: produtores[0].id, codigo: 'AT-1A2B3-C4D5E', emitido_em: dia(-6) + 'T10:00:00Z', titulo_curso: 'Manejo de pragas e doenças do cafeeiro', aluno_nome: 'José da Silva Pereira', escritorio_nome: 'Campo Forte Assistência Técnica', responsavel_nome: 'Maria Souza', responsavel_crea: 'ES-12345', carga_min: 0, aulas: 1 },
];
const academy_publicos = [{ conteudo_id: AC.artigo, produtor_id: produtores[0].id, org_id: O, criado_em: dia(-3) + 'T10:00:00Z' }];
const academy_indicacoes = [
  { id: '62bbbbbb-0000-0000-0000-000000000003', org_id: O, conteudo_id: null, curso_id: CU.cafe, produtor_id: produtores[0].id, indicado_por: U, visita_id: null, analise_id: null, mensagem: 'Faça este curso antes da safra.', criado_em: dia(-1) + 'T10:00:00Z', aberto_em: null, concluido_em: null },
  { id: '62bbbbbb-0000-0000-0000-000000000001', org_id: O, conteudo_id: AC.video, produtor_id: produtores[0].id, indicado_por: U, visita_id: null, analise_id: null, mensagem: 'Assista antes da nossa visita de quinta.', criado_em: dia(-2) + 'T10:00:00Z', aberto_em: null, concluido_em: null },
  { id: '62bbbbbb-0000-0000-0000-000000000002', org_id: O, conteudo_id: AC.material, produtor_id: produtores[0].id, indicado_por: U, visita_id: null, analise_id: null, mensagem: null, criado_em: dia(-5) + 'T10:00:00Z', aberto_em: dia(-5) + 'T11:00:00Z', concluido_em: dia(-4) + 'T09:00:00Z' },
];
for (const a of academy_curso_aulas) { const c = academy_conteudos.find((x) => x.id === a.conteudo_id); a.conteudo = c ? { titulo: c.titulo, tipo: c.tipo, status: c.status, duracao_min: c.duracao_min } : null; }
// Connect: pedidos do produtor (ids em formato UUID, as páginas validam). O simulador não tem RLS: para o produtor,
// `atender` filtra por produtor e esconde nota interna (ver CONNECT_PRODUTOR abaixo).
const AT = { folhas: '63aaaaaa-0000-0000-0000-000000000001', calagem: '63aaaaaa-0000-0000-0000-000000000002', laudo: '63aaaaaa-0000-0000-0000-000000000003', broca: '63aaaaaa-0000-0000-0000-000000000004', de_outro: '63aaaaaa-0000-0000-0000-000000000005' };
const atBase = { org_id: O, propriedade_id: null, talhao_id: null, criado_por: U, descricao: null, categoria: 'duvida', prioridade: 'normal', status: 'novo', origem: 'portal', vencimento: null, resolvido_em: null, avaliacao: null, avaliacao_comentario: null, avaliado_em: null, responsavel_id: null };
const atendimentos = [
  { ...atBase, id: AT.folhas, produtor_id: produtores[0].id, assunto: 'Folhas amareladas no talhão da frente', descricao: 'Começou há uma semana, depois da chuva forte.', categoria: 'problema_lavoura', prioridade: 'alta', status: 'em_acompanhamento', responsavel_id: COLEGAS[0].id, vencimento: dia(2), talhao_id: talhoes[0].id, propriedade_id: propriedades[0].id, ultima_interacao_em: dia(-1) + 'T10:00:00Z', criado_em: dia(-3) + 'T08:00:00Z' },
  { ...atBase, id: AT.calagem, produtor_id: produtores[0].id, assunto: 'Dúvida sobre a calagem', status: 'aguardando_produtor', responsavel_id: COLEGAS[0].id, ultima_interacao_em: dia(-2) + 'T10:00:00Z', criado_em: dia(-6) + 'T08:00:00Z' },
  { ...atBase, id: AT.laudo, produtor_id: produtores[0].id, assunto: 'Pedido de laudo da safra', categoria: 'documento', status: 'resolvido', responsavel_id: COLEGAS[0].id, resolvido_em: dia(-1) + 'T10:00:00Z', ultima_interacao_em: dia(-1) + 'T10:00:00Z', criado_em: dia(-8) + 'T08:00:00Z' },
  { ...atBase, id: AT.broca, produtor_id: produtores[2].id, assunto: 'Visita para avaliar a broca', categoria: 'pedido_visita', prioridade: 'urgente', vencimento: dia(-3), ultima_interacao_em: dia(-5) + 'T10:00:00Z', criado_em: dia(-5) + 'T08:00:00Z' },
  { ...atBase, id: AT.de_outro, produtor_id: produtores[1].id, assunto: 'Assunto de outro produtor', ultima_interacao_em: dia(-1) + 'T10:00:00Z', criado_em: dia(-1) + 'T08:00:00Z' },
];
for (const a of atendimentos) a.produtores_id = a.produtor_id; // o simulador resolve `produtores(nome)` pela coluna <alvo>_id
const msg = (n, at, tipo, corpo, quando, interna = false) => ({ id: `63bbbbbb-0000-0000-0000-00000000000${n}`, org_id: O, atendimento_id: at, produtor_id: produtores[0].id, autor_id: tipo === 'equipe' ? COLEGAS[0].id : U, autor_tipo: tipo, corpo, interna, criado_em: quando });
const atendimento_mensagens = [
  msg(1, AT.folhas, 'produtor', 'Boa tarde! As folhas estão amarelando nas pontas.', dia(-3) + 'T09:00:00Z'),
  msg(2, AT.folhas, 'equipe', 'Boa tarde, José. Consegue mandar uma foto da folha?', dia(-2) + 'T09:00:00Z'),
  msg(3, AT.folhas, 'equipe', 'Suspeita de falta de nitrogênio — conferir a última análise antes de responder.', dia(-2) + 'T09:30:00Z', true),
  msg(4, AT.calagem, 'equipe', 'Qual foi a data da última calagem?', dia(-2) + 'T10:00:00Z'),
];
const atendimento_arquivos = [
  { id: '63cccccc-0000-0000-0000-000000000001', org_id: O, atendimento_id: AT.folhas, mensagem_id: null, produtor_id: produtores[0].id, autor_id: U, storage_path: `${O}/${AT.folhas}/folha.jpg`, nome: 'folha.jpg', mime: 'image/jpeg', bytes: 52000, interna: false, criado_em: dia(-3) + 'T08:00:00Z' },
];
const atendimento_eventos = [
  { id: '63dddddd-0000-0000-0000-000000000001', org_id: O, atendimento_id: AT.folhas, produtor_id: produtores[0].id, tipo: 'criado', de: null, para: 'novo', autor_id: U, criado_em: dia(-3) + 'T08:00:00Z' },
  { id: '63dddddd-0000-0000-0000-000000000002', org_id: O, atendimento_id: AT.folhas, produtor_id: produtores[0].id, tipo: 'responsavel', de: null, para: COLEGAS[0].id, autor_id: COLEGAS[0].id, criado_em: dia(-3) + 'T08:30:00Z' },
  { id: '63dddddd-0000-0000-0000-000000000003', org_id: O, atendimento_id: AT.folhas, produtor_id: produtores[0].id, tipo: 'status', de: 'novo', para: 'em_acompanhamento', autor_id: COLEGAS[0].id, criado_em: dia(-2) + 'T09:00:00Z' },
  { id: '63dddddd-0000-0000-0000-000000000004', org_id: O, atendimento_id: AT.folhas, produtor_id: produtores[0].id, tipo: 'prazo', de: null, para: dia(2), autor_id: COLEGAS[0].id, criado_em: dia(-2) + 'T09:10:00Z' },
  { id: '63dddddd-0000-0000-0000-000000000005', org_id: O, atendimento_id: AT.folhas, produtor_id: produtores[0].id, tipo: 'prioridade', de: 'normal', para: 'alta', autor_id: COLEGAS[0].id, criado_em: dia(-2) + 'T09:11:00Z' },
];
notificacoes.push(
  { id: 'n63a', org_id: O, destinatario_user_id: U, tipo: 'atendimento_resposta', titulo: 'O técnico respondeu: Folhas amareladas no talhão da frente', corpo: 'Boa tarde, José. Consegue mandar uma foto da folha?', link: `/connect/pedidos/${AT.folhas}`, lida_em: null, criado_em: new Date(hoje.getTime() - 3600000).toISOString() },
  { id: 'n63b', org_id: O, destinatario_user_id: U, tipo: 'atendimento_status', titulo: 'O técnico precisa de uma informação sua: Dúvida sobre a calagem', corpo: null, link: `/connect/pedidos/${AT.calagem}`, lida_em: dia(-1) + 'T10:00:00Z', criado_em: new Date(hoje.getTime() - 86400000).toISOString() },
);
const T = {
  profiles: [{ id: U, org_id: O, role: process.env.PAPEL ?? 'consultor', nome: process.env.PAPEL === 'produtor' ? 'José da Silva Pereira' : 'Maria Souza', crea: 'ES-12345', art: null, fone: '(27) 99999-0000', titulo: 'Engenheira Agrônoma' }],
  orgs: [{ id: O, nome: 'Campo Forte Assistência Técnica', municipio: 'Colatina', uf: 'ES', plano: 'pro', cnpj: null, criado_em: dia(-200) }],
  produtores, propriedades, talhoes, analises, visitas, visita_ocorrencias: ocorrencias, visita_fotos: fotos, agenda_eventos: agenda, notificacoes, documentos, recomendacoes,
  vw_talhao_situacao: talhoes.map((t, i) => ({ talhao_id: t.id, nome: t.nome, cultura: t.cultura, area_ha: t.area_ha, data_coleta: analises[i % 6]?.data_coleta ?? null, situacao: ['precisa_correcao', 'em_ordem', 'sem_analise'][i % 3], produtor_id: t.produtor_id })),
  tabelas_referencia: [], financeiro_lancamentos: lancamentos, financeiro_escrit_lancamentos: lancamentos.map((l) => ({ ...l, produtor_id: null })),
  financeiro_categorias: [], financeiro_contas: [], financeiro_centros_custo: [], financeiro_orcamentos: [], financeiro_escrit_contas: [], financeiro_escrit_categorias: [],
  planos, assinaturas: [{ id: 's1', org_id: O, plano: 'pro', planos_id: 'pro', status: 'ativa', trial_expira_em: null, atual_ate: dia(20) }], cobrancas: [], convites_equipe: convitesEquipe, convites: [], compartilhamentos: [], safras: [], producao_registros: [],
  metricas_diarias: [], audit_log: auditoria, academy_conteudos, academy_publicos, academy_indicacoes,
  academy_cursos, academy_curso_modulos, academy_curso_aulas, academy_curso_publicos: [], academy_matriculas, academy_progresso, academy_certificados,
  atendimentos, atendimento_mensagens, atendimento_arquivos, atendimento_eventos,
};
const TABELAS_CONNECT = ['atendimentos', 'atendimento_mensagens', 'atendimento_arquivos', 'atendimento_eventos'];

// LAUDO_PAYLOAD=arquivo.json: extração (com recortes) para o laudo em conferência d0, para olhar a tela de conferência
if (process.env.LAUDO_PAYLOAD) documentos[0].payload = JSON.parse(readFileSync(process.env.LAUDO_PAYLOAD, 'utf8'));
const PLURAL = { curso: 'academy_cursos', conteudo: 'academy_conteudos',  talhao: 'talhoes', produtor: 'produtores', propriedade: 'propriedades', analise: 'analises', visita: 'visitas', documento: 'documentos', consultor: 'profiles', org: 'orgs', recomendacao: 'recomendacoes', planos: 'planos', produtores: 'produtores' };

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
let seq = 0;
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
/** lê o corpo da requisição como JSON (vazio = {}) e entrega ao tratador */
function corpoJson(req, tratador) {
  let c = ''; req.on('data', (d) => { c += d; });
  req.on('end', () => { let b = {}; try { b = c ? JSON.parse(c) : {}; } catch { /* corpo não é JSON (upload): ignora */ } tratador(b); });
}

// LATENCIA_MS simula a ida e volta até o Supabase (ex.: 80); LOG=1 imprime cada chamada com o instante.
const LATENCIA = Number(process.env.LATENCIA_MS ?? 0);
const t0 = Date.now();
http.createServer((req0, res0) => {
  const rotulo = new URL(req0.url, 'http://x').pathname.replace('/rest/v1/', '').replace('/auth/v1/', 'auth:');
  if (process.env.LOG) console.log(`${Date.now() - t0}	${req0.method}	${rotulo}`);
  // o navegador também fala direto com o Auth (login, verifyOtp, updateUser…): precisa de CORS
  res0.setHeader('access-control-allow-origin', req0.headers.origin ?? '*');
  res0.setHeader('access-control-allow-headers', req0.headers['access-control-request-headers'] ?? '*');
  res0.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res0.setHeader('access-control-expose-headers', 'content-range');
  if (req0.method === 'OPTIONS') { res0.writeHead(204); return res0.end(); }
  setTimeout(() => atender(req0, res0), LATENCIA);
}).listen(54321, '127.0.0.1', () => console.log('supabase simulado em :54321'));

// o papel (consultor|produtor) vem do token da requisição: uma instância atende os dois portais
function claimsDaRequisicao(req) {
  try { return JSON.parse(Buffer.from((req.headers.authorization ?? '').split('.')[1], 'base64url').toString()); } catch { return {}; }
}
function papelDaRequisicao(req) {
  try {
    const carga = (req.headers.authorization ?? '').split('.')[1];
    return JSON.parse(Buffer.from(carga, 'base64url').toString()).user_role ?? process.env.PAPEL ?? 'consultor';
  } catch { return process.env.PAPEL ?? 'consultor'; }
}
function atender(req, res) {
  const url = new URL(req.url, 'http://x');
  const papel = papelDaRequisicao(req);
  const perfisSim = String(claimsDaRequisicao(req).perfis_sim || process.env.PERFIS || 'proprietario').split(',').filter(Boolean);
  T.profiles = [{ id: U, org_id: O, role: papel, nome: papel === 'produtor' ? 'José da Silva Pereira' : 'Maria Souza', crea: process.env.SEM_CREA ? '' : 'ES-12345', art: null, fone: '(27) 99999-0000', titulo: 'Engenheira Agrônoma', perfis: papel === 'produtor' ? [] : perfisSim, senha_provisoria: Boolean(process.env.PROVISORIA), mfa_ativo: Boolean(process.env.MFA), desativado_em: process.env.DESATIVADO ? '2026-10-02T00:00:00Z' : null }, ...(papel === 'produtor' ? [] : COLEGAS)];
  const json = (obj, status = 200, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...extra }); res.end(JSON.stringify(obj)); };

  if (url.pathname === '/auth/v1/.well-known/jwks.json') return json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' }] });
  if (url.pathname === '/__sessao') { // valor do cookie de sessão para os scripts de teste
    const papel = url.searchParams.get('papel') ?? 'consultor';
    const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
    const sessao = { access_token: jwt({ sub: U, exp, iat: exp - 3600, aud: 'authenticated', role: 'authenticated', user_role: papel, org_id: O, aal: process.env.AAL ?? 'aal1', perfis_sim: url.searchParams.get('perfis') ?? undefined }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: { id: U, email: 'maria@exemplo.com' } };
    return json({ cookie: 'base64-' + Buffer.from(JSON.stringify(sessao)).toString('base64url') });
  }
  // admin (service role): dados de um usuário e link de recuperação; verify troca o token_hash por sessão
  if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') return json({ id: 'c1000000-0000-0000-0000-0000000000ff', aud: 'authenticated', role: 'authenticated', email: 'novo@exemplo.com', user_metadata: {}, app_metadata: {} });
  if (url.pathname.startsWith('/auth/v1/admin/users/')) return json({ id: url.pathname.split('/').pop(), aud: 'authenticated', role: 'authenticated', email: 'carlos@exemplo.com', user_metadata: {}, app_metadata: {} });
  if (url.pathname === '/auth/v1/admin/generate_link') return json({ id: 'c1000000-0000-0000-0000-000000000002', email: 'carlos@exemplo.com', action_link: 'http://x/verify', email_otp: '123456', hashed_token: 'a1b2c3d4e5f6a7b8c9d0e1f2', redirect_to: '', verification_type: 'recovery' });
  if (url.pathname === '/auth/v1/recover') return json({});
  if (url.pathname === '/auth/v1/verify') { const exp = Math.floor(Date.now() / 1000) + 3600; return json({ access_token: jwt({ sub: U, exp, aud: 'authenticated', role: 'authenticated', user_role: 'consultor', org_id: O }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: { id: U, email: 'maria@exemplo.com' } }); }
  // MFA (TOTP): a lista de fatores vem dentro do usuário; enroll/challenge/verify mínimos
  if (url.pathname === '/auth/v1/factors' && req.method === 'POST') return json({ id: 'f-novo', type: 'totp', friendly_name: 'AgroTech', totp: { qr_code: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="black"/></svg>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/AgroTech' } });
  if (/^\/auth\/v1\/factors\/[^/]+\/challenge$/.test(url.pathname)) return json({ id: 'ch1', expires_at: Math.floor(Date.now() / 1000) + 300 });
  if (/^\/auth\/v1\/factors\/[^/]+\/verify$/.test(url.pathname)) {
    let corpo = ''; req.on('data', (d) => { corpo += d; });
    return req.on('end', () => {
      if (!corpo.includes('"code":"123456"')) return json({ code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
      const exp = Math.floor(Date.now() / 1000) + 3600;
      json({ access_token: jwt({ sub: U, exp, aud: 'authenticated', role: 'authenticated', user_role: 'consultor', org_id: O, aal: 'aal2' }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: { id: U, email: 'maria@exemplo.com' } });
    });
  }
  if (/^\/auth\/v1\/factors\/[^/]+$/.test(url.pathname) && req.method === 'DELETE') return json({ id: 'f1' });
  if (url.pathname === '/auth/v1/user') return json({ id: U, aud: 'authenticated', role: 'authenticated', email: 'maria@exemplo.com', user_metadata: {}, app_metadata: {}, factors: process.env.MFA ? [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'AgroTech' }] : [] });
  if (url.pathname === '/auth/v1/token') return json({ access_token: jwt({ sub: U, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated', user_role: process.env.PAPEL ?? 'consultor', org_id: O }), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: U, email: 'maria@exemplo.com' } });
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }

  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').pop();
    if (fn === 'painel_consultor') return json(painel);
    if (fn === 'tenho_feature') return json(true);
    if (fn === 'producao_visivel_consultor' || fn === 'casar_produtor') return json([]);
    if (fn === 'avaliar_atendimento') { // regras da função do banco (0049), no essencial
      return corpoJson(req, (b) => {
        const a = T.atendimentos.find((x) => x.id === b.p_id);
        if (!a) return json({ code: '42501', message: 'Pedido não encontrado.' }, 403);
        if (a.status !== 'resolvido') return json({ code: '22023', message: 'Só dá para avaliar depois que o pedido for resolvido.' }, 400);
        if (a.avaliado_em) return json({ code: '22023', message: 'Este atendimento já foi avaliado.' }, 400);
        Object.assign(a, { avaliacao: b.p_nota, avaliacao_comentario: b.p_comentario ?? null, avaliado_em: new Date().toISOString() });
        json(null);
      });
    }
    return json(null);
  }

  // Storage: envio de anexos, links assinados e a imagem de teste (1x1) que o link assinado devolve
  if (url.pathname.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
    return corpoJson(req, (b) => json((b.paths ?? []).map((p) => ({ path: p, signedURL: `/object/sign/atendimentos/${p}?token=t`, error: null }))));
  }
  if (url.pathname.startsWith('/storage/v1/object/sign/')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG_1X1); }
  if (url.pathname.startsWith('/storage/v1/object/') && (req.method === 'POST' || req.method === 'PUT')) { req.resume(); return json({ Key: url.pathname.replace('/storage/v1/object/', ''), Id: 'obj' }); }
  if (url.pathname.startsWith('/storage/v1/object/') && req.method === 'DELETE') return corpoJson(req, () => json([]));

  if (url.pathname.startsWith('/rest/v1/')) {
    const tabela = url.pathname.split('/').pop();
    let linhas = [...(T[tabela] ?? [])];
    // o simulador não tem RLS: para o produtor, as tabelas do Connect mostram só o que o banco mostraria
    if (papel === 'produtor' && TABELAS_CONNECT.includes(tabela)) linhas = linhas.filter((r) => r.produtor_id === produtores[0].id && !r.interna);
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k) || k.includes('.')) continue; // filtros em recurso aninhado: depois de montar
      const m = /^eq\.(.*)$/.exec(v); if (m) linhas = linhas.filter((r) => String(r[k]) === m[1]);
      const lk = /^like\.(.*)$/.exec(v); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); linhas = linhas.filter((r) => re.test(String(r[k] ?? ''))); }
      if (v === 'is.null') linhas = linhas.filter((r) => r[k] == null);
      if (v === 'not.is.null') linhas = linhas.filter((r) => r[k] != null);
      const cs = /^cs.{(.*)}$/.exec(v); if (cs) linhas = linhas.filter((r) => cs[1].split(',').every((x) => (r[k] ?? []).includes(x)));
      const i = /^in\.\((.*)\)$/.exec(v); if (i) { const lista = i[1].split(',').map((x) => x.replace(/"/g, '')); linhas = linhas.filter((r) => lista.includes(String(r[k]))); }
    }
    const lim = Number(url.searchParams.get('limit')); if (lim) linhas = linhas.slice(0, lim);
    const total = linhas.length;
    const extra = { 'content-range': total ? `0-${total - 1}/${total}` : '*/0' };
    if (TABELAS_CONNECT.includes(tabela) && (req.method === 'POST' || req.method === 'PATCH')) {
      // as tabelas do Connect guardam de verdade (com os efeitos dos gatilhos do 0049, no essencial): a tela seguinte já mostra o resultado
      return corpoJson(req, (b) => {
        const agora = new Date().toISOString();
        if (req.method === 'POST') {
          const novas = (Array.isArray(b) ? b : [b]).map((r) => {
            const nova = { id: `63${String(++seq).padStart(6, '0')}-0000-0000-0000-000000000000`, criado_em: agora, ...r };
            if (tabela === 'atendimentos') Object.assign(nova, { ...atBase, ...r, id: nova.id, status: 'novo', origem: papel === 'produtor' ? (r.origem === 'atlas' ? 'atlas' : 'portal') : 'equipe', ultima_interacao_em: agora, produtores_id: r.produtor_id, criado_em: agora });
            if (tabela === 'atendimento_mensagens') {
              nova.autor_id = U; nova.autor_tipo = papel === 'produtor' ? 'produtor' : 'equipe'; if (papel === 'produtor') nova.interna = false;
              const at = T.atendimentos.find((x) => x.id === nova.atendimento_id);
              if (at) { at.ultima_interacao_em = agora; if (nova.autor_tipo === 'produtor' && ['aguardando_produtor', 'resolvido'].includes(at.status)) at.status = 'em_acompanhamento'; if (nova.autor_tipo === 'equipe' && !nova.interna && ['novo', 'em_triagem'].includes(at.status)) at.status = 'em_acompanhamento'; }
            }
            T[tabela].push(nova);
            return nova;
          });
          const um = String(req.headers.accept ?? '').includes('vnd.pgrst.object');
          if (!String(req.headers.prefer ?? '').includes('return=representation')) { res.writeHead(201, { 'content-type': 'application/json' }); return res.end('[]'); }
          return json(um ? novas[0] : novas, 201);
        }
        for (const r of linhas) {
          if (tabela === 'atendimentos' && b.status && b.status !== r.status) { r.resolvido_em = b.status === 'resolvido' ? agora : null; }
          Object.assign(r, b);
        }
        json(linhas);
      });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const quer = String(req.headers.prefer ?? '').includes('return=representation');
      res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type': 'application/json' });
      return res.end(quer && req.method !== 'POST' ? JSON.stringify(linhas) : '[]');
    }
    if (req.method === 'HEAD') { res.writeHead(200, extra); return res.end(); }
    let montadas = linhas.map((r) => montar(r, url.searchParams.get('select')));
    // filtro em recurso aninhado (ex.: analise.talhao_id=eq.X, com !inner no select)
    for (const [k, v] of url.searchParams) {
      const m = k.includes('.') ? /^eq.(.*)$/.exec(v) : null;
      if (m) montadas = montadas.filter((r) => String(k.split('.').reduce((o, p) => o?.[p], r)) === m[1]);
    }
    if ((req.headers.accept ?? '').includes('vnd.pgrst.object')) {
      if (!montadas.length) return json({ code: 'PGRST116', message: 'The result contains 0 rows', details: null, hint: null }, 406, extra);
      return json(montadas[0], 200, extra);
    }
    return json(montadas, 200, extra);
  }
  json({}, 404);
}
