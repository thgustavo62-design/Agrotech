import { describe, expect, it } from 'vitest';
import { PADRAO } from '@agrotech/agro-core';
import { tabelasDeLinhas } from './tabelas-org';

describe('tabelasDeLinhas', () => {
  it('sem linhas devolve o padrão da literatura', () => {
    expect(tabelasDeLinhas([])).toBe(PADRAO);
  });

  it('usa o que o escritório calibrou e completa o resto com o padrão', () => {
    const fosforoAjustado = PADRAO.fosforo.map((x) => ({ ...x, q: [1, 2, 3, 4] as [number, number, number, number] }));
    const t = tabelasDeLinhas([{ tipo: 'fosforo', conteudo: fosforoAjustado }]);
    expect(t.fosforo[0]!.q).toEqual([1, 2, 3, 4]);
    expect(t.culturas).toBe(PADRAO.culturas);
    expect(t.faixas).toBe(PADRAO.faixas);
  });
});
