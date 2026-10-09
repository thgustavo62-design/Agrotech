import type { CampoExtraido, ChaveCampoLaudo } from './tipos.js';
import { norm, parseNumeroBR } from './numero.js';
import { dentroDaFaixa } from './sanidade.js';

/**
 * Leitor de laudo "uma determinação por linha" SEM depender do laboratório (nem de palavras como "Mehlich"):
 *   Cálcio (Ca)  3,1  cmolc/dm³  2,4 - 4,0     |     K  mmolc/dm³  2,9  Médio     |     M.O. (dag/kg) ..... 3,1
 * O que importa é o que a linha tem de verdade: rótulo, no máximo parênteses/extrator/unidade e então o número.
 * A unidade impressa decide a conversão (mmolc→cmolc, K em carga→mg/dm³, g/dm³→dag/kg). Quem não tem cara de laudo
 * (poucos parâmetros, poucas unidades, texto longo) continua sendo recusado, como nos outros leitores.
 */

type Un = 'mmolc' | 'cmolc' | 'mg' | 'g' | 'dag' | '';
const FIM_UN = '(?:dm\\s*[³3]|kg|l)(?![a-z])';
const UNIDADES: Array<[RegExp, Un]> = [
  [new RegExp(`^mmol\\s*(?:\\(\\s*c\\s*\\)|c)?\\s*\\/\\s*${FIM_UN}`), 'mmolc'],
  [new RegExp(`^cmol\\s*(?:\\(\\s*c\\s*\\)|c)?\\s*\\/\\s*${FIM_UN}`), 'cmolc'],
  [new RegExp(`^dag\\s*\\/\\s*${FIM_UN}`), 'dag'],
  [new RegExp(`^(?:mg|µg)\\s*\\/\\s*${FIM_UN}`), 'mg'],
  [/^ppm(?![a-z])/, 'mg'],
  [new RegExp(`^g\\s*\\/\\s*${FIM_UN}`), 'g'],
  [/^%/, 'dag'],
];

function unidadeNoInicio(s: string): { un: Un; tamanho: number } | null {
  for (const [re, un] of UNIDADES) {
    const m = re.exec(s);
    if (m) return { un, tamanho: m[0].length };
  }
  return null;
}

const FIM = '(?![a-z]|\\d(?!\\s*\\+))'; // "Ca2+" vale; "P2O5" e "pH" não
const ROTULOS: Array<[ChaveCampoLaudo, RegExp]> = [
  ['ph', new RegExp(`^ph${FIM}`)],
  ['mo', new RegExp(`^(?:materia organica|mat\\.? org\\.?|carbono organico|c organico|c\\.\\s?o\\.|m\\.?\\s?o\\.?)${FIM}`)],
  ['p', new RegExp(`^(?:fosforo|p)${FIM}`)],
  ['k', new RegExp(`^(?:potassio|k)${FIM}`)],
  ['na', new RegExp(`^(?:sodio|na)${FIM}`)],
  ['ca', new RegExp(`^(?:calcio|ca)${FIM}`)],
  ['mg', new RegExp(`^(?:magnesio|mg)${FIM}`)],
  ['al', new RegExp(`^(?:aluminio|al)${FIM}`)],
  ['h_al', new RegExp(`^(?:acidez potencial|h\\s*\\+\\s*al)${FIM}`)],
  ['s', new RegExp(`^(?:enxofre|s)${FIM}`)],
  ['b', new RegExp(`^(?:boro|b)${FIM}`)],
  ['zn', new RegExp(`^(?:zinco|zn)${FIM}`)],
  ['cu', new RegExp(`^(?:cobre|cu)${FIM}`)],
  ['mn', new RegExp(`^(?:manganes|mn)${FIM}`)],
  ['fe', new RegExp(`^(?:ferro|fe)${FIM}`)],
  ['argila', new RegExp(`^argila${FIM}`)],
];
const ROTULO_SB = new RegExp(`^(?:soma de bases|s\\.\\s?b\\.|sb)${FIM}`);

const SEP = /^[\s.·_:|=\-–—~'‘’]+/;
const PARENTESES = /^\(([^)]{0,30})\)/;
const CARGA = /^(?:[23]\s*\+|²⁺|³⁺|\+\s*[23]|\+)/;
const PALAVRA = /^(?:mehlich(?:\s*-?\s*1)?|resina|kcl|cacl2|cacl₂|h2o|em agua|agua|trocavel|disponivel|assimilavel|extrator|smp|total)(?![a-z])/;
const NUMERO = /^(<\s*)?(\d[\d.,]*\d|\d)/;
/** Quanto de "enfeite" cabe entre o rótulo e o número. Mais que isso é frase, não resultado. */
const ENFEITE_MAX = 60;

