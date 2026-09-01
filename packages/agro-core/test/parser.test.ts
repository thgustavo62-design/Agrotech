import { describe, it, expect } from 'vitest';
import { parseNumeroBR, norm } from '../src/parsers/numero.js';
import { extrairDeTexto } from '../src/parsers/extrair.js';
import { detectarPerfil } from '../src/parsers/perfis.js';
import { dentroDaFaixa } from '../src/parsers/sanidade.js';
import { interpretarResposta, CONFIANCA_MAX_LLM } from '../src/parsers/normalizar.js';
import {
  LAUDO_TEXTO_MEHLICH, LAUDO_TEXTO_K_CMOLC, LAUDO_TEXTO_ABSURDO,
} from './fixtures/casos.js';

describe('parseNumeroBR', () => {
  it('trata vírgula decimal e ponto de milhar', () => {
    expect(parseNumeroBR('4,52')).toBe(4.52);
    expect(parseNumeroBR('1.250')).toBe(1250);
    expect(parseNumeroBR('1.234,56')).toBe(1234.56);
    expect(parseNumeroBR('0.5')).toBe(0.5);
    expect(parseNumeroBR('12')).toBe(12);
    expect(parseNumeroBR('3,0 cmolc/dm³')).toBe(3);
  });

  it('devolve null para entrada sem número', () => {
    expect(parseNumeroBR('')).toBeNull();
    expect(parseNumeroBR('   ')).toBeNull();
    expect(parseNumeroBR('n/d')).toBeNull();
  });
});

describe('norm', () => {
  it('remove acentos e caixa', () => {
    expect(norm('Matéria Orgânica')).toBe('materia organica');
  });
});

describe('detectarPerfil', () => {
  it('reconhece o laudo Mehlich genérico', () => {
    expect(detectarPerfil(LAUDO_TEXTO_MEHLICH)?.id).toBe('generico-mehlich');
  });
  it('não força perfil quando a assinatura não bate', () => {
    expect(detectarPerfil('relatório qualquer sem assinatura de laboratório')).toBeNull();
  });
});

describe('extrairDeTexto', () => {
  it('extrai os parâmetros do laudo em texto', () => {
    const e = extrairDeTexto(LAUDO_TEXTO_MEHLICH);
    expect(e.perfil).toBe('generico-mehlich');
    expect(e.campos.ph?.valor).toBeCloseTo(4.8, 6);
    expect(e.campos.k?.valor).toBe(40);
    expect(e.campos.ca?.valor).toBeCloseTo(1.2, 6);
    expect(e.campos.h_al?.valor).toBeCloseTo(6.5, 6);
    expect(e.campos.argila?.valor).toBe(42);
    expect(e.confianca_media).toBeGreaterThan(0.9);
  });

  it('lê a identificação do cliente e da amostra', () => {
    const e = extrairDeTexto(LAUDO_TEXTO_MEHLICH);
    expect(e.identificacao.produtor).toBe('Fazenda Boa Vista');
    expect(e.identificacao.propriedade).toBe('Sítio Água Limpa');
    expect(e.identificacao.amostra).toMatch(/Talh[ãa]o 3/);
  });

  it('converte K de cmolc/dm³ e C.O. em M.O. (x1,724)', () => {
    const e = extrairDeTexto(LAUDO_TEXTO_K_CMOLC);
    expect(e.campos.k?.valor).toBeCloseTo(0.102 * 391, 1); // ~39,88
    expect(e.campos.mo?.valor).toBeCloseTo(1.1 * 1.724, 2); // ~1,90
  });

  it('rejeita valor fisicamente impossível em vez de "corrigir"', () => {
    const e = extrairDeTexto(LAUDO_TEXTO_ABSURDO);
    expect(e.campos.ph?.valor).toBeNull();
    expect(e.campos.ph?.confianca).toBe(0);
    expect(e.avisos.join(' ')).toMatch(/ph/i);
  });
});

describe('sanidade', () => {
  it('faixas fisicamente plausíveis', () => {
    expect(dentroDaFaixa('ph', 6)).toBe(true);
    expect(dentroDaFaixa('ph', 42)).toBe(false);
    expect(dentroDaFaixa('argila', 300)).toBe(false);
    expect(dentroDaFaixa('k', 5000)).toBe(false);
  });
});

describe('normalização por LLM', () => {
  it('nunca deixa a confiança passar de 0,65', () => {
    const campos = interpretarResposta('{"ph": 5.4, "k": 62, "ca": 2.1}');
    expect(CONFIANCA_MAX_LLM).toBe(0.65);
    expect(campos.ph?.confianca).toBe(0.65);
    expect(campos.k?.valor).toBe(62);
  });

  it('resposta não-JSON não produz campos', () => {
    expect(interpretarResposta('desculpe, não consegui')).toEqual({});
  });
});
