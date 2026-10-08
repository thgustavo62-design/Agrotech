import { describe, expect, it } from 'vitest';
import { identidadeDoLaudo } from './identidade-laudo';

describe('identidadeDoLaudo', () => {
  it('usa o escritório de quem emite, nunca um nome fixo', () => {
    const r = identidadeDoLaudo({ nome: 'Maria Souza', crea: 'ES-12345', fone: '27 99999-0000' }, { nome: 'Agro Norte', municipio: 'Colatina', uf: 'es' });
    expect(r).toEqual({ ok: true, consultor: { nome: 'Maria Souza', crea: 'ES-12345', fone: '27 99999-0000', empresa: 'Agro Norte · Colatina/ES' } });
    const outro = identidadeDoLaudo({ nome: 'João', crea: 'MG-1' }, { nome: 'Terra Viva' });
    expect(outro.ok && outro.consultor.empresa).toBe('Terra Viva');
    expect(JSON.stringify([r, outro])).not.toMatch(/Campo Forte/);
  });

  it('sem CREA ou sem nome não emite, e diz onde corrigir', () => {
    for (const resp of [{ nome: 'Maria', crea: '' }, { nome: 'Maria', crea: '   ' }, { nome: 'Maria', crea: null }, { nome: '', crea: 'ES-1' }]) {
      const r = identidadeDoLaudo(resp, { nome: 'Agro Norte' });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.mensagem).toMatch(/Meu perfil/);
      expect(!r.ok && r.mensagem.length).toBeLessThanOrEqual(300);
    }
    expect(identidadeDoLaudo({ nome: 'Maria', crea: 'ES-1' }, { nome: '' })).toMatchObject({ ok: false });
  });
});
