import type { SupabaseClient } from '@supabase/supabase-js';
import type { Nivel, Tema, TipoConteudo } from './academy';
import {
  aulasEmOrdem, cargaDoCurso, montarEstrutura, type AulaDoCurso, type Curso, type ModuloDoCurso,
} from './academy-cursos';

/**
 * Leitura dos dados da Academy para as telas. Quem decide o que cada pessoa vê é a RLS (0046–0048): aqui só se monta
 * o que a tela precisa e se junta o que é do aluno (matrícula, progresso, indicação, certificado) quando ele é produtor.
 */

export interface ConteudoResumo {
  id: string;
  tipo: TipoConteudo;
  titulo: string;
  descricao: string | null;
  cultura: string | null;
  tema: Tema | null;
  nivel: Nivel;
  duracao_min: number | null;
  url: string | null;
  fonte: string | null;
  data_materia: string | null;
  regiao: string | null;
  publicado_em: string | null;
}

export interface CursoResumo extends Curso {
  estrutura: ModuloDoCurso[];
  aulas: AulaDoCurso[];
  carga_min: number;
  capa_url: string | null;
}

export interface IndicacaoAluno {
  id: string;
  curso_id: string | null;
  conteudo_id: string | null;
  mensagem: string | null;
  criado_em: string;
  aberto_em: string | null;
  concluido_em: string | null;
}

export interface Biblioteca {
  cursos: CursoResumo[];
  conteudos: ConteudoResumo[];
  matriculas: Map<string, { criado_em: string; concluido_em: string | null }>;
  /** conteúdos que o aluno concluiu */
  concluidos: Set<string>;
  /** conteúdos que o aluno já abriu (iniciou) */
  iniciados: Set<string>;
  indicacoes: IndicacaoAluno[];
  /** curso → id do certificado */
  certificados: Map<string, string>;
}

const COLUNAS_CURSO = 'id, titulo, resumo, descricao, cultura, tema, nivel, capa_path, destaque, certificado, status, visibilidade, publicado_em, revisado_em';
const COLUNAS_CONTEUDO = 'id, tipo, titulo, descricao, cultura, tema, nivel, duracao_min, url, fonte, data_materia, regiao, publicado_em';

type LinhaAula = {
  id: string; curso_id: string; modulo_id: string; conteudo_id: string; posicao: number;
  conteudo: { titulo: string; tipo: TipoConteudo; duracao_min: number | null } | null;
};
type LinhaModulo = { id: string; curso_id: string; titulo: string; posicao: number };

/** Junta cursos, módulos e aulas (três consultas) em cursos com estrutura, carga e capa. */
export async function montarCursos(sb: SupabaseClient, linhas: Curso[]): Promise<CursoResumo[]> {
  if (linhas.length === 0) return [];
  const ids = linhas.map((c) => c.id);
  const [{ data: mods }, { data: aus }] = await Promise.all([
    sb.schema('agro').from('academy_curso_modulos').select('id, curso_id, titulo, posicao').in('curso_id', ids),
    sb.schema('agro').from('academy_curso_aulas')
      .select('id, curso_id, modulo_id, conteudo_id, posicao, conteudo:conteudo_id(titulo, tipo, duracao_min)').in('curso_id', ids),
  ]);
  const modulos = (mods ?? []) as unknown as LinhaModulo[];
  const aulasBrutas = (aus ?? []) as unknown as LinhaAula[];

  const caminhos = linhas.map((c) => c.capa_path).filter((p): p is string => Boolean(p));
  const assinadas = caminhos.length
    ? await sb.storage.from('academy').createSignedUrls(caminhos, 3600)
    : { data: [] as Array<{ path: string | null; signedUrl: string }> };
  const urlDaCapa = new Map((assinadas.data ?? []).map((a) => [a.path ?? '', a.signedUrl]));

  return linhas.map((c) => {
    const aulas: AulaDoCurso[] = aulasBrutas
      .filter((a) => a.curso_id === c.id && a.conteudo)
      .map((a) => ({
        id: a.id, modulo_id: a.modulo_id, conteudo_id: a.conteudo_id, posicao: a.posicao,
        titulo: a.conteudo!.titulo, tipo: a.conteudo!.tipo, duracao_min: a.conteudo!.duracao_min,
      }));
    const estrutura = montarEstrutura(modulos.filter((m) => m.curso_id === c.id), aulas);
    return {
      ...c,
      estrutura,
      aulas: aulasEmOrdem(estrutura),
      carga_min: cargaDoCurso(aulas),
      capa_url: c.capa_path ? (urlDaCapa.get(c.capa_path) ?? null) : null,
    };
  });
}

