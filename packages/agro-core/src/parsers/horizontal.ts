import type { AmostraLaudo, CampoExtraido, ChaveCampoLaudo, ExtracaoLaudo } from './tipos.js';
import { dentroDaFaixa } from './sanidade.js';
import { parseNumeroBR } from './numero.js';

/**
 * Laudo em TABELA HORIZONTAL: um cabeçalho com os nomes das determinações (pH, M.O., P, K, Ca, Mg, H+Al, SB,
 * CTC, V, m …) e uma LINHA por amostra — o formato de vários laboratórios (IAC/ESALQ, universidades, muitos
 * privados). O leitor por rótulo ("Ca ........ 1,2") não enxerga isso.
 *
 * Como lê: acha a linha de cabeçalho (≥ 5 colunas conhecidas), depois cada linha de dados com ao menos essa
 * quantidade de números e pega os ÚLTIMOS N (o que vem antes é identificação: nº do laudo, talhão, profundidade).
 * Unidades: o laudo pode imprimir cmolc/dm³ ou mmolc/dm³, K em mg/dm³ ou em carga, M.O. em g/dm³ ou dag/kg — a
 * conta SB = Ca+Mg+K do próprio laudo decide qual vale (e, na falta dela, o texto das unidades e a ordem de grandeza).
 * Nada aqui é "corrigido" em silêncio: faixa fisicamente impossível vira null, e a confiança só sobe quando a
 * aritmética do laudo fecha.
 */

type Col = ChaveCampoLaudo | 'sb' | 't_efetiva' | 't_ctc' | 'v_pct' | 'm_pct';

/** Leitura de uma célula de cabeçalho; `original` mantém a caixa (t = CTC efetiva, T = CTC a pH 7). */
function colunaDe(token: string): Col | null {
  const t = token.replace(/[()%*:]/g, '');
  const n = t.toLowerCase().replace(/\./g, '');
  if (t === 'T') return 't_ctc';
  if (t === 't') return 't_efetiva';
  if (/^ph(h2o|cacl2|kcl|agua|emagua|emcacl2)?$/.test(n)) return 'ph';
  if (/^(mo|matorg|materiaorganica|co|carbonoorganico)$/.test(n)) return 'mo';
  if (/^p(resina|mehlich|mehlich1|meh)?$/.test(n)) return 'p';
  if (/^s(so4|enxofre)?$/.test(n)) return 's';
  if (n === 'k' || n === 'potassio') return 'k';
  if (n === 'na' || n === 'sodio') return 'na';
  if (n === 'ca' || n === 'calcio') return 'ca';
  if (n === 'mg' || n === 'magnesio') return 'mg';
  if (n === 'al' || n === 'aluminio') return 'al';
  if (n === 'hal' || n === 'h+al' || n === 'acidezpotencial') return 'h_al';
  if (n === 'sb' || n === 'somadebases') return 'sb';
  if (n === 'ctc' || n === 'ctcph7') return 't_ctc';
  if (n === 'v' || n === 'sat bases' || n === 'satbases') return 'v_pct';
  if (n === 'm') return 'm_pct';
  if (n === 'b' || n === 'boro') return 'b';
  if (n === 'cu' || n === 'cobre') return 'cu';
  if (n === 'fe' || n === 'ferro') return 'fe';
  if (n === 'mn' || n === 'manganes') return 'mn';
  if (n === 'zn' || n === 'zinco') return 'zn';
  return null;
}

/** "H + Al", "P resina", "pH CaCl2", "M.O." viram uma célula só antes de separar por espaço. */
function juntarRotulos(linha: string): string {
  return linha
    .replace(/h\s*\+\s*al/gi, 'H+Al')
    .replace(/m\s*\.\s*o\s*\./gi, 'MO')
    .replace(/mat\.?\s*org\.?/gi, 'MO')
    .replace(/p\s*(?:\(\s*)?(?:resina|mehlich-?1?)\)?/gi, 'P')
    .replace(/ph\s*(?:\(\s*)?(?:em\s+)?(?:cacl2|h2o|agua|água|kcl)\)?/gi, 'pH')
    .replace(/s\s*-?\s*so4/gi, 'S')
    .replace(/sat\.?\s*(?:por\s*)?bases/gi, 'V');
}

