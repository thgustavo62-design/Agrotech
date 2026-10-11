import { describe, expect, it } from 'vitest';
import { resumirUso, type EntradaDoUso } from './academy-uso';

const AGORA = new Date('2026-10-11T12:00:00Z');
const dia = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toISOString();

const base = (o: Partial<EntradaDoUso> = {}): EntradaDoUso => ({
  produtores: [{ id: 'p1', nome: 'José' }, { id: 'p2', nome: 'Maria' }, { id: 'p3', nome: 'Ana' }],
  cursos: [{ id: 'c1', titulo: 'Calagem' }, { id: 'c2', titulo: 'Pragas' }],
  conteudos: [{ id: 'a1', titulo: 'Aula 1', tipo: 'video' }, { id: 'a2', titulo: 'Aula 2', tipo: 'artigo' }],
  matriculas: [], progresso: [], certificados: [], indicacoes: [], ...o,
});

describe('números gerais', () => {
  it('sem nenhum uso, tudo zero e os alunos listados pelo nome', () => {
    const r = resumirUso(base(), AGORA);
    expect(r).toMatchObject({ produtores: 3, ativosNosUltimos30Dias: 0, matriculas: 0, concluidas: 0, taxaDeConclusao: 0, certificados: 0, aulasConcluidas: 0, indicacoes: 0, indicacoesSemAbrir: 0, pedidosDoAtlas: 0 });
    expect(r.alunos.map((a) => a.nome)).toEqual(['Ana', 'José', 'Maria']);
    expect(r.alunos.every((a) => a.ultimaAtividade === null && a.diasParado === null)).toBe(true);
  });

  it('conta matrículas, conclusão, certificados, aulas e ativos nos últimos 30 dias', () => {
    const r = resumirUso(base({
      matriculas: [
        { curso_id: 'c1', produtor_id: 'p1', criado_em: dia(-40), concluido_em: dia(-35) },
        { curso_id: 'c1', produtor_id: 'p2', criado_em: dia(-5), concluido_em: null },
        { curso_id: 'c2', produtor_id: 'p2', criado_em: dia(-3), concluido_em: null },
        { curso_id: 'c2', produtor_id: 'p3', criado_em: dia(-60), concluido_em: null },
      ],
      progresso: [
        { produtor_id: 'p1', conteudo_id: 'a1', iniciado_em: dia(-40), concluido_em: dia(-36) },
        { produtor_id: 'p2', conteudo_id: 'a1', iniciado_em: dia(-4), concluido_em: dia(-2) },
        { produtor_id: 'p2', conteudo_id: 'a2', iniciado_em: dia(-1), concluido_em: null },
      ],
      certificados: [{ produtor_id: 'p1', emitido_em: dia(-35) }],
      pedidosDoAtlas: 2,
    }), AGORA);
    expect(r).toMatchObject({ matriculas: 4, concluidas: 1, taxaDeConclusao: 25, certificados: 1, aulasConcluidas: 2, ativosNosUltimos30Dias: 1, pedidosDoAtlas: 2 });
  });

  it('ignora quem não é produtor do escritório (dado órfão)', () => {
    const r = resumirUso(base({
      matriculas: [{ curso_id: 'c1', produtor_id: 'fantasma', criado_em: dia(-1), concluido_em: null }],
      progresso: [{ produtor_id: 'fantasma', conteudo_id: 'a1', iniciado_em: dia(-1), concluido_em: dia(-1) }],
      certificados: [{ produtor_id: 'fantasma', emitido_em: dia(-1) }],
      indicacoes: [{ produtor_id: 'fantasma', tipo: 'curso', titulo: 'X', criado_em: dia(-20), aberto_em: null }],
    }), AGORA);
    expect(r).toMatchObject({ matriculas: 0, aulasConcluidas: 0, certificados: 0, indicacoes: 0, indicacoesSemAbrir: 0 });
    expect(r.paraCobrar).toEqual([]);
  });
});

describe('por curso e por conteúdo', () => {
  const r = resumirUso(base({
    matriculas: [
      { curso_id: 'c1', produtor_id: 'p1', criado_em: dia(-10), concluido_em: dia(-5) },
      { curso_id: 'c1', produtor_id: 'p2', criado_em: dia(-9), concluido_em: null },
      { curso_id: 'c1', produtor_id: 'p3', criado_em: dia(-8), concluido_em: null },
      { curso_id: 'c2', produtor_id: 'p1', criado_em: dia(-2), concluido_em: null },
      { curso_id: 'removido', produtor_id: 'p1', criado_em: dia(-2), concluido_em: null },
    ],
    progresso: [
      { produtor_id: 'p1', conteudo_id: 'a1', iniciado_em: dia(-9), concluido_em: dia(-8) },
      { produtor_id: 'p2', conteudo_id: 'a1', iniciado_em: dia(-8), concluido_em: dia(-7) },
      { produtor_id: 'p3', conteudo_id: 'a1', iniciado_em: dia(-7), concluido_em: null },
      { produtor_id: 'p1', conteudo_id: 'a2', iniciado_em: dia(-6), concluido_em: null },
    ],
  }), AGORA);

  it('cursos: matriculados, concluídos, em andamento e taxa, do mais procurado ao menos', () => {
    expect(r.porCurso[0]).toEqual({ id: 'c1', titulo: 'Calagem', matriculados: 3, concluidos: 1, emAndamento: 2, taxa: 33 });
    expect(r.porCurso.find((c) => c.id === 'c2')).toMatchObject({ matriculados: 1, concluidos: 0, taxa: 0 });
    expect(r.porCurso.find((c) => c.id === 'removido')!.titulo).toBe('Curso removido');
  });

  it('conteúdos: os mais concluídos primeiro', () => {
    expect(r.conteudos.map((c) => [c.titulo, c.iniciados, c.concluidos])).toEqual([['Aula 1', 3, 2], ['Aula 2', 1, 0]]);
    expect(r.conteudos[0]!.tipo).toBe('video');
  });
});

