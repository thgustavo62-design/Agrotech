import { contarPorMes, ultimosMeses } from './painel-series';

/**
 * Painel de uso da Academy (Estúdio): quem está estudando, o que funciona e o que ficou sem resposta. Só soma e agrupa o que o
 * banco já guarda (matrículas, progresso, indicações, certificados) — nada é estimado. As regras são puras: a data de hoje vem de
 * fora, para testar com exemplos fixos.
 */

export interface UsoProdutor { id: string; nome: string }
export interface UsoCurso { id: string; titulo: string }
export interface UsoConteudo { id: string; titulo: string; tipo: string }
export interface UsoMatricula { curso_id: string; produtor_id: string; criado_em: string; concluido_em: string | null }
export interface UsoProgresso { produtor_id: string; conteudo_id: string; iniciado_em: string | null; concluido_em: string | null }
export interface UsoCertificado { produtor_id: string; emitido_em: string }
/** Indicação de qualquer tipo (conteúdo, curso ou ficha do Atlas), no mesmo formato. */
export interface UsoIndicacao { produtor_id: string; tipo: 'conteudo' | 'curso' | 'ficha'; titulo: string; criado_em: string; aberto_em: string | null }

export interface EntradaDoUso {
  produtores: UsoProdutor[];
  cursos: UsoCurso[];
  conteudos: UsoConteudo[];
  matriculas: UsoMatricula[];
  progresso: UsoProgresso[];
  certificados: UsoCertificado[];
  indicacoes: UsoIndicacao[];
  /** pedidos do Connect que nasceram de uma ficha do Atlas */
  pedidosDoAtlas?: number;
}

export interface LinhaDeCurso { id: string; titulo: string; matriculados: number; concluidos: number; emAndamento: number; taxa: number }
export interface LinhaDeConteudo { id: string; titulo: string; tipo: string; iniciados: number; concluidos: number }
export interface LinhaDeAluno {
  id: string; nome: string; cursosEmAndamento: number; cursosConcluidos: number; aulasConcluidas: number;
  ultimaAtividade: string | null; diasParado: number | null; indicacoesPendentes: number;
}
export interface IndicacaoParaCobrar { produtor: string; titulo: string; tipo: UsoIndicacao['tipo']; dias: number }

export interface ResumoDoUso {
  produtores: number;
  ativosNosUltimos30Dias: number;
  matriculas: number;
  concluidas: number;
  /** concluídas ÷ matrículas, em % (0 sem matrículas) */
  taxaDeConclusao: number;
  certificados: number;
  aulasConcluidas: number;
  indicacoes: number;
  indicacoesSemAbrir: number;
  pedidosDoAtlas: number;
  porCurso: LinhaDeCurso[];
  conteudos: LinhaDeConteudo[];
  alunos: LinhaDeAluno[];
  paraCobrar: IndicacaoParaCobrar[];
  porMes: { rotulos: string[]; matriculas: number[]; aulasConcluidas: number[]; certificados: number[] };
}

const DIA = 86_400_000;
const dias = (de: string, ate: Date) => Math.max(0, Math.floor((ate.getTime() - new Date(de).getTime()) / DIA));
const valido = (s: string | null | undefined): s is string => typeof s === 'string' && !Number.isNaN(new Date(s).getTime());
const maior = (a: string | null, b: string | null | undefined): string | null => (valido(b) && (!a || new Date(b) > new Date(a)) ? b : a);