const NUM = /^-?\d+(?:[.,]\d+)?$/;
const ehNumero = (t: string) => NUM.test(t);

interface Cabecalho { indice: number; colunas: Col[] }

/** Primeira linha com ≥ 5 colunas conhecidas, sem repetição, e que seja a maior parte da linha. */
function acharCabecalho(linhas: string[]): Cabecalho | null {
  for (let i = 0; i < linhas.length; i++) {
    const tokens = juntarRotulos(linhas[i]!).split(/\s+/).filter(Boolean);
    const cols: Col[] = [];
    let desconhecidos = 0;
    let comecou = false;
    for (const tk of tokens) {
      const c = colunaDe(tk);
      if (c && !cols.includes(c)) { cols.push(c); comecou = true; } else if (comecou) desconhecidos++;
    }
    if (cols.length >= 5 && desconhecidos <= cols.length) return { indice: i, colunas: cols };
  }
  return null;
}

interface Escala { cations: number; kParaMg: number; mo: number; modo: 'sb' | 'unidades' | 'magnitude' }

/** Decide as escalas (mmolc→cmolc, K→mg/dm³, g/dm³→dag/kg) com a conta SB = Ca+Mg+K quando o laudo imprime SB. */
function decidirEscala(zona: string, amostras: Array<Partial<Record<Col, number>>>): Escala {
  const z = zona.toLowerCase();
  const textoMmolc = /mmolc/.test(z);
  const textoCmolc = /cmolc/.test(z);
  const kEmMg = /mg\s*\/\s*dm|mg\s*\/\s*l|ppm/.test(z);
  const moGdm = /g\s*\/\s*dm|g\s*\/\s*kg/.test(z) && !/dag/.test(z);

  const unidadeCarga = (a: Partial<Record<Col, number>>) => (Math.max(a.ca ?? 0, a.mg ?? 0, a.h_al ?? 0) > 15 ? 'mmolc' : 'cmolc');
  const tem = amostras.find((a) => a.ca != null && a.mg != null && a.k != null && a.sb != null);

  let cations = textoMmolc && !textoCmolc ? 0.1 : 1;
  let kParaMg = 1; // multiplicador para chegar em mg/dm³
  let modo: Escala['modo'] = textoMmolc || textoCmolc ? 'unidades' : 'magnitude';

  if (tem) {
    const ca = tem.ca!, mg = tem.mg!, k = tem.k!, sb = tem.sb!;
    const bate = (calc: number) => Math.abs(calc - sb) <= Math.max(0.06, 0.03 * sb);
    if (bate(ca + mg + k / 391)) { // K em mg/dm³, bases em cmolc
      cations = 1; kParaMg = 1; modo = 'sb';
    } else if (bate(ca + mg + k)) { // tudo em carga; a escala (mmolc × cmolc) sai do texto/magnitude
      const mmolc = textoMmolc && !textoCmolc ? true : textoCmolc && !textoMmolc ? false : unidadeCarga(tem) === 'mmolc';
      cations = mmolc ? 0.1 : 1;
      kParaMg = mmolc ? 39.1 : 391; // K mmolc/dm³ × 39,1 = mg/dm³ ; K cmolc/dm³ × 391 = mg/dm³
      modo = 'sb';
    }
  } else {
    const a = amostras[0] ?? {};
    const kBaixo = (a.k ?? 99) < 15; // K em mg/dm³ costuma passar de 20; em carga fica abaixo de 10
    if (kBaixo && !kEmMg) {
      const mmolc = textoMmolc && !textoCmolc ? true : unidadeCarga(a) === 'mmolc';
      cations = mmolc ? 0.1 : 1;
      kParaMg = mmolc ? 39.1 : 391;
    } else {
      cations = textoMmolc && !textoCmolc ? 0.1 : unidadeCarga(a) === 'mmolc' ? 0.1 : 1;
      kParaMg = 1;
    }
  }

  const moBruto = amostras[0]?.mo ?? 0;
  const mo = moGdm || (!/dag/.test(z) && moBruto > 12) ? 0.1 : 1; // g/dm³ → dag/kg
  return { cations, kParaMg, mo, modo };
}

