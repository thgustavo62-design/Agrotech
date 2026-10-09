import { describe, expect, it } from 'vitest';
import { lerPdfEscaneado } from './ocr-pdf';

/**
 * Prova de ponta a ponta do OCR de laudo escaneado (rasterizar → tesseract/WASM → leitor), com um PDF SINTÉTICO feito só de
 * imagem (como um escaneamento). Lento (~15 s) e depende de binário nativo, então só roda quando pedido:
 *   OCR_SMOKE=1 npx vitest run lib/ocr-pdf.test.ts
 * O CI roda no Linux — o mesmo sistema do deploy — para pegar "funciona no Windows e quebra na Vercel".
 */
const rodar = process.env.OCR_SMOKE === '1';

async function laudoEscaneadoSintetico(): Promise<Uint8Array> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const { PDFDocument } = await import('pdf-lib');
  const tela = createCanvas(1240, 1754);
  const g = tela.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, tela.width, tela.height);
  g.fillStyle = '#000';
  g.font = 'bold 40px sans-serif';
  g.fillText('Laboratório AgroSolo — Análise de Solo', 80, 120);
  g.font = '46px sans-serif';
  const linhas = [
    'Cliente: José A. Ferreira',
    'Propriedade: Fazenda Boa Esperança',
    '',
    'pH em água            5,4',
    'Matéria orgânica (dag/kg)       2,8',
    'Fósforo (mg/dm³)       9,6',
    'Potássio (mg/dm³)       96',
    'Cálcio (cmolc/dm³)       3,1',
    'Magnésio (cmolc/dm³)       1,2',
    'Alumínio (cmolc/dm³)       0,1',
    'H+Al (cmolc/dm³)       4,2',
  ];
  linhas.forEach((l, i) => g.fillText(l, 80, 230 + i * 84));
  const png = tela.toBuffer('image/png');

  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]);
  const img = await pdf.embedPng(png);
  pagina.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  return pdf.save();
}

describe.skipIf(!rodar)('OCR de laudo escaneado (ponta a ponta)', () => {
  it('lê os valores de um PDF só de imagem dentro do orçamento de tempo', async () => {
    const pdf = await laudoEscaneadoSintetico();
    const t0 = Date.now();
    const leituras = await lerPdfEscaneado(pdf, [2, 3], 30_000);
    const ms = Date.now() - t0;
    console.log(`OCR: ${leituras.length} leitura(s) em ${ms} ms`);
    expect(leituras.length).toBeGreaterThanOrEqual(1);
    expect(ms).toBeLessThan(55_000);

    // O que este teste prova é o MOTOR (rasterizar → tesseract/WASM + modelo de idioma → texto) rodando neste sistema.
    // A exatidão dos números em laudo real é coberta por agro-core/test/lote.test.ts (OCR real da Água Limpa); um
    // escaneamento sintético de baixa resolução perde vírgulas, então aqui só se confere o texto e os rótulos.
    const texto = leituras[0] ?? '';
    for (const rotulo of ['Laboratório', 'Cálcio', 'Magnésio', 'Potássio', 'cmolc']) expect(texto).toContain(rotulo);
  }, 120_000);

  it('com orçamento curto devolve pelo menos uma leitura em vez de estourar', async () => {
    const pdf = await laudoEscaneadoSintetico();
    const leituras = await lerPdfEscaneado(pdf, [2, 3, 4, 5], 1);
    expect(leituras.length).toBe(1);
  }, 120_000);
});
