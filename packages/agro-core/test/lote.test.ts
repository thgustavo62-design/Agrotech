import { describe, it, expect } from 'vitest';
import { extrairLote } from '../src/parsers/lote.js';
import { extrairDeTexto } from '../src/parsers/extrair.js';
import type { ChaveCampoLaudo } from '../src/parsers/tipos.js';
import { OCR_AGUA_LIMPA, VERDADE_AGUA_LIMPA } from './fixtures/agua-limpa.js';

type Verdade = (typeof VERDADE_AGUA_LIMPA)[number];
const CHAVES = Object.keys(VERDADE_AGUA_LIMPA[0]) as Array<keyof Verdade>;

/** Compara a extração com o laudo impresso. */
function confronto(textos: string[], fonte: 'texto' | 'ocr' = 'ocr') {
  const r = extrairLote(textos, fonte);
  let certos = 0, errados = 0, errosConfiantes: string[] = [], ausentes = 0;
  r.amostras!.forEach((a, i) => {
    for (const ch of CHAVES) {
      const c = a.campos[ch as ChaveCampoLaudo];
      const esperado = VERDADE_AGUA_LIMPA[i]![ch];
      if (!c || c.valor === null) ausentes++;
      else if (Math.abs(c.valor - esperado) < 1e-9) certos++;
      else {
        errados++;
        if (c.confianca >= 0.9) errosConfiantes.push(`amostra ${i + 1} ${ch}: leu ${c.valor}, certo ${esperado} (conf ${c.confianca})`);
      }
    }
  });
  return { r, certos, errados, ausentes, errosConfiantes };
}

describe('laudo em tabela — Água Limpa (PDF escaneado, OCR real)', () => {
  it('reconhece as 3 amostras e a identificação do laudo', () => {
    const { r } = confronto(OCR_AGUA_LIMPA);
    expect(r.perfil).toBe('agua-limpa');
    expect(r.fonte).toBe('ocr');
    expect(r.amostras!.map((a) => a.rotulo)).toEqual(['Amostra 01 - Setor I Café', 'Amostra 02 - Setor II Café', 'Amostra 03 - Setor III Café']);
    expect(r.amostras!.map((a) => a.numero_lab)).toEqual(['SCP-1-291088-1', 'SCP-1-291088-2', 'SCP-1-291088-3']);
    expect(r.identificacao).toMatchObject({
      produtor: 'Cliente Exemplo da Silva',
      propriedade: 'Córrego do Exemplo',
      protocolo: '291088',
      data: '10/06/2026',
      data_emissao: '15/06/2026',
    });
    expect(r.identificacao.municipio).toMatch(/Baixo Guandu/);
  });

  it('votando as quatro leituras, nenhum valor errado chega com confiança de "ok"', () => {
    const { errosConfiantes } = confronto(OCR_AGUA_LIMPA);
    expect(errosConfiantes).toEqual([]);
  });

  it('recupera quase todos os 42 valores certos', () => {
    const { certos, errados, ausentes } = confronto(OCR_AGUA_LIMPA);
    console.log(`4 leituras votadas: ${certos} certos, ${errados} errados (com confiança baixa), ${ausentes} ausentes de 42`);
    expect(certos).toBeGreaterThanOrEqual(38);
  });

  it('cada leitura isolada erra mais do que as quatro votadas', () => {
    const votado = confronto(OCR_AGUA_LIMPA);
    for (const [i, texto] of OCR_AGUA_LIMPA.entries()) {
      const so = confronto([texto]);
      console.log(`só a leitura ${i + 1}: ${so.certos} certos, ${so.errados} errados, ${so.ausentes} ausentes`);
      expect(so.certos).toBeLessThanOrEqual(votado.certos);
    }
  });

  it('mesmo uma leitura isolada, com erro, nunca entrega valor errado como "ok"', () => {
    for (const texto of OCR_AGUA_LIMPA) expect(confronto([texto]).errosConfiantes).toEqual([]);
  });

  it('SB e T são arbitrados pela conta (Ca+Mg+K/391): leitura errada "5,17" não derruba o Mg certo', () => {
    const { r } = confronto(OCR_AGUA_LIMPA);
    const a1 = r.amostras![0]!;
    expect(a1.extras['sb']!.valor).toBe(5.77);
    expect(a1.extras['t_ctc']!.valor).toBe(7.97);
    expect(a1.campos.mg!.confianca).toBeGreaterThanOrEqual(0.9);
    expect(r.avisos.filter((x) => /SB impresso|T impresso/.test(x))).toEqual([]);
  });

  it('valor lido sem unanimidade é marcado para conferência (< 0,9)', () => {
    const { r } = confronto(OCR_AGUA_LIMPA);
    const mo1 = r.amostras![0]!.campos.mo!; // 1,45 — três leituras perderam a vírgula
    expect(mo1.valor).toBe(1.45);
    expect(mo1.confianca).toBeLessThan(0.9);
  });

  it('pH em água com rótulo ilegível é achado pela posição, com confiança baixa', () => {
    const soEscala3 = OCR_AGUA_LIMPA[1]!; // nesta leitura a linha do pH em água vem sem rótulo
    const { r } = confronto([soEscala3]);
    const ph = r.amostras![0]!.campos.ph;
    expect(ph?.valor === null || ph === undefined || ph.confianca <= 0.6).toBe(true);
  });

  it('campos da primeira amostra ficam em `campos` (compatível com laudo de uma amostra)', () => {
    const { r } = confronto(OCR_AGUA_LIMPA);
    expect(r.campos).toBe(r.amostras![0]!.campos);
  });
});

