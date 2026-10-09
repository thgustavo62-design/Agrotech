import { norm } from '../numero.js';
import type { ChaveCampoLaudo } from '../tipos.js';

/** Quais linhas da tabela existem e como reconhecê-las; e como saber que um texto é uma tabela por colunas. */

export interface LinhaDef {
  chave: ChaveCampoLaudo | string;
  /** casa na linha normalizada (sem acento, minúscula) */
  re: RegExp;
  /** campo de análise (true) ou só conferência (false) */
  analise: boolean;
}

/** Ordem importa: a primeira definição que casa vence. */
export const LINHAS: LinhaDef[] = [
  { chave: 'ph', re: /\bph em agua/, analise: true },
  { chave: 'ph_cacl2', re: /\bph em \(?\s*cacl/, analise: false },
  { chave: 'p', re: /fosforo\s*-\s*extrator/, analise: true },
  { chave: 'p_rem', re: /fosforo remanescente/, analise: false },
  { chave: 'k', re: /potassio\s*-\s*extrator/, analise: true },
  { chave: 'ca', re: /calcio\s*-\s*extrator/, analise: true },
  { chave: 'mg', re: /magnesio\s*-\s*extrator/, analise: true },
  { chave: 'al', re: /aluminio\s*-\s*extrator/, analise: true },
  { chave: 'h_al', re: /h\s*\+\s*a[li1]\s*-\s*smp/, analise: true },
  { chave: 'sb', re: /soma de bases/, analise: false },
  { chave: 't_efetiva', re: /capacidade de troca cationica efetiva/, analise: false },
  { chave: 't_ctc', re: /ph 7\s*\(/, analise: false },
  { chave: 'v_pct', re: /indice de saturacao em bases/, analise: false },
  { chave: 'm_pct', re: /saturacao em aluminio/, analise: false },
  { chave: 'mo', re: /materia organica/, analise: true },
  { chave: 's', re: /enxofre\s*-/, analise: true },
  { chave: 'b', re: /boro\s*-/, analise: true },
  { chave: 'fe', re: /ferro\s*-/, analise: true },
  { chave: 'cu', re: /cobre\s*-/, analise: true },
  { chave: 'mn', re: /manganes\s*-/, analise: true },
  { chave: 'zn', re: /zinco\s*-/, analise: true },
];

export const RE_AMOSTRA = /^([A-Z]{2,5}-[\d-]*?-?(\d+))\s+(\S.*)$/;

/**
 * Laudo em tabela = tem linhas de identificação de amostra no padrão "XXX-1-291088-2 …"
 * e extrator Mehlich. É estrutural de propósito: o nome do laboratório pode aparecer em
 * qualquer laudo (ex.: "Sítio Água Limpa" como propriedade) e não identifica o layout.
 */
export function ehLaudoEmTabela(texto: string): boolean {
  const temAmostra = texto.split(/\r?\n/).some((l) => {
    const m = l.trim().match(RE_AMOSTRA);
    return m !== null && /-\d+-\d+/.test(m[1]!);
  });
  return temAmostra && /mehlich/.test(norm(texto));
}

export function identificarLab(textos: string[]): { perfil: string; laboratorio: string | null } {
  const n = norm(textos.join('\n'));
  return /laboratorioagualimpa|analises de agua, solo e folhas|laboratorio agua limpa/.test(n)
    ? { perfil: 'agua-limpa', laboratorio: 'Laboratório Água Limpa' }
    : { perfil: 'tabela-colunas', laboratorio: null };
}
