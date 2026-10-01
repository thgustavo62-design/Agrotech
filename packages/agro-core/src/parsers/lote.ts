import type { AmostraLaudo, CampoExtraido, ChaveCampoLaudo, ExtracaoLaudo } from './tipos.js';
import { norm } from './numero.js';
import { dentroDaFaixa } from './sanidade.js';

/**
 * Laudos em TABELA: uma linha por determinação e uma coluna por amostra (formato do
 * Laboratório Água Limpa e de vários outros). Aceita uma ou mais "passadas" de texto da
 * mesma página — com OCR, o mesmo laudo lido em resoluções diferentes erra dígitos
 * diferentes, e a votação célula a célula recupera o valor certo.
 *
 * Premissas deliberadas (valem para o laudo real que originou este perfil):
 *  - o laboratório imprime 2 casas decimais em toda célula numérica;
 *  - o OCR costuma perder a vírgula ("145" por "1,45") ou trocar um dígito. A vírgula é
 *    reconstituída, mas valor reconstituído nunca passa de 0,6 de confiança.
 */

export type FonteTexto = 'texto' | 'ocr';

interface LinhaDef {
  chave: ChaveCampoLaudo | string;
  /** casa na linha normalizada (sem acento, minúscula) */
  re: RegExp;
  /** campo de análise (true) ou só conferência (false) */
  analise: boolean;
}

