import { describe, expect, it } from 'vitest';
import { extrairDeTexto } from '../src/parsers/extrair.js';

/**
 * Layouts horizontais como o pdf.js os devolve: uma linha de cabeçalho, uma de unidades e uma linha por amostra.
 * Os números fecham a aritmética de um laudo real (SB = Ca+Mg+K, CTC = SB+H+Al, V = SB/CTC).
 */

// estilo São Paulo (IAC/ESALQ): bases em mmolc/dm³, M.O. em g/dm³, P por resina, pH em CaCl₂
const SP = `
Laudo de Análise de Solo — Fertilidade
Cliente: Sítio Boa Esperança   Município: Mococa
Lab Amostra Prof pH M.O. P resina S K Ca Mg H+Al Al SB CTC V m
CaCl2 g/dm3 mg/dm3 mg/dm3 mmolc/dm3 mmolc/dm3 mmolc/dm3 mmolc/dm3 mmolc/dm3 mmolc/dm3 mmolc/dm3 % %
1234 Talhão 1 0-20 5,1 28 19 7 3,4 31 12 38 1 46,4 84,4 55 2
1235 Talhão 2 0-20 4,7 24 11 5 2,1 18 8 52 3 28,1 80,1 35 10
`;

// estilo Minas/Espírito Santo: K e Na em mg/dm³, bases em cmolc/dm³, M.O. em dag/kg, pH em água
const MG = `
Resultado da Análise de Solo
Amostra pH(H2O) P K Na Ca Mg Al H+Al SB t T V m MO
mg/dm3 mg/dm3 mg/dm3 cmolc/dm3 cmolc/dm3 cmolc/dm3 cmolc/dm3 cmolc/dm3 cmolc/dm3 cmolc/dm3 % % dag/kg
Talhão 3 5,2 6,4 85 2 2,3 0,8 0,2 4,1 3,32 3,52 7,42 45 6 2,3
`;

describe('laudo em tabela horizontal', () => {
  it('estilo SP: converte mmolc→cmolc, K carga→mg/dm³ e g/dm³→dag/kg, e a conta do laudo confirma', () => {
    const e = extrairDeTexto(SP);
    expect(e.perfil).toBe('tabela-horizontal');
    expect(e.amostras).toHaveLength(2);
    const a = e.amostras![0]!;
    expect(a.rotulo).toContain('Talhão 1'); // identificação preservada
    expect(a.campos.ph?.valor).toBeCloseTo(5.1, 6);
    expect(a.campos.mo?.valor).toBeCloseTo(2.8, 6); // 28 g/dm³
    expect(a.campos.p?.valor).toBe(19);
    expect(a.campos.k?.valor).toBeCloseTo(133, 0); // 3,4 mmolc × 39,1
    expect(a.campos.ca?.valor).toBeCloseTo(3.1, 6);
    expect(a.campos.mg?.valor).toBeCloseTo(1.2, 6);
    expect(a.campos.h_al?.valor).toBeCloseTo(3.8, 6);
    expect(a.campos.al?.valor).toBeCloseTo(0.1, 6);
    expect(a.campos.ca?.confianca).toBeGreaterThanOrEqual(0.95); // SB fecha
    expect(e.amostras![1]!.campos.ca?.valor).toBeCloseTo(1.8, 6);
    // o que o app interpreta com faixas de água/Mehlich vira aviso, não conversão silenciosa
    expect(e.avisos.join(' ')).toMatch(/CaCl/);
    expect(e.avisos.join(' ')).toMatch(/resina/i);
  });

  it('estilo MG: mantém K em mg/dm³ e as bases em cmolc/dm³', () => {
    const e = extrairDeTexto(MG);
    expect(e.perfil).toBe('tabela-horizontal');
    const a = e.amostras![0]!;
    expect(a.campos.ph?.valor).toBeCloseTo(5.2, 6);
    expect(a.campos.k?.valor).toBe(85);
    expect(a.campos.na?.valor).toBe(2);
    expect(a.campos.ca?.valor).toBeCloseTo(2.3, 6);
    expect(a.campos.mg?.valor).toBeCloseTo(0.8, 6);
    expect(a.campos.h_al?.valor).toBeCloseTo(4.1, 6);
    expect(a.campos.mo?.valor).toBeCloseTo(2.3, 6);
    expect(a.campos.k?.confianca).toBeGreaterThanOrEqual(0.95);
    expect(e.avisos).toEqual([]);
  });

  it('se a soma de bases impressa não fecha, nada é corrigido: confiança cai e vira aviso', () => {
    const errado = MG.replace('3,32 3,52 7,42', '5,90 3,52 7,42');
    const e = extrairDeTexto(errado);
    const a = e.amostras![0]!;
    expect(a.campos.ca?.valor).toBeCloseTo(2.3, 6); // mantém o que leu
    expect(a.campos.ca!.confianca).toBeLessThanOrEqual(0.7);
    expect(e.avisos.join(' ')).toMatch(/SB impresso/);
  });

  it('valor impossível é rejeitado, não "arrumado"', () => {
    const e = extrairDeTexto(MG.replace('Talhão 3 5,2', 'Talhão 3 52'));
    expect(e.amostras![0]!.campos.ph?.valor).toBeNull();
    expect(e.avisos.join(' ')).toMatch(/ph/i);
  });
});

