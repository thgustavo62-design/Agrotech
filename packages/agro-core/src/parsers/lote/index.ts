import type { AmostraLaudo, CampoExtraido, ChaveCampoLaudo, ExtracaoLaudo } from '../tipos.js';
import { dentroDaFaixa } from '../sanidade.js';
import { ehLaudoEmTabela, identificarLab, LINHAS } from './formato.js';
import { lerPassada } from './leitura.js';
import { votar } from './votacao.js';
import { arbitrarTotais, conferirCoerencia } from './coerencia.js';
import type { Candidato, FonteTexto } from './tipos.js';

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

export type { FonteTexto };
export { ehLaudoEmTabela };

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
