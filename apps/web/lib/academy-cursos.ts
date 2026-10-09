import type { Nivel, Tema, TipoConteudo } from './academy';

/**
 * Regras puras dos CURSOS da Academy (estrutura, progresso, carga horária, próxima aula, capa por tema).
 * O banco (0048) decide quem vê o quê e emite o certificado; aqui ficam as contas que a tela precisa.
 */

export interface AulaDoCurso {
  /** id da linha em academy_curso_aulas */
  id: string;
  modulo_id: string;
  conteudo_id: string;
  posicao: number;
  titulo: string;
  tipo: TipoConteudo;
  duracao_min: number | null;
}

export interface ModuloDoCurso {
  id: string;
  titulo: string;
  posicao: number;
  aulas: AulaDoCurso[];
}

export interface Curso {
  id: string;
  titulo: string;
  resumo: string | null;
  descricao: string | null;
  cultura: string | null;
  tema: Tema | null;
  nivel: Nivel;
  capa_path: string | null;
  destaque: boolean;
  certificado: boolean;
  status: 'rascunho' | 'publicado' | 'arquivado';
  visibilidade: 'todos' | 'selecionados' | 'cultura';
  publicado_em: string | null;
  revisado_em: string | null;
}

/** Módulos e aulas na ordem certa (posição, depois título/id para desempate estável). */
export function montarEstrutura(
  modulos: ReadonlyArray<{ id: string; titulo: string; posicao: number }>,
  aulas: readonly AulaDoCurso[],
): ModuloDoCurso[] {
  const ordemAula = (a: AulaDoCurso, b: AulaDoCurso) => a.posicao - b.posicao || a.titulo.localeCompare(b.titulo, 'pt-BR') || a.id.localeCompare(b.id);
  return [...modulos]
    .sort((a, b) => a.posicao - b.posicao || a.titulo.localeCompare(b.titulo, 'pt-BR') || a.id.localeCompare(b.id))
    .map((m) => ({ ...m, aulas: aulas.filter((a) => a.modulo_id === m.id).sort(ordemAula) }));
}

/** Todas as aulas, na ordem em que o aluno as faz. */
export function aulasEmOrdem(estrutura: readonly ModuloDoCurso[]): AulaDoCurso[] {
  return estrutura.flatMap((m) => m.aulas);
}

/** Minutos declarados nas aulas (aula sem duração conta zero: é "carga prevista", não tempo medido). */
export function cargaDoCurso(aulas: ReadonlyArray<Pick<AulaDoCurso, 'duracao_min'>>): number {
  return aulas.reduce((soma, a) => soma + (a.duracao_min ?? 0), 0);
}