describe('documentos que NÃO são laudo (trechos reais de publicações técnicas)', () => {
  const casos: Record<string, string> = {
    // tabela de métodos (Embrapa, capítulo 3 de "Recomendações de adubação e calagem")
    'tabela de métodos de análise': `
Atributos PAQLF Profert Rolas Cela IAC
pH H2O (1:2,5) H2O (1:2,5) H2O (1:2,5) H2O (1:2,5) CaCl2 0,01 mol/L
Al3+ KCl 1 mol/L KCl 1 mol/L KCl 1 mol/L KCl 1 mol/L KCl 1 mol/L
Ca2+ e Mg2+ KCl 1 mol/L KCl 1 mol/L KCl 1 mol/L KCl 1 mol/L Resina
P disponível Mehlich 1 Mehlich 1 Mehlich 1 Mehlich 1 Resina
K+ e Na+ Mehlich 1 Mehlich 1 Mehlich 1 Mehlich 1 Resina
Fe, Mn, Cu, Zn Mehlich 1 Mehlich 1 Mehlich 1 Mehlich 1 DTPA ou Resina
Análise de solo — extrator Mehlich, unidades em cmolc/dm3`,
    // tabela de classes de interpretação (SENAR)
    'tabela de interpretação de classes': `
Interpretação da análise de solo (Mehlich-1) — cmolc/dm3
Fósforo 60 2,0
Cobre 0,10 6,0
Manganês 1,0 50,0
Ferro 2,0 100,0
K+ ppm,mg/dm3 Mehlich-1, Resina
B ppm,mg/dm3 Água quente`,
    // texto corrido de artigo científico
    'artigo científico': `
Os teores de P, é de 1:10 (Silva et al., 1998). Entretanto, muitos autores
K) (Lajunem, 1991) que a fotometria de chama;
Na variaram de 3 a 54 mg dm-3. Para concentrações de Al3+ trocável
Análise Mehlich em cmolc/dm3 do solo`,
  };
  for (const [nome, texto] of Object.entries(casos)) {
    it(`rejeita ${nome}`, () => {
      const e = extrairDeTexto(texto);
      expect(e.perfil).toBeNull();
      expect(e.confianca_media).toBe(0);
      expect(Object.keys(e.campos)).toEqual([]);
    });
  }

  it('rejeita um livro inteiro (texto longo demais para ser um laudo)', () => {
    const livro = 'Fósforo ........ 12 mg/dm3 Mehlich cmolc/dm3\n'.repeat(3000);
    expect(extrairDeTexto(livro).perfil).toBeNull();
  });
});
