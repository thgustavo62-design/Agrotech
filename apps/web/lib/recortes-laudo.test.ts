import { describe, expect, it } from 'vitest';
import { recortesDaAmostra } from './laudo-conferencia';
import { acharLinha, palavraDoValor, palavrasNumericas, type LinhaOcr } from './recortes-laudo';

const palavra = (texto: string, x0: number) => ({ texto, caixa: { x0, y0: 10, x1: x0 + 30, y1: 30 } });
const linha = (texto: string, palavras: ReturnType<typeof palavra>[]): LinhaOcr => ({ texto, caixa: { x0: 0, y0: 10, x1: 400, y1: 30 }, palavras });

// "Ca Cálcio - Extrator KCL - mol/L cmolc/dm³ 4,02 3,96 4,90"  (3 amostras em colunas)
const tabela = linha('Ca Cálcio - Extrator KCL - mol/L emole/dm? 4,02 3,96 490', [
  palavra('Ca', 0), palavra('Cálcio', 40), palavra('mol/L', 200), palavra('emole/dm?', 250),
  palavra('4,02', 300), palavra('3,96', 340), palavra('490', 380),
]);

describe('palavra do valor no recorte', () => {
  it('só considera números (unidade com lixo do OCR não entra)', () => {
    expect(palavrasNumericas(tabela).map((p) => p.texto)).toEqual(['4,02', '3,96', '490']);
  });

  it('laudo em tabela: as últimas N palavras numéricas são as amostras, na ordem', () => {
    expect(palavraDoValor(tabela, 3.96, 1, 3)?.texto).toBe('3,96');
    expect(palavraDoValor(tabela, 4.9, 2, 3)?.texto).toBe('490'); // o OCR perdeu a vírgula, mas o recorte mostra o impresso
    expect(palavraDoValor(tabela, 4.02, 0, 3)?.texto).toBe('4,02');
  });

  it('tabela com colunas ilegíveis (menos números que amostras): sem palavra, o recorte mostra a linha inteira', () => {
    const curta = linha('Ca Cálcio 4,02 3,96', [palavra('Ca', 0), palavra('4,02', 300), palavra('3,96', 340)]);
    expect(palavraDoValor(curta, 4.9, 2, 3)).toBeNull();
  });

  it('linha comum: acha a palavra pelos dígitos do valor; senão a primeira depois do rótulo', () => {
    const comum = linha('Cálcio (Ca) 3,1 cmolc/dm³ 2,4 - 4,0', [
      palavra('Cálcio', 0), palavra('(Ca)', 40), palavra('3,1', 80), palavra('cmolc/dm³', 120), palavra('2,4', 200), palavra('4,0', 240),
    ]);
    expect(palavraDoValor(comum, 3.1, 0, 1)?.texto).toBe('3,1');
    expect(palavraDoValor(comum, 3.4, 0, 1)?.texto).toBe('3,1'); // valor corrigido à mão: mostra o que está impresso
  });
});

describe('achar a linha de um campo', () => {
  const linhas = [linha('pH em água 5,4 5,0 - 6,0', []), tabela];
  const reconhecer = (chave: string) => (chave === 'ca' ? /calcio\s*-\s*extrator/ : undefined);

  it('pelo reconhecedor de linhas da tabela', () => {
    expect(acharLinha(linhas, { chave: 'ca', valor: 4.02 }, reconhecer)).toBe(tabela);
  });

  it('pela linha impressa guardada na extração, mesmo com leitura levemente diferente', () => {
    expect(acharLinha(linhas, { chave: 'ph', valor: 5.4, bruto: 'ph em agua 5,4 5,0 - 6,0' }, reconhecer)?.texto).toBe('pH em água 5,4 5,0 - 6,0');
    expect(acharLinha(linhas, { chave: 'ph', valor: 5.4, bruto: 'ph em agua 5,4 5,0 6,0' }, reconhecer)?.texto).toBe('pH em água 5,4 5,0 - 6,0');
  });

  it('sem linha correspondente, devolve null', () => {
    expect(acharLinha(linhas, { chave: 'zn', valor: 1 }, reconhecer)).toBeNull();
  });
});

describe('recortes por amostra', () => {
  const recortes = { '1:ca': 'data:a', '1:mg': 'data:b', '2:ca': 'data:c', '0:ph': 'data:d' };

  it('separa os recortes da amostra pedida e indexa pelo campo', () => {
    expect(recortesDaAmostra(recortes, 1)).toEqual({ ca: 'data:a', mg: 'data:b' });
    expect(recortesDaAmostra(recortes, 2)).toEqual({ ca: 'data:c' });
    expect(recortesDaAmostra(recortes, 0)).toEqual({ ph: 'data:d' });
  });

  it('laudo sem recortes (digital ou digitado) devolve vazio', () => {
    expect(recortesDaAmostra(undefined, 1)).toEqual({});
  });
});
