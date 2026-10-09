import { describe, expect, it } from 'vitest';
import { extrairDeTexto } from '../src/parsers/extrair.js';

/**
 * Laudos "uma determinação por linha" de laboratórios que não são o perfil Mehlich/cmolc. Os textos são exatamente
 * o que o pdf.js devolve para PDFs gerados por `test/gerar-laudos-teste.mjs` (valores inventados).
 */
const ident = 'Cliente: José A. Ferreira\nPropriedade: Fazenda Boa Esperança\nTalhão: Gleba 3\nProfundidade: 0-20 cm';
const v = (t: string, k: keyof ReturnType<typeof extrairDeTexto>['campos']) => extrairDeTexto(t).campos[k]?.valor;

// estilo SP: resina, bases em mmolc/dm³, M.O. em g/dm³, pH em CaCl₂, SB impressa
const SP = `Laboratório AgroSolo — Análise Química de Solo\n${ident}
Parâmetro Unidade Resultado Interpretação
pH (CaCl2) 5,1 Médio
Matéria Orgânica g/dm³ 28 Médio
P resina mg/dm³ 14 Médio
K mmolc/dm³ 2,9 Médio
Ca mmolc/dm³ 31 Alto
Mg mmolc/dm³ 12 Alto
H+Al mmolc/dm³ 38 Médio
Al mmolc/dm³ 1 Baixo
Soma de Bases (SB) mmolc/dm³ 45,9
CTC mmolc/dm³ 83,9
V% % 55 Médio`;

// estilo MG: rótulo, resultado, unidade, faixa de referência; símbolo entre parênteses depois do nome
const MG = `Laudo de Análise de Solo — Mehlich-1\n${ident}
Determinação Resultado Unidade Faixa de referência
pH em água 5,4 5,0 - 6,0
Matéria orgânica 2,8 dag/kg 2,0 - 4,0
Fósforo (P-Mehlich) 9,6 mg/dm³ 12 - 18
Potássio (K) 96 mg/dm³ 60 - 120
Cálcio (Ca) 3,1 cmolc/dm³ 2,4 - 4,0
Magnésio (Mg) 1,2 cmolc/dm³ 0,9 - 1,5
Alumínio (Al) 0,1 cmolc/dm³ < 0,3
Acidez potencial (H+Al) 4,2 cmolc/dm³ 2,5 - 5,0
Soma de bases (SB) 4,55 cmolc/dm³
Saturação por bases (V) 52 % 50 - 70`;

// cmol(c)/dm³, K em carga, M.O. em g/kg, nenhuma palavra "Mehlich"
const CMOLC = `Resultado de Análise de Fertilidade do Solo\n${ident}
Análise Resultado Unidade Método
pH CaCl2 5,0 Potenciométrico
M.O. 31 g/kg Colorimétrico
P 11 mg/dm³ Resina
K 0,21 cmol(c)/dm³ Resina
Ca 3,4 cmol(c)/dm³ Resina
Mg 1,3 cmol(c)/dm³ Resina
Al 0,0 cmol(c)/dm³ KCl
H+Al 3,9 cmol(c)/dm³ SMP`;

const LISTA = `Análise de Solo\n${ident}
pH em água ........................ 5,6
M.O. (dag/kg) ..................... 3,1
P (mg/dm³) ........................ 14,2
K (mg/dm³) ........................ 88
Ca (cmolc/dm³) .................... 3,6
Mg (cmolc/dm³) .................... 1,1
Al (cmolc/dm³) .................... 0,0
H+Al (cmolc/dm³) .................. 3,8`;

