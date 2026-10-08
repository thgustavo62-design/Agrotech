import { describe, expect, it } from 'vitest';
import { escolherSubsuperficie } from './subsuperficie';

const c = (data_coleta: string, id: string) => ({ data_coleta, id });

describe('escolherSubsuperficie', () => {
  it('pega a mais próxima da superficial, antes ou depois', () => {
    const lista = [c('2025-01-10', 'longe'), c('2026-02-01', 'perto'), c('2026-08-01', 'depois')];
    expect(escolherSubsuperficie(lista, '2026-03-01')?.id).toBe('perto');
  });
  it('ignora o que está fora de 24 meses e devolve null sem candidata', () => {
    expect(escolherSubsuperficie([c('2023-01-01', 'velha')], '2026-03-01')).toBeNull();
    expect(escolherSubsuperficie([], '2026-03-01')).toBeNull();
    expect(escolherSubsuperficie([c('2026-01-01', 'x')], 'lixo')).toBeNull();
  });
});
