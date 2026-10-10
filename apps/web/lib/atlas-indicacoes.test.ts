import { describe, expect, it } from 'vitest';
import { chaveDaIndicacao, lerReferenciaDeFicha, validarIndicacao } from './atlas-indicacoes';

const P = '22222222-2222-2222-2222-222222222222';
const F = '64aaaaaa-0000-0000-0000-000000000001';

describe('referência da ficha', () => {
  it('reconhece a ficha-base pelo slug e a do escritório pelo id', () => {
    expect(lerReferenciaDeFicha('broca-do-cafe')).toEqual({ tipo: 'base', slug: 'broca-do-cafe', nome: 'Broca-do-café' });
    expect(lerReferenciaDeFicha(` ${F.toUpperCase()} `)).toEqual({ tipo: 'escritorio', id: F });
  });
  it('recusa o que não é nem uma nem outra', () => {
    for (const ruim of ['', 'inventada', '../etc/passwd', 'broca-do-cafe/../x', '64aaaaaa-0000']) expect(lerReferenciaDeFicha(ruim), ruim).toBeNull();
  });
});

describe('validar a indicação', () => {
  it('completa passa e vem normalizada', () => {
    expect(validarIndicacao({ ficha: 'ferrugem-alaranjada', produtorId: P, mensagem: '  Veja antes da visita.  ', visitaId: '', analiseId: F })).toEqual({
      ok: true, ficha: { tipo: 'base', slug: 'ferrugem-alaranjada', nome: 'Ferrugem-alaranjada' }, produtorId: P, mensagem: 'Veja antes da visita.', visitaId: null, analiseId: F,
    });
    expect(validarIndicacao({ ficha: F, produtorId: P, mensagem: '' })).toMatchObject({ ok: true, mensagem: null });
  });
  it('explica o que falta ou está errado', () => {
    expect(validarIndicacao({ ficha: 'nao-existe', produtorId: P, mensagem: '' })).toEqual({ ok: false, erro: 'Ficha inválida.' });
    expect(validarIndicacao({ ficha: F, produtorId: '', mensagem: '' })).toEqual({ ok: false, erro: 'Escolha o produtor.' });
    expect(validarIndicacao({ ficha: F, produtorId: P, mensagem: 'x'.repeat(601) })).toEqual({ ok: false, erro: expect.stringContaining('600') });
    expect(validarIndicacao({ ficha: F, produtorId: P, mensagem: '', visitaId: 'lixo' })).toEqual({ ok: false, erro: 'Visita inválida.' });
    expect(validarIndicacao({ ficha: F, produtorId: P, mensagem: '', analiseId: 'lixo' })).toEqual({ ok: false, erro: 'Análise inválida.' });
  });
});

describe('chave da indicação', () => {
  it('usa o slug quando é ficha-base e o id quando é do escritório', () => {
    expect(chaveDaIndicacao({ ficha_slug: 'broca-do-cafe', ficha_id: null })).toBe('broca-do-cafe');
    expect(chaveDaIndicacao({ ficha_slug: null, ficha_id: F })).toBe(F);
  });
});