describe('leitor por linha (laboratório fora dos perfis)', () => {
  it('estilo SP: converte mmolc→cmolc, K carga→mg/dm³, g/dm³→dag/kg e confere com a soma de bases', () => {
    const e = extrairDeTexto(SP);
    expect(e.perfil).toBe('linha-a-linha');
    expect(e.campos.ca?.valor).toBeCloseTo(3.1, 3);
    expect(e.campos.mg?.valor).toBeCloseTo(1.2, 3);
    expect(e.campos.h_al?.valor).toBeCloseTo(3.8, 3);
    expect(e.campos.al?.valor).toBeCloseTo(0.1, 3);
    expect(e.campos.k?.valor).toBeCloseTo(113.39, 1); // 2,9 mmolc × 39,1
    expect(e.campos.mo?.valor).toBeCloseTo(2.8, 3);
    expect(e.campos.p?.valor).toBe(14);
    expect(e.campos.ca?.origem).toMatch(/confere com a soma de bases/);
    expect(e.avisos.join(' ')).toMatch(/CaCl/);
    expect(e.avisos.join(' ')).toMatch(/resina/i);
    expect(e.identificacao.produtor).toBe('José A. Ferreira');
  });

  it('estilo MG: rótulo com símbolo entre parênteses e faixa de referência depois do valor', () => {
    const e = extrairDeTexto(MG);
    expect(e.perfil).toBe('linha-a-linha');
    expect(e.campos.ph?.valor).toBe(5.4);
    expect(e.campos.p?.valor).toBe(9.6);
    expect(e.campos.k?.valor).toBe(96);
    expect(e.campos.ca?.valor).toBe(3.1);
    expect(e.campos.h_al?.valor).toBe(4.2);
    expect(e.campos.al?.valor).toBe(0.1);
    expect(e.campos.mo?.valor).toBe(2.8);
  });

  it('cmol(c)/dm³ e K em carga: converte K para mg/dm³ e M.O. de g/kg para dag/kg', () => {
    expect(v(CMOLC, 'k')).toBeCloseTo(82.11, 1);
    expect(v(CMOLC, 'mo')).toBeCloseTo(3.1, 3);
    expect(v(CMOLC, 'ca')).toBe(3.4);
    expect(v(CMOLC, 'al')).toBe(0);
  });

  it('lista com guia pontilhada e a unidade entre parênteses', () => {
    const e = extrairDeTexto(LISTA);
    expect(e.perfil).toBe('linha-a-linha');
    expect(e.campos.p?.valor).toBe(14.2);
    expect(e.campos.mg?.valor).toBe(1.1);
    expect(e.campos.h_al?.valor).toBe(3.8);
  });

  it('"< 0,1" entra como 0 mas com confiança baixa e aviso', () => {
    const e = extrairDeTexto(MG.replace('Alumínio (Al) 0,1 cmolc/dm³ < 0,3', 'Alumínio (Al) < 0,1 cmolc/dm³'));
    expect(e.campos.al?.valor).toBe(0);
    expect(e.campos.al?.confianca).toBeLessThan(0.9);
    expect(e.avisos.join(' ')).toMatch(/Al|al/);
  });

  it('SB que não fecha com Ca+Mg+K derruba a confiança e avisa', () => {
    const e = extrairDeTexto(MG.replace('Soma de bases (SB) 4,55', 'Soma de bases (SB) 9,90'));
    expect(e.campos.ca?.confianca).toBeLessThanOrEqual(0.6);
    expect(e.avisos.join(' ')).toMatch(/SB impresso/);
  });

  it('valor impossível é rejeitado em vez de aceito', () => {
    const e = extrairDeTexto(MG.replace('Cálcio (Ca) 3,1 cmolc/dm³', 'Cálcio (Ca) 310 cmolc/dm³'));
    expect(e.campos.ca?.valor).toBeNull();
  });
});

describe('leitor por linha — o que NÃO é laudo continua recusado', () => {
  it('texto de guia/livro com os mesmos símbolos', () => {
    const guia = `Interpretação de resultados
O pH em água ideal fica entre 5,5 e 6,5. K é absorvido pela planta em 2003 conforme estudos.
Ca/Mg ideal 3,0 a 5,0 para a maioria das culturas.
P resina nas classes: baixo 7, médio 15 mg/dm³.
Al3+ trocável é extraído com KCl 1 mol/L, e Ca2+ e Mg2+ também.
Matéria orgânica de 2,5 dag/kg é considerada média.`;
    const e = extrairDeTexto(guia);
    expect(e.perfil).toBeNull();
  });

  it('tabela de classes de interpretação sem resultados de uma amostra', () => {
    const classes = `Classe de fertilidade\nCa (cmolc/dm³) baixo até 1,5\nMg (cmolc/dm³) baixo até 0,5\nK (mg/dm³) baixo até 40\nP (mg/dm³) baixo até 8`;
    expect(extrairDeTexto(classes).perfil).toBeNull();
  });

  it('livro longo repetindo linhas de laudo', () => {
    expect(extrairDeTexto(`${MG}\n`.repeat(400)).perfil).toBeNull();
  });

  it('poucos parâmetros', () => {
    expect(extrairDeTexto('Análise\npH em água 5,4\nCálcio (Ca) 3,1 cmolc/dm³\nMagnésio (Mg) 1,2 cmolc/dm³').perfil).toBeNull();
  });
});
