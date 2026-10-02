import { describe, expect, it } from 'vitest';
import { MATRIZ, ORDEM_PERFIS, PERFIS, TODAS_PERMISSOES, perfisOuPadrao, perfisValidos, pode, rotuloDosPerfis } from './permissoes';

describe('pode', () => {
  it('proprietário pode tudo', () => {
    for (const p of TODAS_PERMISSOES) expect(pode(['proprietario'], p), p).toBe(true);
  });

  it('sem perfil não pode nada', () => {
    for (const p of TODAS_PERMISSOES) expect(pode([], p), p).toBe(false);
    expect(pode(null, 'financeiro')).toBe(false);
  });

  it('cada perfil faz o que a descrição diz — e só isso', () => {
    expect(pode(['agronomico'], 'recomendacao.emitir')).toBe(true);
    expect(pode(['agronomico'], 'financeiro')).toBe(false);
    expect(pode(['agronomico'], 'equipe.gerenciar')).toBe(false);
    expect(pode(['campo'], 'carteira.editar')).toBe(true);
    expect(pode(['campo'], 'recomendacao.emitir')).toBe(false);
    expect(pode(['campo'], 'tabelas.editar')).toBe(false);
    expect(pode(['financeiro'], 'financeiro')).toBe(true);
    expect(pode(['financeiro'], 'carteira.editar')).toBe(false);
    expect(pode(['financeiro'], 'relatorios.ver')).toBe(true);
    expect(pode(['leitura'], 'relatorios.ver')).toBe(true);
    for (const p of TODAS_PERMISSOES.filter((x) => x !== 'relatorios.ver')) expect(pode(['leitura'], p), p).toBe(false);
  });

  it('perfis se somam (como no Aegro)', () => {
    expect(pode(['campo', 'financeiro'], 'carteira.editar')).toBe(true);
    expect(pode(['campo', 'financeiro'], 'financeiro')).toBe(true);
    expect(pode(['campo', 'financeiro'], 'recomendacao.emitir')).toBe(false);
  });

  it('só o proprietário administra: equipe, plano, escritório e exclusão', () => {
    for (const p of ['equipe.gerenciar', 'plano.gerenciar', 'escritorio.editar', 'dados.excluir'] as const) {
      for (const id of ORDEM_PERFIS.filter((x) => x !== 'proprietario')) expect(pode([id], p), `${id} ${p}`).toBe(false);
    }
  });

  it('ignora valor desconhecido (não vira acesso)', () => {
    expect(pode(['admin', 'root', '' as string], 'carteira.editar')).toBe(false);
  });
});

describe('perfisValidos / perfisOuPadrao / rotulo', () => {
  it('limpa, tira repetição e ordena', () => {
    expect(perfisValidos(['campo', 'x', 'campo', 'agronomico'])).toEqual(['agronomico', 'campo']);
    expect(perfisValidos('campo')).toEqual([]);
  });
  it('convite sem perfil vira Consulta (menor privilégio)', () => {
    expect(perfisOuPadrao([])).toEqual(['leitura']);
    expect(perfisOuPadrao(['lixo'])).toEqual(['leitura']);
    expect(perfisOuPadrao(['campo'])).toEqual(['campo']);
  });
  it('rótulo legível', () => {
    expect(rotuloDosPerfis(['campo', 'agronomico'])).toBe('Agronômico + Campo');
    expect(rotuloDosPerfis([])).toBe('Sem perfil');
  });
});

describe('dados de apresentação', () => {
  it('todo perfil tem descrição com "pode" e a matriz cobre todas as permissões', () => {
    for (const id of ORDEM_PERFIS) expect(PERFIS[id].pode.length, id).toBeGreaterThan(0);
    const naMatriz = MATRIZ.flatMap((g) => g.itens.map((i) => i.permissao)).sort();
    expect(naMatriz).toEqual([...TODAS_PERMISSOES].sort());
  });
});