describe('alunos', () => {
  it('ordena pela atividade mais recente; mostra dias parado e cursos; indicação sem abrir não conta como atividade', () => {
    const r = resumirUso(base({
      matriculas: [{ curso_id: 'c1', produtor_id: 'p1', criado_em: dia(-20), concluido_em: dia(-12) }, { curso_id: 'c2', produtor_id: 'p1', criado_em: dia(-2), concluido_em: null }],
      progresso: [{ produtor_id: 'p2', conteudo_id: 'a1', iniciado_em: dia(-9), concluido_em: null }],
      indicacoes: [
        { produtor_id: 'p3', tipo: 'ficha', titulo: 'Broca', criado_em: dia(-1), aberto_em: null },
        { produtor_id: 'p2', tipo: 'conteudo', titulo: 'Aula', criado_em: dia(-30), aberto_em: dia(-15) },
      ],
    }), AGORA);
    expect(r.alunos.map((a) => a.nome)).toEqual(['José', 'Maria', 'Ana']);
    expect(r.alunos[0]).toMatchObject({ cursosEmAndamento: 1, cursosConcluidos: 1, diasParado: 2 });
    expect(r.alunos[1]!.diasParado).toBe(9); // abrir indicação há 15 dias é mais velho que o progresso de 9 dias
    expect(r.alunos[2]).toMatchObject({ ultimaAtividade: null, indicacoesPendentes: 1 });
  });
});

describe('indicações para cobrar', () => {
  const r = resumirUso(base({
    indicacoes: [
      { produtor_id: 'p1', tipo: 'curso', titulo: 'Curso antigo', criado_em: dia(-20), aberto_em: null },
      { produtor_id: 'p2', tipo: 'ficha', titulo: 'Ficha de 9 dias', criado_em: dia(-9), aberto_em: null },
      { produtor_id: 'p3', tipo: 'conteudo', titulo: 'Recente', criado_em: dia(-3), aberto_em: null },
      { produtor_id: 'p1', tipo: 'conteudo', titulo: 'Já aberta', criado_em: dia(-30), aberto_em: dia(-29) },
    ],
  }), AGORA);

  it('só as sem abrir há 7 dias ou mais, da mais antiga para a mais nova', () => {
    expect(r.paraCobrar.map((i) => [i.produtor, i.titulo, i.dias])).toEqual([['José', 'Curso antigo', 20], ['Maria', 'Ficha de 9 dias', 9]]);
    expect(r).toMatchObject({ indicacoes: 4, indicacoesSemAbrir: 3 });
  });
  it('o prazo é ajustável', () => {
    expect(resumirUso(base({ indicacoes: [{ produtor_id: 'p3', tipo: 'conteudo', titulo: 'Recente', criado_em: dia(-3), aberto_em: null }] }), AGORA, 2).paraCobrar).toHaveLength(1);
  });
});

describe('série dos últimos 6 meses', () => {
  it('conta matrículas, aulas concluídas e certificados por mês, do mais antigo ao atual', () => {
    const r = resumirUso(base({
      matriculas: [{ curso_id: 'c1', produtor_id: 'p1', criado_em: '2026-10-02T10:00:00Z', concluido_em: null }, { curso_id: 'c1', produtor_id: 'p2', criado_em: '2026-08-20T10:00:00Z', concluido_em: null }],
      progresso: [{ produtor_id: 'p1', conteudo_id: 'a1', iniciado_em: '2026-09-01T10:00:00Z', concluido_em: '2026-09-02T10:00:00Z' }],
      certificados: [{ produtor_id: 'p1', emitido_em: '2026-10-05T10:00:00Z' }],
    }), AGORA);
    expect(r.porMes.rotulos).toEqual(['mai/26', 'jun/26', 'jul/26', 'ago/26', 'set/26', 'out/26']);
    expect(r.porMes.matriculas).toEqual([0, 0, 0, 1, 0, 1]);
    expect(r.porMes.aulasConcluidas).toEqual([0, 0, 0, 0, 1, 0]);
    expect(r.porMes.certificados).toEqual([0, 0, 0, 0, 0, 1]);
  });
});