/** Ordem importa: a primeira definição que casa vence. */
const LINHAS: LinhaDef[] = [
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

const RE_AMOSTRA = /^([A-Z]{2,5}-[\d-]*?-?(\d+))\s+(\S.*)$/;

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

function identificarLab(textos: string[]): { perfil: string; laboratorio: string | null } {
  const n = norm(textos.join('\n'));
  return /laboratorioagualimpa|analises de agua, solo e folhas|laboratorio agua limpa/.test(n)
    ? { perfil: 'agua-limpa', laboratorio: 'Laboratório Água Limpa' }
    : { perfil: 'tabela-colunas', laboratorio: null };
}

type Peso = 'limpo' | 'reconstituido' | 'posicional';
interface Candidato { valor: number; peso: Peso; passada: number }

/** Limpa um token de célula; devolve o número e como foi obtido, ou null se for lixo. */
function lerCelula(bruto: string): { valor: number; peso: Peso } | null {
  const t = bruto.replace(/[^0-9.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!t) return null;
  const virgula = t.replace('.', ',');
  if (/^\d{1,3},\d{2}$/.test(virgula)) return { valor: Number(virgula.replace(',', '.')), peso: 'limpo' };
  // vírgula perdida: "145" -> 1,45 ; "7572" -> 75,72 (3 a 5 dígitos, sem separador)
  if (/^\d{3,5}$/.test(t)) return { valor: Number(`${t.slice(0, -2)}.${t.slice(-2)}`), peso: 'reconstituido' };
  return null;
}

interface Passada {
  amostras: Array<{ numero_lab: string; rotulo: string; indice: number }>;
  /** chave da linha -> células (uma por amostra, null quando ilegível) */
  celulas: Map<string, Array<{ valor: number; peso: Peso } | null>>;
  ident: Record<string, string | null>;
}

function lerPassada(texto: string): Passada {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const amostras: Passada['amostras'] = [];
  for (const l of linhas) {
    const m = l.match(RE_AMOSTRA);
    if (m && /-\d+-\d+/.test(m[1]!)) amostras.push({ numero_lab: m[1]!, indice: Number(m[2]), rotulo: m[3]!.trim() });
  }
  const n = amostras.length;
  const celulas: Passada['celulas'] = new Map();

  if (n > 0) {
    const tokensDe = (linha: string) => linha.split(/\s+/).slice(-n).map(lerCelula);
    linhas.forEach((linha, i) => {
      const ln = norm(linha);
      const def = LINHAS.find((d) => d.re.test(ln));
      if (!def || celulas.has(def.chave)) return;
      celulas.set(def.chave, tokensDe(linha));

      // pH em água: o "H₂O" subscrito costuma estragar o rótulo no OCR. Se a linha de pH
      // não foi reconhecida, a linha logo ANTES da de pH CaCl2 é a dele (posição, confiança baixa).
      if (def.chave === 'ph_cacl2' && !celulas.has('ph') && i > 0) {
        const anterior = tokensDe(linhas[i - 1]!);
        if (anterior.filter(Boolean).length >= 2) {
          celulas.set('ph', anterior.map((c) => (c ? { valor: c.valor, peso: 'posicional' as const } : null)));
        }
      }
    });
  }

  return { amostras, celulas, ident: lerIdentificacao(linhas) };
}

function lerIdentificacao(linhas: string[]): Record<string, string | null> {
  const junto = linhas.join('\n');
  const pega = (re: RegExp) => junto.match(re)?.[1]?.trim() || null;
  const dataBR = (rotulo: string) => pega(new RegExp(`${rotulo}\\s*:?\\s*(\\d{2}/\\d{2}/\\d{4})`, 'i'));
  return {
    produtor: pega(/Cliente\s*:\s*(.+?)(?:\s+Registro\b|$)/im),
    propriedade: pega(/Propriedade\s*:\s*(.+?)(?:\s+Data\s+Entrada|$)/im),
    municipio: pega(/Munic[ií]pio\s*:\s*(.+?)(?:\s+Data\s+Emiss|$)/im),
    protocolo: pega(/Registro\s+lote\s*:\s*(\w+)/i),
    // o laudo traz entrada e emissão, não a data de coleta: a entrada é a mais próxima
    data: dataBR('Data\\s+Entrada'),
    data_emissao: dataBR('Data\\s+Emiss[aã]o'),
    convenio: pega(/Conv[eê]nio\s*:\s*(.+?)(?:\s+Material\b|$)/im),
  };
}

const rotuloOrigem = (cands: Candidato[], escolhido: Candidato, total: number): string => {
  const iguais = cands.filter((c) => c.valor === escolhido.valor);
  const outras = [...new Set(cands.filter((c) => c.valor !== escolhido.valor).map((c) => c.valor))];
  return `OCR: ${iguais.length} de ${total} leituras${outras.length ? ` (outras: ${outras.join('; ')})` : ''}`;
};

/** Escolhe o valor com mais votos ponderados (limpo > reconstituído > posicional). */
function votar(cands: Candidato[], totalPassadas: number, fonte: FonteTexto): { valor: number; confianca: number; origem: string } | null {
  if (cands.length === 0) return null;
  const PESO = { limpo: 1, reconstituido: 0.4, posicional: 0.3 } as const;
  const soma = new Map<number, number>();
  for (const c of cands) soma.set(c.valor, (soma.get(c.valor) ?? 0) + PESO[c.peso]);
  const [valor] = [...soma.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const escolhido = cands.filter((c) => c.valor === valor).sort((a, b) => PESO[b.peso] - PESO[a.peso])[0]!;
  const limpos = cands.filter((c) => c.valor === valor && c.peso === 'limpo').length;
  const dissidentes = cands.some((c) => c.valor !== valor && c.peso === 'limpo');

  if (fonte === 'texto') {
    return { valor, confianca: escolhido.peso === 'limpo' ? 0.98 : 0.6, origem: 'texto do PDF (tabela por colunas)' };
  }
  let confianca: number;
  if (escolhido.peso === 'posicional') confianca = 0.5;
  else if (limpos === 0) confianca = 0.6;
  else if (limpos >= 2 && !dissidentes && limpos === totalPassadas) confianca = 0.9;
  else if (limpos >= 2) confianca = 0.75;
  else confianca = totalPassadas === 1 ? 0.85 : 0.7;
  const aviso = escolhido.peso === 'posicional' ? ' — rótulo ilegível, localizado pela posição' : escolhido.peso === 'reconstituido' ? ' — vírgula reconstituída' : '';
  return { valor, confianca, origem: rotuloOrigem(cands, escolhido, totalPassadas) + aviso };
}

/**
 * Extrai um laudo em tabela a partir de uma ou mais leituras do mesmo texto. Chame com
 * `fonte: 'ocr'` e várias passadas (resoluções diferentes) para votar; `fonte: 'texto'`
 * para texto nativo de PDF.
 */
export function extrairLote(textos: string[], fonte: FonteTexto = 'texto'): ExtracaoLaudo {
  const passadas = textos.map(lerPassada).filter((p) => p.amostras.length > 0);
  const avisos: string[] = [];
  if (passadas.length === 0) {
    return { perfil: null, laboratorio: null, campos: {}, identificacao: {}, confianca_media: 0, avisos: ['Nenhuma amostra encontrada na tabela do laudo.'] };
  }

  // a passada com mais amostras manda na lista; o número de colunas é o dela
  const base = [...passadas].sort((a, b) => b.amostras.length - a.amostras.length)[0]!;
  const n = base.amostras.length;
  const usaveis = passadas.filter((p) => p.amostras.length === n);
  if (usaveis.length < passadas.length) avisos.push('Uma das leituras enxergou outro número de amostras e foi ignorada.');

  const amostras: AmostraLaudo[] = base.amostras.map((a, col) => {
    const campos: AmostraLaudo['campos'] = {};
    const extras: AmostraLaudo['extras'] = {};

    const candsExtras: Record<string, Candidato[]> = {};
    for (const def of LINHAS) {
      const cands: Candidato[] = [];
      usaveis.forEach((p, passada) => {
        const c = p.celulas.get(def.chave)?.[col];
        if (c) cands.push({ valor: c.valor, peso: c.peso, passada });
      });
      if (!def.analise) candsExtras[def.chave] = cands;
      const v = votar(cands, usaveis.length, fonte);
      if (!v) continue;
      const campo: CampoExtraido = { valor: v.valor, confianca: v.confianca, origem: v.origem };

      if (def.analise) {
        const chave = def.chave as ChaveCampoLaudo;
        if (!dentroDaFaixa(chave, v.valor)) {
          campos[chave] = { valor: null, confianca: 0, origem: `${v.origem} — valor ${v.valor} fora da faixa plausível, rejeitado` };
          avisos.push(`Amostra ${a.indice}: ${chave} ${v.valor} fora da faixa plausível — lance manualmente.`);
        } else campos[chave] = campo;
      } else extras[def.chave] = campo;
    }
    arbitrarTotais(campos, extras, candsExtras);
    return { indice: a.indice, numero_lab: maisComum(usaveis.map((p) => p.amostras[col]?.numero_lab)), rotulo: maisComum(usaveis.map((p) => p.amostras[col]?.rotulo)), campos, extras };
  });

  for (const a of amostras) conferirCoerencia(a, avisos);

  // identificação: a primeira passada que trouxer cada campo
  const identificacao: Record<string, string | null> = {};
  for (const chave of Object.keys(base.ident)) {
    identificacao[chave] = passadas.map((p) => p.ident[chave]).find(Boolean) ?? null;
  }

  const lab = identificarLab(textos);
  const validos = amostras.flatMap((a) => Object.values(a.campos)).filter((c) => c.valor !== null);
  const confianca_media = validos.length ? validos.reduce((s, c) => s + c.confianca, 0) / validos.length : 0;
  if (fonte === 'ocr') avisos.unshift('PDF escaneado, lido por OCR: confira os valores com o laudo ao lado antes de confirmar.');

  return {
    perfil: lab.perfil,
    laboratorio: lab.laboratorio,
    fonte,
    campos: amostras[0]?.campos ?? {},
    amostras,
    identificacao,
    confianca_media: Math.round(confianca_media * 1000) / 1000,
    avisos,
  };
}

/** Texto mais repetido entre as leituras (empate: o da primeira). */
function maisComum(valores: Array<string | undefined>): string | null {
  const cont = new Map<string, number>();
  for (const v of valores) if (v) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
}

const K_MG_POR_CMOLC = 391;

/**
 * SB e T são totais impressos que o OCR lê mal ("5,17" por "5,77"). Em vez de deixar a
 * maioria decidir, usa a conta: entre as leituras de SB, vale a que fecha com Ca+Mg+K/391
 * (e a de T que fecha com SB + H+Al). Só vence a leitura que a aritmética confirma.
 */
function arbitrarTotais(
  campos: AmostraLaudo['campos'],
  extras: AmostraLaudo['extras'],
  cands: Record<string, Candidato[]>,
): void {
  const v = (k: ChaveCampoLaudo) => campos[k]?.valor ?? null;
  const escolher = (chave: string, esperado: number, origem: string) => {
    const bate = (cands[chave] ?? []).find((c) => Math.abs(c.valor - esperado) <= 0.03);
    if (bate) extras[chave] = { valor: bate.valor, confianca: 0.95, origem };
  };
  const ca = v('ca'), mg = v('mg'), k = v('k'), hal = v('h_al');
  if (ca !== null && mg !== null && k !== null) {
    escolher('sb', ca + mg + k / K_MG_POR_CMOLC, 'OCR: leitura que fecha com Ca+Mg+K');
  }
  const sb = extras['sb']?.valor ?? null;
  if (sb !== null && hal !== null) escolher('t_ctc', sb + hal, 'OCR: leitura que fecha com SB+H+Al');
}

/**
 * O laudo imprime SB e T, que dependem dos próprios valores lidos:
 *   SB = Ca + Mg + K/391        T = SB + (H+Al)
 * Se batem, a leitura de Ca/Mg/K/H+Al ganha confiança; se não, todos caem para 0,6 e
 * o aviso diz qual conta falhou — erro de OCR (ou de digitação do laboratório) fica visível.
 */
function conferirCoerencia(a: AmostraLaudo, avisos: string[]): void {
  const v = (k: string) => a.campos[k as ChaveCampoLaudo]?.valor ?? null;
  const ca = v('ca'), mg = v('mg'), k = v('k'), hal = v('h_al');
  const sb = a.extras['sb']?.valor ?? null;
  const t = a.extras['t_ctc']?.valor ?? null;
  const marcar = (chaves: ChaveCampoLaudo[], bate: boolean) => {
    for (const ch of chaves) {
      const c = a.campos[ch];
      if (!c || c.valor === null) continue;
      c.confianca = bate ? Math.max(c.confianca, 0.95) : Math.min(c.confianca, 0.6);
      c.origem += bate ? ' · confere com a soma de bases do laudo' : ' · NÃO confere com a soma de bases do laudo';
    }
  };

  let sbCalc: number | null = null;
  if (ca !== null && mg !== null && k !== null) {
    sbCalc = ca + mg + k / K_MG_POR_CMOLC;
    if (sb !== null) {
      const bate = Math.abs(sbCalc - sb) <= 0.03;
      marcar(['ca', 'mg', 'k'], bate);
      if (!bate) avisos.push(`Amostra ${a.indice}: SB impresso ${sb} ≠ Ca+Mg+K = ${sbCalc.toFixed(2)} — confira Ca, Mg e K.`);
    }
  }
  const sbRef = sb ?? sbCalc;
  if (sbRef !== null && hal !== null && t !== null) {
    const bate = Math.abs(sbRef + hal - t) <= 0.03;
    marcar(['h_al'], bate);
    if (!bate) avisos.push(`Amostra ${a.indice}: T impresso ${t} ≠ SB + H+Al = ${(sbRef + hal).toFixed(2)} — confira H+Al.`);
  }
}

/**
 * Entrada para PDF escaneado: recebe uma ou mais leituras OCR da mesma página (resoluções
 * diferentes). Laudo em tabela vota célula a célula; qualquer outro layout usa a melhor
 * leitura (a mais longa) pelo caminho de rótulos, com confiança limitada a 0,85 — OCR
 * nunca chega ao patamar de texto nativo.
 */
export function extrairDeOcr(leituras: string[], extrairSimples: (texto: string) => ExtracaoLaudo): ExtracaoLaudo {
  const uteis = leituras.filter((t) => t.trim().length > 0);
  if (uteis.length === 0) {
    return { perfil: null, laboratorio: null, fonte: 'ocr', campos: {}, identificacao: {}, confianca_media: 0, avisos: ['OCR não encontrou texto legível no PDF.'] };
  }
  if (uteis.some(ehLaudoEmTabela)) return extrairLote(uteis.filter(ehLaudoEmTabela), 'ocr');

  const melhor = [...uteis].sort((a, b) => b.length - a.length)[0]!;
  const e = extrairSimples(melhor);
  for (const c of Object.values(e.campos)) {
    if (c.valor !== null) c.confianca = Math.min(c.confianca, 0.85);
  }
  const validos = Object.values(e.campos).filter((c) => c.valor !== null);
  e.confianca_media = validos.length ? Math.round((validos.reduce((s, c) => s + c.confianca, 0) / validos.length) * 1000) / 1000 : 0;
  e.fonte = 'ocr';
  e.avisos.unshift('PDF escaneado, lido por OCR: confira os valores com o laudo ao lado antes de confirmar.');
  return e;
}
