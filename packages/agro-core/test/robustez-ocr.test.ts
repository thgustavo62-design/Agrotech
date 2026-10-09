import { describe, expect, it } from 'vitest';
import { extrairDeLeiturasOcr } from '../src/parsers/extrair.js';
import { OCR_AGUA_LIMPA, VERDADE_AGUA_LIMPA } from './fixtures/agua-limpa.js';

/**
 * Robustez do OCR: estraga números das leituras REAIS do laudo (os erros que o tesseract comete: vírgula perdida, dígito
 * trocado por outro parecido, dígito sumido ou sobrando) e mede o que importa — não quantos valores saem certos, e sim
 * se algum ERRADO sai com confiança alta (um erro que ninguém é convidado a conferir). Gerador pseudoaleatório fixo.
 */
function gerador(semente: number) {
  let s = semente >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const PARECIDOS: Record<string, string> = { '1': '7', '7': '1', '3': '8', '8': '3', '5': '6', '6': '5', '0': '8', '4': '9', '9': '4', '2': '7' };

function estragar(texto: string, taxa: number, rnd: () => number): string {
  const ini = texto.search(/SCP-1-/);
  const cabecalho = ini > 0 ? texto.slice(0, ini) : '';
  return cabecalho + texto.slice(ini > 0 ? ini : 0).replace(/\d+[,.]\d+/g, (tok) => {
    if (rnd() > taxa) return tok;
    const tipo = rnd();
    const i = Math.floor(rnd() * tok.length);
    if (tipo < 0.4) return tok.replace(/[,.]/, ''); // vírgula perdida
    if (tipo < 0.75) { // dígito trocado por um parecido
      const d = tok[i]!;
      return /\d/.test(d) ? tok.slice(0, i) + (PARECIDOS[d] ?? String((Number(d) + 1) % 10)) + tok.slice(i + 1) : tok;
    }
    if (tipo < 0.9) return tok.slice(0, i) + tok.slice(i + 1); // dígito sumido
    return tok.slice(0, i) + String(Math.floor(rnd() * 10)) + tok.slice(i); // dígito sobrando
  });
}

interface Placar { tentativas: number; certos: number; errados: number; erradosConfiantes: number; ausentes: number }

function medir(passadasEstragadas: number, taxa: number, rodadas: number, semente: number): Placar {
  const rnd = gerador(semente);
  const p: Placar = { tentativas: 0, certos: 0, errados: 0, erradosConfiantes: 0, ausentes: 0 };
  for (let r = 0; r < rodadas; r++) {
    const ordem = [0, 1, 2, 3].sort(() => rnd() - 0.5).slice(0, passadasEstragadas);
    const leituras = OCR_AGUA_LIMPA.map((t, i) => (ordem.includes(i) ? estragar(t, taxa, rnd) : t));
    const e = extrairDeLeiturasOcr(leituras);
    (e.amostras ?? []).forEach((a, i) => {
      const v = VERDADE_AGUA_LIMPA[i] as Record<string, number> | undefined;
      if (!v) return;
      for (const [k, esperado] of Object.entries(v)) {
        p.tentativas++;
        const c = (a.campos as Record<string, { valor: number | null; confianca: number } | undefined>)[k];
        if (!c || c.valor === null) { p.ausentes++; continue; }
        if (Math.abs(c.valor - esperado) < 0.006) { p.certos++; continue; }
        p.errados++;
        if (c.confianca >= 0.9) { p.erradosConfiantes++; console.log(`CONFIANTE: A${i + 1} ${k} lido ${c.valor} esperado ${esperado} conf ${c.confianca} :: ${(c as { origem?: string }).origem}`); }
      }
    });
  }
  return p;
}

describe('robustez do OCR do laudo em tabela', () => {
  for (const [passadas, taxa] of [[1, 0.25], [2, 0.25], [3, 0.15], [4, 0.1]] as const) {
    it(`${passadas} de 4 leituras estragadas (${taxa * 100}% dos números): nenhum erro sai com confiança alta`, () => {
      const p = medir(passadas, taxa, Number(process.env.FUZZ_RODADAS ?? 200), Number(process.env.FUZZ_SEMENTE ?? 1000) + passadas);
      console.log(`${passadas}/4 leituras, ${taxa * 100}%: ${p.certos} certos, ${p.errados} errados (${p.erradosConfiantes} CONFIANTES), ${p.ausentes} ausentes de ${p.tentativas}`);
      expect(p.erradosConfiantes).toBe(0);
    });
  }

  it('MESMO erro em todas as leituras (o OCR erra sempre igual): mede o que a votação não pega', () => {
    const rnd = gerador(77);
    let total = 0, errados = 0, confiantes = 0, marcados = 0;
    const detalhes: string[] = [];
    for (let r = 0; r < Number(process.env.FUZZ_RODADAS ?? 200); r++) {
      // uma única leitura estragada, repetida nas 4 passadas: as leituras concordam entre si, então só a aritmética do laudo pode denunciar
      const unica = estragar(OCR_AGUA_LIMPA[0]!, 0.04, gerador(Math.floor(rnd() * 1e9)));
      const e = extrairDeLeiturasOcr([unica, unica, unica, unica]);
      (e.amostras ?? []).forEach((a, i) => {
        const v = VERDADE_AGUA_LIMPA[i] as Record<string, number> | undefined;
        if (!v) return;
        for (const [k, esperado] of Object.entries(v)) {
          const c = (a.campos as Record<string, { valor: number | null; confianca: number; origem?: string } | undefined>)[k];
          total++;
          if (!c || c.valor === null || Math.abs(c.valor - esperado) < 0.006) continue;
          errados++;
          if (c.confianca >= 0.9) { confiantes++; if (detalhes.length < 12) detalhes.push(`A${i + 1} ${k}: lido ${c.valor} esperado ${esperado} :: ${c.origem}`); } else marcados++;
        }
      });
    }
    console.log(`erro IGUAL nas 4 leituras: ${errados} errados de ${total}: ${marcados} marcados para conferência, ${confiantes} sem marca\n${detalhes.join('\n')}`);
  });
});

describe('leituras reais, sem estrago', () => {
  it('42 de 42 valores certos, nenhum errado, e poucos marcados à toa', () => {
    const e = extrairDeLeiturasOcr(OCR_AGUA_LIMPA);
    let certos = 0, marcados = 0;
    (e.amostras ?? []).forEach((a, i) => {
      for (const [k, esperado] of Object.entries(VERDADE_AGUA_LIMPA[i] as Record<string, number>)) {
        const c = (a.campos as Record<string, { valor: number | null; confianca: number }>)[k];
        expect(c?.valor, `A${i + 1} ${k}`).toBeCloseTo(esperado, 2);
        certos++;
        if ((c?.confianca ?? 0) < 0.9) marcados++;
      }
    });
    console.log(`reais: ${certos} certos, ${marcados} marcados para conferência`);
    expect(certos).toBe(42);
    expect(marcados).toBeLessThanOrEqual(10);
  });
});