const arred = (v: number) => Math.round(v * 1000) / 1000;

export function extrairTabelaHorizontal(texto: string): ExtracaoLaudo | null {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cab = acharCabecalho(linhas);
  if (!cab) return null;
  const n = cab.colunas.length;

  // linhas de dados: logo depois do cabeçalho (e da linha de unidades), com ≥ n números
  const dados: Array<{ rotulo: string; v: number[] }> = [];
  let vazias = 0;
  for (let i = cab.indice + 1; i < Math.min(linhas.length, cab.indice + 60); i++) {
    const tokens = linhas[i]!.split(/\s+/);
    const nums = tokens.filter(ehNumero);
    if (nums.length >= n) {
      const ultimos = nums.slice(-n).map((t) => parseNumeroBR(t) as number);
      const primeiroNum = tokens.findIndex(ehNumero);
      const rotulo = tokens.slice(0, primeiroNum).join(' ') || tokens.slice(0, Math.max(0, tokens.length - n)).join(' ');
      dados.push({ rotulo: rotulo.trim(), v: ultimos });
      vazias = 0;
    } else if (dados.length > 0 && ++vazias >= 3) break;
  }
  if (dados.length === 0) return null;

  const amostrasBrutas = dados.map((d) => {
    const o: Partial<Record<Col, number>> = {};
    cab.colunas.forEach((c, i) => { o[c] = d.v[i]; });
    return o;
  });

  const zona = linhas.slice(Math.max(0, cab.indice - 1), cab.indice + 4).join(' ');
  const esc = decidirEscala(zona, amostrasBrutas);
  const avisos: string[] = [];
  const phCaCl2 = /cacl/i.test(zona);
  const pResina = /resina/i.test(zona);
  if (phCaCl2) avisos.push('pH em CaCl₂ (costuma ficar ~0,5 abaixo do pH em água): as faixas de interpretação do app são para pH em água — confira.');
  if (pResina) avisos.push('Fósforo por resina: as faixas de interpretação do app são de Mehlich-1 — confira antes de recomendar.');
  // sem unidade impressa e sem a soma de bases para confirmar, é só uma tabela de números (exemplo de livro, tabela
  // de classes…): não arrisca chamar de laudo
  if (esc.modo === 'magnitude') return null;

  const base = esc.modo === 'sb' ? 0.92 : 0.85;

  const amostras: AmostraLaudo[] = amostrasBrutas.map((a, idx) => {
    const campos: AmostraLaudo['campos'] = {};
    const extras: AmostraLaudo['extras'] = {};
    const por = (chave: ChaveCampoLaudo, bruto: number | undefined, fator: number, origem: string) => {
      if (bruto == null) return;
      const valor = arred(bruto * fator);
      const c: CampoExtraido = { valor, confianca: base, origem };
      if (!dentroDaFaixa(chave, valor)) {
        campos[chave] = { valor: null, confianca: 0, origem: `${origem} — valor ${valor} fora da faixa plausível, rejeitado` };
        avisos.push(`Amostra ${idx + 1}: ${chave} ${valor} fora da faixa plausível — lance manualmente.`);
      } else campos[chave] = c;
    };
    por('ph', a.ph, 1, 'tabela horizontal');
    por('mo', a.mo, esc.mo, esc.mo === 1 ? 'tabela horizontal' : 'tabela horizontal (g/dm³ → dag/kg)');
    por('p', a.p, 1, 'tabela horizontal');
    por('s', a.s, 1, 'tabela horizontal');
    por('k', a.k, esc.kParaMg, esc.kParaMg === 1 ? 'tabela horizontal' : 'tabela horizontal (carga → mg/dm³)');
    por('na', a.na, 1, 'tabela horizontal');
    for (const ch of ['ca', 'mg', 'al', 'h_al'] as const) por(ch, a[ch], esc.cations, esc.cations === 1 ? 'tabela horizontal' : 'tabela horizontal (mmolc → cmolc)');
    for (const ch of ['b', 'cu', 'fe', 'mn', 'zn'] as const) por(ch, a[ch], 1, 'tabela horizontal');

    for (const [col, fator] of [['sb', esc.cations], ['t_efetiva', esc.cations], ['t_ctc', esc.cations], ['v_pct', 1], ['m_pct', 1]] as const) {
      const bruto = a[col];
      if (bruto != null) extras[col] = { valor: arred(bruto * fator), confianca: base, origem: 'impresso no laudo (conferência)' };
    }

    // conferência pela aritmética do próprio laudo: só confirma, nunca "corrige"
    const v = (k: ChaveCampoLaudo) => campos[k]?.valor ?? null;
    const sb = extras['sb']?.valor ?? null;
    const ca = v('ca'), mg = v('mg'), k = v('k'), hal = v('h_al');
    if (ca !== null && mg !== null && k !== null && sb !== null) {
      const calc = ca + mg + k / 391;
      const bate = Math.abs(calc - sb) <= Math.max(0.06, 0.03 * sb);
      for (const ch of ['ca', 'mg', 'k'] as const) {
        const c = campos[ch];
        if (!c || c.valor === null) continue;
        c.confianca = bate ? Math.max(c.confianca, 0.95) : Math.min(c.confianca, 0.6);
        c.origem += bate ? ' · confere com a soma de bases do laudo' : ' · NÃO confere com a soma de bases do laudo';
      }
      if (!bate) avisos.push(`Amostra ${idx + 1}: SB impresso ${sb} ≠ Ca+Mg+K = ${calc.toFixed(2)} — confira Ca, Mg e K.`);
      const t = extras['t_ctc']?.valor ?? null;
      if (t !== null && hal !== null) {
        const bateT = Math.abs(sb + hal - t) <= Math.max(0.06, 0.03 * t);
        const c = campos['h_al'];
        if (c && c.valor !== null) {
          c.confianca = bateT ? Math.max(c.confianca, 0.95) : Math.min(c.confianca, 0.6);
          c.origem += bateT ? ' · confere com a CTC do laudo' : ' · NÃO confere com a CTC do laudo';
        }
        if (!bateT) avisos.push(`Amostra ${idx + 1}: CTC impressa ${t} ≠ SB + H+Al = ${(sb + hal).toFixed(2)} — confira H+Al.`);
      }
    }
    return { indice: idx + 1, numero_lab: null, rotulo: dados[idx]!.rotulo || null, campos, extras };
  });

  // duas ou mais determinações impossíveis na mesma amostra = colunas lidas fora de lugar (ou não é um laudo)
  if (amostras.some((x) => Object.values(x.campos).filter((c) => c.valor === null).length >= 2)) return null;

  const validos = amostras.flatMap((x) => Object.values(x.campos)).filter((c) => c.valor !== null);
  const confianca_media = validos.length ? validos.reduce((s, c) => s + c.confianca, 0) / validos.length : 0;
  if (validos.length === 0) return null;

  return {
    perfil: 'tabela-horizontal',
    laboratorio: null,
    fonte: 'texto',
    campos: amostras[0]?.campos ?? {},
    amostras,
    identificacao: {},
    confianca_media: Math.round(confianca_media * 1000) / 1000,
    avisos,
  };
}