interface Leitura { valor: number; menorQue: boolean; un: Un; enfeite: string }

/** Depois do rótulo: só separadores, parênteses, carga iônica, extrator e unidade; então o número. */
function lerResto(resto: string): Leitura | null {
  let r = resto;
  let enfeite = '';
  let un: Un = '';
  for (let volta = 0; volta < 14; volta++) {
    const antes = r;
    let m: RegExpExecArray | null;
    if ((m = SEP.exec(r))) { r = r.slice(m[0].length); continue; }
    if ((m = PARENTESES.exec(r))) {
      enfeite += ' ' + m[1];
      const dentro = unidadeNoInicio((m[1] ?? '').trim());
      if (dentro && !un) un = dentro.un;
      r = r.slice(m[0].length);
      continue;
    }
    const u = unidadeNoInicio(r);
    if (u) { if (!un) un = u.un; enfeite += ' ' + r.slice(0, u.tamanho); r = r.slice(u.tamanho); continue; }
    if ((m = CARGA.exec(r))) { r = r.slice(m[0].length); continue; }
    if ((m = PALAVRA.exec(r))) { enfeite += ' ' + m[0]; r = r.slice(m[0].length); continue; }
    if (r === antes) break;
  }
  if (resto.length - r.length > ENFEITE_MAX) return null;
  const n = NUMERO.exec(r);
  if (!n) return null;
  const bruto = parseNumeroBR(n[2]);
  if (bruto == null) return null;
  // unidade logo depois do número ("3,1 cmolc/dm³ 2,4 - 4,0")
  if (!un) {
    const depois = r.slice(n[0].length).replace(SEP, '');
    const u = unidadeNoInicio(depois.replace(/^\(/, ''));
    if (u) un = u.un;
  }
  return { valor: bruto, menorQue: Boolean(n[1]), un, enfeite };
}

const arred = (v: number) => Math.round(v * 1000) / 1000;
const NUCLEO: ChaveCampoLaudo[] = ['ph', 'mo', 'p', 'k', 'ca', 'mg', 'al', 'h_al'];

export interface LeituraLinhaALinha {
  campos: Partial<Record<ChaveCampoLaudo, CampoExtraido>>;
  avisos: string[];
  confianca_media: number;
}

/** null = não parece laudo de análise de solo (o chamador mostra a mensagem padrão). */
export function lerLinhaALinha(texto: string): LeituraLinhaALinha | null {
  const linhas = texto.split(/\r?\n/).map((l) => norm(l)).filter(Boolean);
  const mmolcNoTexto = linhas.some((l) => /mmol/.test(l));
  const cmolcNoTexto = linhas.some((l) => /cmol/.test(l));
  const escalaCarga = mmolcNoTexto && !cmolcNoTexto ? 0.1 : 1; // fator para cmolc/dm³

  const campos: Partial<Record<ChaveCampoLaudo, CampoExtraido>> = {};
  const avisos: string[] = [];
  let comUnidade = 0;
  let sb: number | null = null;

  for (const linha of linhas) {
    if (sb === null && ROTULO_SB.test(linha)) {
      const m = ROTULO_SB.exec(linha)!;
      const l = lerResto(linha.slice(m[0].length));
      if (l && !l.menorQue) sb = l.valor * (l.un === 'mmolc' ? 0.1 : l.un === 'cmolc' ? 1 : escalaCarga);
      continue;
    }
    for (const [chave, re] of ROTULOS) {
      const m = re.exec(linha);
      if (!m) continue;
      if (campos[chave]) break; // vale a primeira linha que trouxe resultado
      const l = lerResto(linha.slice(m[0].length));
      if (!l) break;

      const infere = l.un === '';
      let valor = l.valor;
      let nota = '';
      switch (chave) {
        case 'ca': case 'mg': case 'al': case 'h_al': {
          const f = l.un === 'mmolc' ? 0.1 : l.un === 'cmolc' ? 1 : l.un === '' ? escalaCarga : null;
          if (f === null) continue;
          valor *= f; if (f !== 1) nota = ' (mmolc → cmolc)';
          break;
        }
        case 'k': {
          if (l.un === 'cmolc') { valor *= 391; nota = ' (cmolc → mg/dm³)'; }
          else if (l.un === 'mmolc') { valor *= 39.1; nota = ' (mmolc → mg/dm³)'; }
          else if (l.un === '' && (mmolcNoTexto || cmolcNoTexto) && valor < 15) { valor *= escalaCarga === 0.1 ? 39.1 : 391; nota = ' (carga → mg/dm³)'; }
          else if (l.un === 'g' || l.un === 'dag') continue;
          break;
        }
        case 'mo': {
          const carbono = /carbono|c organico|c\./.test(m[0]);
          let f = l.un === 'g' ? 0.1 : l.un === 'dag' ? 1 : l.un === '' ? (valor > 12 ? 0.1 : 1) : null;
          if (f === null) continue;
          if (carbono) f *= 1.724;
          valor *= f; if (f !== 1) nota = carbono ? ' (carbono → matéria orgânica)' : ' (g/dm³ → dag/kg)';
          break;
        }
        case 'ph': {
          if (/cacl/.test(linha.slice(0, m[0].length + l.enfeite.length + 12))) avisos.push('pH em CaCl₂ (costuma ficar ~0,5 abaixo do pH em água): as faixas de interpretação do app são para pH em água — confira.');
          break;
        }
        case 'p': {
          if (/resina/.test(linha)) avisos.push('Fósforo por resina: as faixas de interpretação do app são de Mehlich-1 — confira antes de recomendar.');
          break;
        }
        default: break;
      }

      valor = arred(valor);
      if (l.menorQue) {
        // "< 0,1" = abaixo do que o laboratório mede; entra como 0 mas fica destacado para conferência
        campos[chave] = { valor: 0, confianca: 0.6, origem: `linha "${linha.slice(0, 40).trim()}" — abaixo do limite de detecção, registrado como 0`, bruto: linha.trim() };
        avisos.push(`${chave}: impresso como "<${l.valor}" — registrado como 0, confira.`);
        break;
      }
      if (!dentroDaFaixa(chave, valor)) {
        campos[chave] = { valor: null, confianca: 0, origem: `linha — valor ${valor} fora da faixa plausível, rejeitado`, bruto: linha.trim() };
        avisos.push(`${chave}: valor ${valor} fora da faixa plausível — lance manualmente.`);
        break;
      }
      if (!infere) comUnidade++;
      campos[chave] = {
        valor,
        confianca: infere ? 0.8 : 0.92,
        origem: `leitura por linha${infere ? ' (unidade deduzida)' : ''}${nota}`,
        bruto: linha.trim(),
      };
      break;
    }
  }

  const reconhecidos = NUCLEO.filter((k) => campos[k] != null).length;
  const plausiveis = NUCLEO.filter((k) => campos[k]?.valor != null).length;
  if (plausiveis < 3 || reconhecidos < 4 || comUnidade < 3) return null;

  // a aritmética do próprio laudo confirma (ou denuncia) Ca, Mg e K — só ajusta a confiança, nunca o valor
  const v = (k: ChaveCampoLaudo) => campos[k]?.valor ?? null;
  const ca = v('ca'), mg = v('mg'), k = v('k');
  if (sb !== null && ca !== null && mg !== null && k !== null) {
    const calc = ca + mg + k / 391;
    const bate = Math.abs(calc - sb) <= Math.max(0.06, 0.03 * sb);
    for (const ch of ['ca', 'mg', 'k'] as const) {
      const c = campos[ch];
      if (!c || c.valor === null) continue;
      c.confianca = bate ? Math.max(c.confianca, 0.95) : Math.min(c.confianca, 0.6);
      c.origem += bate ? ' · confere com a soma de bases do laudo' : ' · NÃO confere com a soma de bases do laudo';
    }
    if (!bate) avisos.push(`SB impresso ${arred(sb)} ≠ Ca+Mg+K = ${calc.toFixed(2)} — confira Ca, Mg e K.`);
  }

  const validos = Object.values(campos).filter((c) => c.valor !== null);
  const media = validos.length ? validos.reduce((s, c) => s + c.confianca, 0) / validos.length : 0;
  if (validos.length < 6) avisos.push('Menos de 6 parâmetros extraídos — provável layout novo, revisar na tela de conferência.');
  return { campos, avisos: [...new Set(avisos)], confianca_media: Math.round(media * 1000) / 1000 };
}
