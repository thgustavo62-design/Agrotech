import { describe, expect, it } from 'vitest';
import {
  aulasEmOrdem, capaDoTema, filtrarCursos, validarCurso, cargaDoCurso, codigoDeCertificadoValido, formatarCarga, fundoDaCapa, iniciais, montarEstrutura,
  mover, progressoDoCurso, proximaAula, vizinhas, type AulaDoCurso,
} from './academy-cursos';

const aula = (id: string, modulo: string, posicao: number, duracao: number | null, titulo = `Aula ${id}`): AulaDoCurso => ({
  id, modulo_id: modulo, conteudo_id: `c-${id}`, posicao, titulo, tipo: 'video', duracao_min: duracao,
});
const modulos = [
  { id: 'm2', titulo: 'Segundo', posicao: 1 },
  { id: 'm1', titulo: 'Primeiro', posicao: 0 },
];
const aulas = [aula('a3', 'm2', 0, 20), aula('a2', 'm1', 1, 15), aula('a1', 'm1', 0, 10), aula('a4', 'm2', 1, null)];

describe('estrutura do curso', () => {
  it('módulos e aulas saem na ordem de posição, independente da ordem em que chegam', () => {
    const e = montarEstrutura(modulos, aulas);
    expect(e.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(e[0]!.aulas.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(aulasEmOrdem(e).map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('posição igual desempata por título, sem trocar de lugar a cada carga', () => {
    const iguais = [aula('x', 'm1', 0, 1, 'Zebra'), aula('y', 'm1', 0, 1, 'Abelha')];
    expect(montarEstrutura([modulos[1]!], iguais)[0]!.aulas.map((a) => a.titulo)).toEqual(['Abelha', 'Zebra']);
  });
});

describe('carga horária', () => {
  it('soma a duração declarada; aula sem duração conta zero', () => {
    expect(cargaDoCurso(aulas)).toBe(45);
    expect(cargaDoCurso([])).toBe(0);
  });
  it('formata em horas e minutos', () => {
    expect(formatarCarga(0)).toBe('—');
    expect(formatarCarga(-5)).toBe('—');
    expect(formatarCarga(45)).toBe('45 min');
    expect(formatarCarga(60)).toBe('1 h');
    expect(formatarCarga(95)).toBe('1 h 35 min');
    expect(formatarCarga(Number.NaN)).toBe('—');
  });
});

describe('progresso e próxima aula', () => {
  const ordem = aulasEmOrdem(montarEstrutura(modulos, aulas));

  it('conta aulas feitas e o percentual (arredondado para baixo: 99% nunca vira 100%)', () => {
    expect(progressoDoCurso(ordem, new Set())).toEqual({ total: 4, feitas: 0, percentual: 0, concluido: false });
    expect(progressoDoCurso(ordem, new Set(['c-a1']))).toEqual({ total: 4, feitas: 1, percentual: 25, concluido: false });
    expect(progressoDoCurso(ordem, new Set(['c-a1', 'c-a2', 'c-a3']))).toMatchObject({ feitas: 3, percentual: 75, concluido: false });
    expect(progressoDoCurso(ordem, new Set(['c-a1', 'c-a2', 'c-a3', 'c-a4']))).toMatchObject({ percentual: 100, concluido: true });
    const tres = ordem.slice(0, 3);
    expect(progressoDoCurso(tres, new Set(['c-a1', 'c-a2']))).toMatchObject({ percentual: 66 });
  });

  it('ignora conclusão de conteúdo que não é do curso e curso vazio não conclui', () => {
    expect(progressoDoCurso(ordem, new Set(['outro']))).toMatchObject({ feitas: 0 });
    expect(progressoDoCurso([], new Set())).toEqual({ total: 0, feitas: 0, percentual: 0, concluido: false });
  });

  it('a próxima aula é a primeira não feita, mesmo que tenha pulado uma', () => {
    expect(proximaAula(ordem, new Set())!.id).toBe('a1');
    expect(proximaAula(ordem, new Set(['c-a1', 'c-a3']))!.id).toBe('a2');
    expect(proximaAula(ordem, new Set(['c-a1', 'c-a2', 'c-a3', 'c-a4']))).toBeNull();
    expect(proximaAula([], new Set())).toBeNull();
  });

  it('anterior e seguinte na ordem do curso', () => {
    expect(vizinhas(ordem, 'c-a2')).toMatchObject({ anterior: { id: 'a1' }, seguinte: { id: 'a3' } });
    expect(vizinhas(ordem, 'c-a1').anterior).toBeNull();
    expect(vizinhas(ordem, 'c-a4').seguinte).toBeNull();
    expect(vizinhas(ordem, 'c-nao-existe')).toEqual({ anterior: null, seguinte: null });
  });
});

describe('reordenar', () => {
  const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('sobe e desce uma posição e renumera de 0 a n-1', () => {
    expect(mover(lista, 'b', 'subir')).toEqual([{ id: 'b', posicao: 0 }, { id: 'a', posicao: 1 }, { id: 'c', posicao: 2 }]);
    expect(mover(lista, 'b', 'descer')).toEqual([{ id: 'a', posicao: 0 }, { id: 'c', posicao: 1 }, { id: 'b', posicao: 2 }]);
  });
  it('nas pontas (ou id inexistente) só renumera, sem trocar nada', () => {
    expect(mover(lista, 'a', 'subir').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(mover(lista, 'c', 'descer').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(mover(lista, 'zzz', 'subir').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('não altera a lista original', () => {
    mover(lista, 'b', 'subir');
    expect(lista.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('capa e detalhes', () => {
  it('todo tema tem capa; sem tema usa a padrão', () => {
    expect(capaDoTema('irrigacao').de).toBe('#0f5e8a');
    expect(capaDoTema(null)).toBe(capaDoTema(undefined));
    expect(fundoDaCapa('solo')).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)$/);
  });
  it('iniciais para o selo', () => {
    expect(iniciais('Calagem em café')).toBe('CC');
    expect(iniciais('Adubação de cobertura')).toBe('AC');
    expect(iniciais('Á')).toBe('A');
  });
  it('código de certificado tem forma fixa', () => {
    expect(codigoDeCertificadoValido('AT-1A2B3-C4D5E')).toBe(true);
    for (const ruim of ['', 'AT-1A2B3', 'at-1a2b3-c4d5e', 'AT-1A2B3-C4D5EE', 'XX-1A2B3-C4D5E', "AT-1A2B3-C4D5E' or 1=1"]) expect(codigoDeCertificadoValido(ruim)).toBe(false);
  });
});

describe('filtrar cursos do catálogo', () => {
  const cursos = [
    { titulo: 'Calagem e gesso na prática', resumo: 'Quando e quanto aplicar', descricao: null, cultura: 'Café', tema: 'calagem', nivel: 'basico' },
    { titulo: 'Adubação do milho', resumo: null, descricao: 'Parcelamento do nitrogênio', cultura: 'Milho', tema: 'adubacao', nivel: 'intermediario' },
    { titulo: 'Manejo da ferrugem', resumo: 'Doença do cafeeiro', descricao: null, cultura: 'Café', tema: 'doencas', nivel: 'avancado' },
  ] as const;
  it('busca sem acento, com todas as palavras', () => {
    expect(filtrarCursos(cursos, { busca: 'adubacao nitrogenio' })).toHaveLength(1);
    expect(filtrarCursos(cursos, { busca: 'CAFEEIRO' })).toHaveLength(1);
    expect(filtrarCursos(cursos, { busca: 'soja' })).toHaveLength(0);
  });
  it('tema, nível e cultura combinam', () => {
    expect(filtrarCursos(cursos, { tema: 'doencas' })).toHaveLength(1);
    expect(filtrarCursos(cursos, { nivel: 'basico' })).toHaveLength(1);
    expect(filtrarCursos(cursos, { cultura: 'café' })).toHaveLength(2);
    expect(filtrarCursos(cursos, { cultura: 'café', nivel: 'avancado' })).toHaveLength(1);
    expect(filtrarCursos(cursos, {})).toHaveLength(3);
  });
});

describe('validar o formulário do curso', () => {
  const base = { titulo: 'Calagem na prática', resumo: 'Quando e quanto', descricao: '', cultura: 'Café', tema: 'calagem', nivel: 'basico', visibilidade: 'todos' };
  it('curso completo passa e vem normalizado', () => {
    const r = validarCurso({ ...base, descricao: '  Texto  ' });
    expect(r).toMatchObject({ ok: true, dados: { titulo: 'Calagem na prática', descricao: 'Texto', tema: 'calagem', nivel: 'basico', visibilidade: 'todos' } });
  });
  it('explica o que está errado', () => {
    expect(validarCurso({ ...base, titulo: 'ab' })).toEqual({ ok: false, erro: expect.stringContaining('título') });
    expect(validarCurso({ ...base, resumo: 'x'.repeat(401) })).toEqual({ ok: false, erro: expect.stringContaining('resumo') });
    expect(validarCurso({ ...base, descricao: 'x'.repeat(5001) }).ok).toBe(false);
    expect(validarCurso({ ...base, tema: 'astrologia' })).toEqual({ ok: false, erro: expect.stringContaining('Tema') });
    expect(validarCurso({ ...base, nivel: 'expert' })).toEqual({ ok: false, erro: expect.stringContaining('nível') });
    expect(validarCurso({ ...base, visibilidade: 'ninguem' }).ok).toBe(false);
  });
  it('"por cultura" exige a cultura', () => {
    expect(validarCurso({ ...base, visibilidade: 'cultura', cultura: '' })).toEqual({ ok: false, erro: expect.stringContaining('Cultura') });
    expect(validarCurso({ ...base, visibilidade: 'cultura' }).ok).toBe(true);
  });
});
