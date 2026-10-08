import { describe, expect, it } from 'vitest';
import { chaveDaFoto, classificarFotos, MAX_BYTES_FOTO, ocorrenciasDoForm } from './visita-itens';

const form = (campos: Record<string, string>) => new Map(Object.entries(campos)) as unknown as Pick<FormData, 'get'>;

describe('ocorrenciasDoForm', () => {
  it('a posição no formulário é a identidade (lacuna não desloca as outras)', () => {
    const r = ocorrenciasDoForm(form({ oc1_alvo: 'lagarta', oc1_valor: '3', oc3_alvo: 'ferrugem', oc3_acima: 'on' }));
    expect(r).toEqual([
      { indice: 1, alvo: 'lagarta', valor: '3', acima_nivel: false },
      { indice: 3, alvo: 'ferrugem', valor: null, acima_nivel: true },
    ]);
  });
  it('sem alvo não há ocorrência (valor solto é ignorado)', () => {
    expect(ocorrenciasDoForm(form({ oc2_valor: '5' }))).toEqual([]);
  });
});

describe('chaveDaFoto', () => {
  it('é a mesma em todo reenvio e diferente entre fotos', () => {
    const k = '8f2e3c1a-0000-4000-8000-000000000001';
    expect(chaveDaFoto(k, 0)).toBe(chaveDaFoto(k, 0));
    expect(new Set([0, 1, 2].map((i) => chaveDaFoto(k, i))).size).toBe(3);
  });
});

describe('classificarFotos', () => {
  it('descarta só o que nunca vai dar certo (excesso e arquivo grande); o resto segue', () => {
    const r = classificarFotos([100, MAX_BYTES_FOTO + 1, 100, 100, 100, 100, 100]);
    expect(r.map((x) => x.destino)).toEqual(['enviar', 'descartar', 'enviar', 'enviar', 'enviar', 'enviar', 'descartar']);
    expect(r[1]).toMatchObject({ motivo: 'arquivo maior que 8 MB' });
    expect(r[6]).toMatchObject({ motivo: expect.stringMatching(/limite de 6/) });
  });
});