export function resumirUso(e: EntradaDoUso, agora: Date = new Date(), diasParaCobrar = 7): ResumoDoUso {
  const nome = new Map(e.produtores.map((p) => [p.id, p.nome]));
  const conhecido = (id: string) => nome.has(id);

  // ---- por aluno ----
  const alunos = new Map<string, LinhaDeAluno>(e.produtores.map((p) => [p.id, {
    id: p.id, nome: p.nome, cursosEmAndamento: 0, cursosConcluidos: 0, aulasConcluidas: 0, ultimaAtividade: null, diasParado: null, indicacoesPendentes: 0,
  }]));
  for (const m of e.matriculas) {
    const a = alunos.get(m.produtor_id);
    if (!a) continue;
    if (m.concluido_em) a.cursosConcluidos++; else a.cursosEmAndamento++;
    a.ultimaAtividade = maior(maior(a.ultimaAtividade, m.criado_em), m.concluido_em);
  }
  for (const p of e.progresso) {
    const a = alunos.get(p.produtor_id);
    if (!a) continue;
    if (p.concluido_em) a.aulasConcluidas++;
    a.ultimaAtividade = maior(maior(a.ultimaAtividade, p.iniciado_em), p.concluido_em);
  }
  for (const i of e.indicacoes) {
    const a = alunos.get(i.produtor_id);
    if (!a) continue;
    // abrir uma indicação também é atividade; indicação sem abrir não conta como atividade do aluno
    if (i.aberto_em) a.ultimaAtividade = maior(a.ultimaAtividade, i.aberto_em);
    else a.indicacoesPendentes++;
  }
  for (const a of alunos.values()) a.diasParado = a.ultimaAtividade ? dias(a.ultimaAtividade, agora) : null;
  const listaDeAlunos = [...alunos.values()].sort((x, y) => {
    if (x.ultimaAtividade && y.ultimaAtividade) return new Date(y.ultimaAtividade).getTime() - new Date(x.ultimaAtividade).getTime();
    if (x.ultimaAtividade) return -1;
    if (y.ultimaAtividade) return 1;
    return x.nome.localeCompare(y.nome, 'pt-BR');
  });

  // ---- por curso ----
  const titulosDeCurso = new Map(e.cursos.map((c) => [c.id, c.titulo]));
  const porCursoMapa = new Map<string, LinhaDeCurso>();
  for (const m of e.matriculas) {
    if (!conhecido(m.produtor_id)) continue;
    const l = porCursoMapa.get(m.curso_id) ?? { id: m.curso_id, titulo: titulosDeCurso.get(m.curso_id) ?? 'Curso removido', matriculados: 0, concluidos: 0, emAndamento: 0, taxa: 0 };
    l.matriculados++;
    if (m.concluido_em) l.concluidos++; else l.emAndamento++;
    porCursoMapa.set(m.curso_id, l);
  }
  const porCurso = [...porCursoMapa.values()]
    .map((l) => ({ ...l, taxa: l.matriculados > 0 ? Math.round((100 * l.concluidos) / l.matriculados) : 0 }))
    .sort((a, b) => b.matriculados - a.matriculados || a.titulo.localeCompare(b.titulo, 'pt-BR'));

  // ---- por conteúdo ----
  const infoDeConteudo = new Map(e.conteudos.map((c) => [c.id, c]));
  const porConteudo = new Map<string, LinhaDeConteudo>();
  for (const p of e.progresso) {
    if (!conhecido(p.produtor_id)) continue;
    const info = infoDeConteudo.get(p.conteudo_id);
    const l = porConteudo.get(p.conteudo_id) ?? { id: p.conteudo_id, titulo: info?.titulo ?? 'Conteúdo removido', tipo: info?.tipo ?? '', iniciados: 0, concluidos: 0 };
    l.iniciados++;
    if (p.concluido_em) l.concluidos++;
    porConteudo.set(p.conteudo_id, l);
  }
  const conteudos = [...porConteudo.values()].sort((a, b) => b.concluidos - a.concluidos || b.iniciados - a.iniciados || a.titulo.localeCompare(b.titulo, 'pt-BR')).slice(0, 8);

  // ---- indicações sem resposta ----
  const paraCobrar = e.indicacoes
    .filter((i) => !i.aberto_em && conhecido(i.produtor_id) && dias(i.criado_em, agora) >= diasParaCobrar)
    .map((i): IndicacaoParaCobrar => ({ produtor: nome.get(i.produtor_id)!, titulo: i.titulo, tipo: i.tipo, dias: dias(i.criado_em, agora) }))
    .sort((a, b) => b.dias - a.dias || a.produtor.localeCompare(b.produtor, 'pt-BR'))
    .slice(0, 20);

  // ---- números gerais ----
  const matriculasValidas = e.matriculas.filter((m) => conhecido(m.produtor_id));
  const concluidas = matriculasValidas.filter((m) => m.concluido_em).length;
  const corte = agora.getTime() - 30 * DIA;
  const ativos = listaDeAlunos.filter((a) => a.ultimaAtividade && new Date(a.ultimaAtividade).getTime() >= corte).length;
  const indicacoesValidas = e.indicacoes.filter((i) => conhecido(i.produtor_id));

  // ---- série dos últimos 6 meses ----
  const hoje = agora.toISOString().slice(0, 10);
  const meses = ultimosMeses(hoje, 6);
  const porMes = {
    rotulos: meses.map((m) => m.rotulo),
    matriculas: contarPorMes(matriculasValidas.map((m) => m.criado_em), meses),
    aulasConcluidas: contarPorMes(e.progresso.filter((p) => conhecido(p.produtor_id)).map((p) => p.concluido_em), meses),
    certificados: contarPorMes(e.certificados.filter((c) => conhecido(c.produtor_id)).map((c) => c.emitido_em), meses),
  };

  return {
    produtores: e.produtores.length,
    ativosNosUltimos30Dias: ativos,
    matriculas: matriculasValidas.length,
    concluidas,
    taxaDeConclusao: matriculasValidas.length > 0 ? Math.round((100 * concluidas) / matriculasValidas.length) : 0,
    certificados: e.certificados.filter((c) => conhecido(c.produtor_id)).length,
    aulasConcluidas: e.progresso.filter((p) => p.concluido_em && conhecido(p.produtor_id)).length,
    indicacoes: indicacoesValidas.length,
    indicacoesSemAbrir: indicacoesValidas.filter((i) => !i.aberto_em).length,
    pedidosDoAtlas: e.pedidosDoAtlas ?? 0,
    porCurso, conteudos, alunos: listaDeAlunos, paraCobrar, porMes,
  };
}