/** 0 → "—", 45 → "45 min", 60 → "1 h", 95 → "1 h 35 min". */
export function formatarCarga(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface ProgressoDoCurso {
  total: number;
  feitas: number;
  /** 0 a 100, inteiro */
  percentual: number;
  concluido: boolean;
}

export function progressoDoCurso(aulas: readonly AulaDoCurso[], concluidos: ReadonlySet<string>): ProgressoDoCurso {
  const total = aulas.length;
  const feitas = aulas.filter((a) => concluidos.has(a.conteudo_id)).length;
  return { total, feitas, percentual: total === 0 ? 0 : Math.floor((feitas * 100) / total), concluido: total > 0 && feitas === total };
}

/** A próxima aula não concluída (a primeira, se nenhuma foi feita); null quando o curso está completo ou vazio. */
export function proximaAula(aulas: readonly AulaDoCurso[], concluidos: ReadonlySet<string>): AulaDoCurso | null {
  return aulas.find((a) => !concluidos.has(a.conteudo_id)) ?? null;
}

/** Anterior e seguinte de uma aula na ordem do curso. */
export function vizinhas(aulas: readonly AulaDoCurso[], conteudoId: string): { anterior: AulaDoCurso | null; seguinte: AulaDoCurso | null } {
  const i = aulas.findIndex((a) => a.conteudo_id === conteudoId);
  if (i < 0) return { anterior: null, seguinte: null };
  return { anterior: aulas[i - 1] ?? null, seguinte: aulas[i + 1] ?? null };
}

/** Reordenar dentro de uma lista: sobe/desce uma posição e devolve as novas posições 0..n-1 (sem mexer na lista original). */
export function mover<T extends { id: string }>(lista: readonly T[], id: string, direcao: 'subir' | 'descer'): Array<{ id: string; posicao: number }> {
  const i = lista.findIndex((x) => x.id === id);
  const j = direcao === 'subir' ? i - 1 : i + 1;
  const ids = lista.map((x) => x.id);
  if (i >= 0 && j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return ids.map((x, posicao) => ({ id: x, posicao }));
}

/** Cada tema tem uma cor e um desenho de capa próprios: o curso sem foto continua com cara de curso. */
export const CAPA_DO_TEMA: Record<Tema | 'padrao', { de: string; ate: string; simbolo: string }> = {
  solo: { de: '#7c4a1d', ate: '#c9822b', simbolo: '◍' },
  adubacao: { de: '#2f6b3a', ate: '#84b84a', simbolo: '✿' },
  calagem: { de: '#8a6a2e', ate: '#e0c36a', simbolo: '◔' },
  pragas: { de: '#8a2d1d', ate: '#e07a3a', simbolo: '✱' },
  doencas: { de: '#6b2a5e', ate: '#c7679c', simbolo: '✚' },
  irrigacao: { de: '#0f5e8a', ate: '#4fb3d9', simbolo: '≋' },
  colheita: { de: '#9a5b00', ate: '#f0b429', simbolo: '❖' },
  gestao: { de: '#27465f', ate: '#6f98b8', simbolo: '▤' },
  seguranca: { de: '#a31d2b', ate: '#f06b5b', simbolo: '◈' },
  outro: { de: '#4a4a3f', ate: '#9a9a86', simbolo: '◇' },
  padrao: { de: '#7a4a12', ate: '#d9962b', simbolo: '◆' },
};

export function capaDoTema(tema: Tema | null | undefined): { de: string; ate: string; simbolo: string } {
  return CAPA_DO_TEMA[tema ?? 'padrao'];
}

/** CSS do fundo da capa padrão de um tema. */
export function fundoDaCapa(tema: Tema | null | undefined): string {
  const c = capaDoTema(tema);
  return `linear-gradient(135deg, ${c.de} 0%, ${c.ate} 100%)`;
}

/** "Calagem em café" → "CC" para o selo da capa. */
export function iniciais(titulo: string): string {
  const limpo = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const palavras = limpo.split(/\s+/).filter((p) => p.length > 2 && /^[A-Za-z]/.test(p));
  return palavras.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || limpo.slice(0, 1).toUpperCase();
}

/** O código do certificado (AT-XXXXX-XXXXX) — para validar a forma antes de buscar. */
export function codigoDeCertificadoValido(codigo: string): boolean {
  return /^AT-[0-9A-F]{5}-[0-9A-F]{5}$/.test(codigo);
}

export interface FiltroCursos {
  busca?: string;
  tema?: string;
  nivel?: string;
  cultura?: string;
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Filtra cursos do catálogo: busca (título, resumo, descrição, cultura; todas as palavras), tema, nível e cultura. */
export function filtrarCursos<T extends Pick<Curso, 'titulo' | 'resumo' | 'descricao' | 'cultura' | 'tema' | 'nivel'>>(lista: readonly T[], f: FiltroCursos): T[] {
  const termo = semAcento(f.busca ?? '');
  const cultura = semAcento(f.cultura ?? '');
  return lista.filter((c) => {
    if (f.tema && c.tema !== f.tema) return false;
    if (f.nivel && c.nivel !== f.nivel) return false;
    if (cultura && semAcento(c.cultura ?? '') !== cultura) return false;
    if (termo) {
      const palheiro = semAcento([c.titulo, c.resumo, c.descricao, c.cultura].filter(Boolean).join(' '));
      if (!termo.split(' ').every((p) => palheiro.includes(p))) return false;
    }
    return true;
  });
}

export interface EntradaCurso {
  titulo: string;
  resumo: string;
  descricao: string;
  cultura: string;
  tema: string;
  nivel: string;
  visibilidade: string;
}

export interface DadosCurso {
  titulo: string;
  resumo: string | null;
  descricao: string | null;
  cultura: string | null;
  tema: Tema | null;
  nivel: Nivel;
  visibilidade: 'todos' | 'selecionados' | 'cultura';
}

const TEMAS_VALIDOS = ['solo', 'adubacao', 'calagem', 'pragas', 'doencas', 'irrigacao', 'colheita', 'gestao', 'seguranca', 'outro'];
const nulo = (s: string) => (s.trim() === '' ? null : s.trim());

/** Confere o formulário de um curso (as regras de publicação — aulas — o banco confere). */
export function validarCurso(e: EntradaCurso): { ok: true; dados: DadosCurso } | { ok: false; erro: string } {
  const titulo = e.titulo.trim();
  if (titulo.length < 3) return { ok: false, erro: 'Dê um título ao curso (pelo menos 3 letras).' };
  if (titulo.length > 160) return { ok: false, erro: 'O título passa de 160 letras. Encurte.' };
  const resumo = nulo(e.resumo);
  if (resumo && resumo.length > 400) return { ok: false, erro: 'O resumo passa de 400 letras. Ele aparece no cartão do curso: seja breve.' };
  const descricao = nulo(e.descricao);
  if (descricao && descricao.length > 5000) return { ok: false, erro: 'A descrição passa de 5.000 letras.' };
  const cultura = nulo(e.cultura);
  if (cultura && cultura.length > 60) return { ok: false, erro: 'O nome da cultura passa de 60 letras.' };
  const tema = nulo(e.tema);
  if (tema && !TEMAS_VALIDOS.includes(tema)) return { ok: false, erro: 'Tema inválido.' };
  if (e.nivel !== 'basico' && e.nivel !== 'intermediario' && e.nivel !== 'avancado') return { ok: false, erro: 'Escolha o nível.' };
  if (e.visibilidade !== 'todos' && e.visibilidade !== 'selecionados' && e.visibilidade !== 'cultura') return { ok: false, erro: 'Escolha quem pode ver.' };
  if (e.visibilidade === 'cultura' && !cultura) return { ok: false, erro: 'Para mostrar só a quem tem aquela cultura, preencha o campo "Cultura".' };
  return { ok: true, dados: { titulo, resumo, descricao, cultura, tema: tema as Tema | null, nivel: e.nivel, visibilidade: e.visibilidade } };
}
