import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';
import { PADRAO, clonarPadrao, gerarRecomendacao } from '@agrotech/agro-core';
import { renderizarLaudoPdf, fmt, dataBR, type ResultadoLaudo } from '../src/index.js';

const analise = {
  argila: '42', pH: '4,8', MO: '1,9', P: '4,0', K: '40', Na: '0', Ca: '1,2', Mg: '0,3',
  Al: '1,1', HAl: '6,5', S: '4', B: '0,2', Zn: '0,6', Cu: '0,8', Mn: '6', Fe: '30',
  prnt: '80', incorp: '20',
};
const cultura = PADRAO.culturas['cafe-conilon']!;

function resultado(sobre: Partial<ResultadoLaudo['contexto']> = {}): ResultadoLaudo {
  const rec = gerarRecomendacao(
    { analise, cultura, areaHa: 5, tabelas: clonarPadrao() },
    new Date('2026-09-01T12:00:00Z'),
  );
  return {
    ...rec,
    contexto: {
      produtor: 'José da Silva', propriedade: 'Sítio Boa Vista', municipio: 'Colatina', talhao: 'T1',
      variedade: 'Conilon Vitória', culturaNome: cultura.nome, culturaUn: cultura.un,
      culturaParc: cultura.parc, culturaObs: cultura.obs, dataColeta: '2026-08-20', profundidade: '0-20',
      laboratorio: 'Lab Solo',
      consultor: { nome: 'Maria Souza', crea: 'ES-12345', fone: '', empresa: 'Campo Forte' },
      ...sobre,
    },
    analise_valores: analise,
  };
}

async function textoDe(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

describe('renderizarLaudoPdf', () => {
  it('gera um PDF de verdade, A4', async () => {
    const bytes = await renderizarLaudoPdf(resultado(), '2026-09-01T12:00:00Z');
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  });

  it('o texto carrega o que foi emitido, sem recalcular', async () => {
    const res = resultado();
    const texto = await textoDe(await renderizarLaudoPdf(res, '2026-09-01T12:00:00Z'));
    expect(texto).toContain('Laudo de recomendação agronômica');
    expect(texto).toContain('José da Silva');
    expect(texto).toContain('Colatina');
    expect(texto).toContain('CREA ES-12345');
    expect(texto).toContain('01/09/2026');
    expect(texto).toContain(`motor ${res.motor_versao}`);
    expect(texto).toContain(fmt(res.calagem.corrigido, 2));
    for (const d of res.diagnostico.slice(0, 2)) expect(texto).toContain(d.txt.slice(0, 25));
  });

  it('subscritos viram dígitos (Helvetica não os codifica) e caractere estranho não derruba', async () => {
    const res = resultado({ produtor: 'Fazenda 日本 Ltda' });
    const texto = await textoDe(await renderizarLaudoPdf(res, '2026-09-01T12:00:00Z'));
    expect(texto).toContain('P2O5');
    expect(texto).toContain('K2O');
    expect(texto).toContain('Fazenda ?? Ltda');
  });

  it('paginação: observação enorme vai para páginas extras sem cortar', async () => {
    const res = resultado({ culturaObs: 'Manejo do cafezal. '.repeat(400) });
    const bytes = await renderizarLaudoPdf(res, '2026-09-01T12:00:00Z');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(await textoDe(bytes)).toContain(`página ${doc.getPageCount()}/${doc.getPageCount()}`);
  });
});

describe('formatação', () => {
  it('pt-BR sem ICU', () => {
    expect(fmt(1234.5, 1)).toBe('1.234,5');
    expect(fmt('4,8', 1)).toBe('4,8');
    // em branco é "não informado" (—); zero medido continua sendo 0
    expect(fmt(null, 2)).toBe('—');
    expect(fmt('', 1)).toBe('—');
    expect(fmt(undefined, 1)).toBe('—');
    expect(fmt(0, 2)).toBe('0,00');
    expect(fmt('0', 1)).toBe('0,0');
    expect(fmt(7, 0)).toBe('7');
    expect(dataBR('2026-09-01T12:00:00Z')).toBe('01/09/2026');
    expect(dataBR(null)).toBe('—');
  });
});
