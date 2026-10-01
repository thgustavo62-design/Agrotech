import { tmpdir } from 'node:os';

/** Resoluções da página usadas nas leituras. Cada uma erra dígitos diferentes; o parser vota. */
export const ESCALAS_OCR = [2, 3, 4, 5];
const MAX_PAGINAS = 2;

/**
 * OCR de PDF escaneado (sem texto nativo): rasteriza as primeiras páginas e lê cada
 * resolução com tesseract.js (idioma `por`). Devolve uma leitura por resolução, com as
 * páginas concatenadas — o parser (`extrairDeLeiturasOcr`) decide e vota.
 *
 * Só no servidor (Node). Depende de @napi-rs/canvas (binário nativo) e baixa o modelo
 * `por` na primeira execução (cache em tmpdir). ~4 s por resolução.
 */
export async function lerPdfEscaneado(pdf: Uint8Array, escalas: number[] = ESCALAS_OCR): Promise<string[]> {
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const { createWorker } = await import('tesseract.js');

  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const paginas = Math.min(doc.numPages, MAX_PAGINAS);
  const worker = await createWorker('por', 1, { cachePath: tmpdir() });
  const leituras: string[] = [];
  try {
    for (const escala of escalas) {
      let texto = '';
      for (let p = 1; p <= paginas; p++) {
        const png = await renderPageAsImage(doc, p, { canvasImport: () => import('@napi-rs/canvas'), scale: escala });
        const { data } = await worker.recognize(Buffer.from(png));
        texto += data.text + '\n';
      }
      leituras.push(texto);
    }
  } finally {
    await worker.terminate();
  }
  return leituras;
}
