import type { Analise, ChaveParametro } from './tipos.js';

/**
 * Validação de uma análise ANTES de calcular/emitir recomendação.
 *
 * O motor (`n()`) trata ausência como zero para nunca lançar. Isso é seguro para exibir, mas NÃO para prescrever:
 * Ca em branco virava "Ca = 0" e a recomendação saía como se o solo não tivesse cálcio. Aqui se distingue:
 *   - não informado  (null, undefined, texto vazio)      → bloqueia se for essencial;
 *   - zero medido    (0, "0", "0,0")                      → valor legítimo (Al = 0 é comum);
 *   - inválido       (texto, negativo, fora da faixa)     → sempre bloqueia.
 *
 * Função pura, a mesma regra para formulário, OCR e emissão (o servidor repete antes de gravar a recomendação).
 */

export interface ProblemaAnalise {
  campo: ChaveParametro;
  rotulo: string;
  mensagem: string;
}

export interface ResultadoValidacaoAnalise {
  /** nada impede de calcular e emitir */
  ok: boolean;
  /** impedem a emissão */
  erros: ProblemaAnalise[];
  /** parâmetros opcionais que ficaram em branco: o laudo os mostra como "não informado" */
  naoInformados: ChaveParametro[];
}

interface Regra {
  rotulo: string;
  /** sem este parâmetro a recomendação não pode ser calculada */
  essencial: boolean;
  min: number;
  max: number;
  porque?: string;
}

export const REGRAS: Record<ChaveParametro, Regra> = {
  pH: { rotulo: 'pH', essencial: true, min: 3, max: 9, porque: 'define a necessidade de calagem' },
  argila: { rotulo: 'Argila', essencial: true, min: 0, max: 100, porque: 'define a classe de interpretação do fósforo' },
  P: { rotulo: 'Fósforo (P)', essencial: true, min: 0, max: 500, porque: 'define a adubação fosfatada' },
  K: { rotulo: 'Potássio (K)', essencial: true, min: 0, max: 2000, porque: 'entra na CTC e define a adubação potássica' },
  Ca: { rotulo: 'Cálcio (Ca)', essencial: true, min: 0, max: 30, porque: 'entra na soma de bases e na saturação por bases' },
  Mg: { rotulo: 'Magnésio (Mg)', essencial: true, min: 0, max: 30, porque: 'entra na soma de bases e na escolha do corretivo' },
  Al: { rotulo: 'Alumínio (Al)', essencial: true, min: 0, max: 30, porque: 'define a saturação por alumínio' },
  HAl: { rotulo: 'Acidez potencial (H+Al)', essencial: true, min: 0, max: 50, porque: 'define a CTC a pH 7 e a saturação por bases' },
  MO: { rotulo: 'Matéria orgânica', essencial: false, min: 0, max: 100 },
  Na: { rotulo: 'Sódio (Na)', essencial: false, min: 0, max: 2000 },
  S: { rotulo: 'Enxofre (S)', essencial: false, min: 0, max: 500 },
  B: { rotulo: 'Boro (B)', essencial: false, min: 0, max: 20 },
  Zn: { rotulo: 'Zinco (Zn)', essencial: false, min: 0, max: 100 },
  Cu: { rotulo: 'Cobre (Cu)', essencial: false, min: 0, max: 100 },
  Mn: { rotulo: 'Manganês (Mn)', essencial: false, min: 0, max: 500 },
  Fe: { rotulo: 'Ferro (Fe)', essencial: false, min: 0, max: 1000 },
};

export const PARAMETROS_ESSENCIAIS = (Object.keys(REGRAS) as ChaveParametro[]).filter((k) => REGRAS[k].essencial);
export const PARAMETROS_OPCIONAIS = (Object.keys(REGRAS) as ChaveParametro[]).filter((k) => !REGRAS[k].essencial);

/** "Informado" = tem conteúdo. 0 conta como informado; texto vazio e null não. */
export function informado(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'number') return !Number.isNaN(v);
  return String(v).trim() !== '';
}

/** Lê o número (aceita vírgula decimal). `null` se não for um número inteiro válido — ao contrário de `n()`, nunca vira 0. */
export function lerNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number.parseFloat(s);
}

export function validarAnalise(a: Analise): ResultadoValidacaoAnalise {
  const erros: ProblemaAnalise[] = [];
  const naoInformados: ChaveParametro[] = [];

  for (const campo of Object.keys(REGRAS) as ChaveParametro[]) {
    const r = REGRAS[campo];
    const bruto = a[campo];

    if (!informado(bruto)) {
      if (r.essencial) {
        erros.push({ campo, rotulo: r.rotulo, mensagem: `${r.rotulo} não foi informado — ${r.porque}. Sem ele a recomendação não pode ser calculada.` });
      } else {
        naoInformados.push(campo);
      }
      continue;
    }

    const x = lerNumero(bruto);
    if (x === null) {
      erros.push({ campo, rotulo: r.rotulo, mensagem: `${r.rotulo}: "${String(bruto)}" não é um número válido.` });
    } else if (x < r.min || x > r.max) {
      erros.push({ campo, rotulo: r.rotulo, mensagem: `${r.rotulo}: ${String(bruto)} está fora da faixa possível (${r.min} a ${r.max}). Confira o laudo do laboratório.` });
    }
  }

  return { ok: erros.length === 0, erros, naoInformados };
}

/** Texto único para mensagens de bloqueio ("Faltam: Cálcio (Ca), Magnésio (Mg)"). */
export function resumoDosErros(v: ResultadoValidacaoAnalise): string {
  if (v.ok) return '';
  return v.erros.map((e) => e.mensagem).join(' ');
}