/** Tudo que as vitrines (início, catálogo, meus cursos) precisam. `ehAluno` junta o que é do produtor logado. */
export async function carregarBiblioteca(sb: SupabaseClient, ehAluno: boolean): Promise<Biblioteca> {
  const [{ data: cs }, { data: ct }, aluno] = await Promise.all([
    sb.schema('agro').from('academy_cursos').select(COLUNAS_CURSO).eq('status', 'publicado').order('publicado_em', { ascending: false }),
    sb.schema('agro').from('academy_conteudos').select(COLUNAS_CONTEUDO).eq('status', 'publicado').order('publicado_em', { ascending: false }).limit(300),
    ehAluno ? carregarDoAluno(sb) : Promise.resolve(null),
  ]);
  return {
    cursos: await montarCursos(sb, (cs ?? []) as unknown as Curso[]),
    conteudos: (ct ?? []) as unknown as ConteudoResumo[],
    matriculas: aluno?.matriculas ?? new Map(),
    concluidos: aluno?.concluidos ?? new Set(),
    iniciados: aluno?.iniciados ?? new Set(),
    indicacoes: aluno?.indicacoes ?? [],
    certificados: aluno?.certificados ?? new Map(),
  };
}

async function carregarDoAluno(sb: SupabaseClient) {
  const [{ data: mats }, { data: prog }, { data: inds }, { data: certs }] = await Promise.all([
    sb.schema('agro').from('academy_matriculas').select('curso_id, criado_em, concluido_em'),
    sb.schema('agro').from('academy_progresso').select('conteudo_id, concluido_em'),
    sb.schema('agro').from('academy_indicacoes').select('id, curso_id, conteudo_id, mensagem, criado_em, aberto_em, concluido_em').order('criado_em', { ascending: false }),
    sb.schema('agro').from('academy_certificados').select('id, curso_id'),
  ]);
  const progresso = (prog ?? []) as Array<{ conteudo_id: string; concluido_em: string | null }>;
  return {
    matriculas: new Map(((mats ?? []) as Array<{ curso_id: string; criado_em: string; concluido_em: string | null }>).map((m) => [m.curso_id, { criado_em: m.criado_em, concluido_em: m.concluido_em }])),
    concluidos: new Set(progresso.filter((p) => p.concluido_em).map((p) => p.conteudo_id)),
    iniciados: new Set(progresso.map((p) => p.conteudo_id)),
    indicacoes: (inds ?? []) as unknown as IndicacaoAluno[],
    certificados: new Map(((certs ?? []) as Array<{ id: string; curso_id: string }>).map((c) => [c.curso_id, c.id])),
  };
}

/** Um curso publicado (a RLS decide se esta pessoa pode vê-lo) com estrutura; null se não existir ou não for para ela. */
export async function carregarCurso(sb: SupabaseClient, id: string): Promise<CursoResumo | null> {
  const { data } = await sb.schema('agro').from('academy_cursos').select(COLUNAS_CURSO).eq('id', id).eq('status', 'publicado').maybeSingle();
  if (!data) return null;
  return (await montarCursos(sb, [data as unknown as Curso]))[0] ?? null;
}

/** Conteúdos por id (para os cartões de aulas avulsas indicadas). */
export function indicesPorId<T extends { id: string }>(lista: readonly T[]): Map<string, T> {
  return new Map(lista.map((x) => [x.id, x]));
}