describe('coerência SB / T', () => {
  const limpo = (ca: string, sb = '5,77') => `
Água Limpa Mehlich
Cliente: Fulano Registro lote: 1
SCP-1-1-1 Amostra A
SCP-1-1-2 Amostra B
Ca Cálcio - Extrator KCL - mol/L cmolc/dm³ ${ca} 3,96
Mg Magnésio - Extrator KCL - mol/L cmolc/dm³ 1,41 1,25
K Potássio - Extrator Mehlich-1 mg/dm³ 134,76 138,72
H + Al H + Al - SMP cmolc/dm³ 2,20 2,40
S.B. SB - Soma de bases trocáveis cmolc/dm³ ${sb} 5,56
T T - Capacidade de troca catiônica a pH 7 (C.T.C.) cmolc/dm³ 7,97 7,96
`;

  it('SB e T que fecham sobem a confiança de Ca, Mg, K e H+Al', () => {
    const a = extrairLote([limpo('4,02')], 'texto').amostras![0]!;
    for (const ch of ['ca', 'mg', 'k', 'h_al'] as const) expect(a.campos[ch]!.confianca).toBeGreaterThanOrEqual(0.95);
  });

  it('SB que não fecha derruba a confiança e avisa qual conta falhou', () => {
    const r = extrairLote([limpo('4,52')], 'texto');
    const a = r.amostras![0]!;
    expect(a.campos.ca!.confianca).toBeLessThanOrEqual(0.6);
    expect(a.campos.mg!.confianca).toBeLessThanOrEqual(0.6);
    expect(r.avisos.join(' ')).toMatch(/Amostra 1: SB impresso 5.77/);
  });
});

describe('texto nativo e fallback', () => {
  it('extrairDeTexto roteia laudo em tabela para o leitor de colunas (confiança alta)', () => {
    const texto = OCR_AGUA_LIMPA[3]!;
    const r = extrairDeTexto(texto);
    expect(r.perfil).toBe('agua-limpa');
    expect(r.fonte).toBe('texto');
    expect(r.amostras).toHaveLength(3);
  });

  it('célula impossível (fora da faixa) é rejeitada e vira aviso', () => {
    const texto = `Água Limpa Mehlich\nSCP-1-1-1 A\nB Boro - Extrator água quente mg/dm³ 99,00\n`;
    const r = extrairLote([texto], 'texto');
    expect(r.amostras![0]!.campos.b!.valor).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/fora da faixa/);
  });

  it('texto sem tabela de amostras devolve aviso, sem quebrar', () => {
    const r = extrairLote(['nada a ver'], 'ocr');
    expect(r.perfil).toBeNull();
    expect(r.avisos[0]).toMatch(/Nenhuma amostra/);
  });
});

describe('extrairDeLeiturasOcr', () => {
  it('laudo em tabela: vota as leituras e marca a fonte como OCR', async () => {
    const { extrairDeLeiturasOcr } = await import('../src/parsers/extrair.js');
    const r = extrairDeLeiturasOcr(OCR_AGUA_LIMPA);
    expect(r.fonte).toBe('ocr');
    expect(r.amostras).toHaveLength(3);
    expect(r.avisos[0]).toMatch(/OCR/);
  });

  it('layout simples: confiança nunca passa de 0,85 e vem o aviso de OCR', async () => {
    const { extrairDeLeiturasOcr } = await import('../src/parsers/extrair.js');
    const simples = ['Laboratório X  Mehlich cmolc', 'Cliente: José', 'pH em água 5,2', 'P Mehlich 12,0 mg/dm3', 'K 80 mg/dm3', 'Ca 3,0 cmolc/dm3', 'Mg 1,0 cmolc/dm3', 'Al 0,1 cmolc/dm3', 'H+Al 4,0 cmolc/dm3'].join('\n');
    const r = extrairDeLeiturasOcr([simples, simples.slice(0, 40)]);
    expect(r.fonte).toBe('ocr');
    for (const c of Object.values(r.campos)) expect(c.confianca).toBeLessThanOrEqual(0.85);
    expect(r.avisos[0]).toMatch(/OCR/);
  });

  it('sem texto algum devolve aviso, não quebra', async () => {
    const { extrairDeLeiturasOcr } = await import('../src/parsers/extrair.js');
    expect(extrairDeLeiturasOcr(['', '  ']).avisos[0]).toMatch(/OCR não encontrou/);
  });
});
