import { describe, expect, it } from 'vitest';
import { campoExigeConferencia, pendenciasDeConferencia, type Extracao } from './laudo-conferencia';

const campo = (valor: number | null, confianca: number) => ({ valor, confianca, origem: 'teste' });
const extracao = (campos: Extracao['campos'], amostras?: Extracao['amostras']): Extracao => ({
  perfil: null, laboratorio: null, fonte: 'ocr', campos, amostras, identificacao: {}, confianca_media: 0.8, avisos: [],
});

describe('trava de conferência do laudo', () => {
  it('só exige conferir o que está abaixo de 90% e tem valor', () => {
    expect(campoExigeConferencia(campo(3.1, 0.95))).toBe(false);
    expect(campoExigeConferencia(campo(3.1, 0.9))).toBe(false);
    expect(campoExigeConferencia(campo(3.1, 0.75))).toBe(true);
    expect(campoExigeConferencia(campo(null, 0))).toBe(false); // não achou: o formulário essencial já exige digitar
    expect(campoExigeConferencia(undefined)).toBe(false);
  });

  it('campo duvidoso sem correção e sem "conferi" fica pendente', () => {
    const e = extracao({ ca: campo(3.1, 0.7), mg: campo(1.2, 0.95), k: campo(96, 0.6) });
    expect(pendenciasDeConferencia(e, null, { ca: 3.1, mg: 1.2, k: 96 }, new Set())).toEqual(['K', 'Ca']); // na ordem do formulário
  });

  it('marcar "conferi" ou corrigir o número resolve a pendência', () => {
    const e = extracao({ ca: campo(3.1, 0.7), k: campo(96, 0.6) });
    expect(pendenciasDeConferencia(e, null, { ca: 3.1, k: 96 }, new Set(['ca', 'k']))).toEqual([]);
    expect(pendenciasDeConferencia(e, null, { ca: 3.4, k: 96 }, new Set(['k']))).toEqual([]); // corrigiu o Ca
    expect(pendenciasDeConferencia(e, null, { ca: null, k: 96 }, new Set(['k']))).toEqual([]); // apagou: decisão dele
    expect(pendenciasDeConferencia(e, null, { ca: 3.1, k: 96 }, new Set(['k']))).toEqual(['Ca']);
  });

  it('em laudo de várias amostras vale a confiança da amostra que está sendo confirmada', () => {
    const e = extracao({ ca: campo(3.1, 0.95) }, [
      { indice: 1, numero_lab: null, rotulo: null, campos: { ca: campo(3.1, 0.95) }, extras: {} },
      { indice: 2, numero_lab: null, rotulo: null, campos: { ca: campo(4.0, 0.6) }, extras: {} },
    ]);
    expect(pendenciasDeConferencia(e, 1, { ca: 3.1 }, new Set())).toEqual([]);
    expect(pendenciasDeConferencia(e, 2, { ca: 4.0 }, new Set())).toEqual(['Ca']);
  });

  it('sem extração (digitado à mão) não há o que conferir', () => {
    expect(pendenciasDeConferencia(null, null, { ca: 3 }, new Set())).toEqual([]);
  });
});
