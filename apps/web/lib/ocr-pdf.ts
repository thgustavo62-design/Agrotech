import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LinhaOcr } from './recortes-laudo';
import type { PaginaOcr } from './recortes-imagem';

/** Resoluções da página usadas nas leituras, da mais útil para a menos. Cada uma erra dígitos diferentes; o parser vota. */
export const ESCALAS_OCR = [2, 3, 4, 5];
const MAX_PAGINAS = 2;
/**
 * A função do servidor morre em 60 s (maxDuration da página de envio) e uma leitura interrompida não deixa rastro.
 * Por isso o OCR trabalha com orçamento: só começa uma resolução nova se der tempo de ela terminar; o que já foi lido vale.
 */
export const ORCAMENTO_OCR_MS = 38_000;

/** Pasta com o modelo de idioma (apps/web/ocr/por.traineddata), embutido no deploy para não depender de download. */
function pastaDoModelo(): string | undefined {
  const candidatas = [join(process.cwd(), 'ocr'), join(process.cwd(), 'apps', 'web', 'ocr')];
  return candidatas.find((p) => existsSync(join(p, 'por.traineddata')));
}

/**
 * OCR de PDF escaneado (sem texto nativo): rasteriza as primeiras páginas e lê cada
 * resolução com tesseract.js (idioma `por`). Devolve uma leitura por resolução, com as
 * páginas concatenadas — o parser (`extrairDeLeiturasOcr`) decide e vota. Com pouco tempo, devolve só as que couberam
 * (pelo menos uma).
 *
 * Só no servidor (Node). Depende de @napi-rs/canvas (binário nativo) e dos arquivos de tesseract.js-core (WASM) —
 * ambos precisam estar no pacote publicado (`outputFileTracingIncludes` em next.config.mjs).
 */
export async function lerPdfEscaneado(pdf: Uint8Array, escalas: number[] = ESCALAS_OCR, orcamentoMs: number = ORCAMENTO_OCR_MS): Promise<string[]> {
  return (await lerPdfEscaneadoDetalhado(pdf, escalas, orcamentoMs)).leituras;
}

/** Como `lerPdfEscaneado`, e devolve também a imagem de cada página e as linhas/palavras com posição da PRIMEIRA leitura (para os recortes). */
export async function lerPdfEscaneadoDetalhado(
  pdf: Uint8Array,
  escalas: number[] = ESCALAS_OCR,
  orcamentoMs: number = ORCAMENTO_OCR_MS,
): Promise<{ leituras: string[]; paginas: PaginaOcr[] }> {
  const inicio = Date.now();
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const { createWorker } = await import('tesseract.js');

  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const paginas = Math.min(doc.numPages, MAX_PAGINAS);
  const modelo = pastaDoModelo();
  const worker = await createWorker('por', 1, modelo
    ? { langPath: modelo, gzip: false, cachePath: tmpdir() }
    : { cachePath: tmpdir() });
  const leituras: string[] = [];
  const paginasOcr: PaginaOcr[] = [];
  let maiorRodada = 0;
  try {
    for (const escala of escalas) {
      // a primeira sempre roda; as outras só se der tempo (com folga de 30% sobre a mais lenta até agora)
      if (leituras.length > 0 && Date.now() - inicio + maiorRodada * 1.3 > orcamentoMs) break;
      const t = Date.now();
      let texto = '';
      for (let p = 1; p <= paginas; p++) {
        const png = await renderPageAsImage(doc, p, { canvasImport: () => import('@napi-rs/canvas'), scale: escala });
        // só a primeira resolução pede as posições (linhas e palavras): é dela que saem os recortes da conferência
        const primeira = leituras.length === 0;
        const { data } = await worker.recognize(Buffer.from(png), {}, primeira ? { text: true, blocks: true } : { text: true });
        texto += data.text + '\n';
        if (primeira) paginasOcr.push({ png: new Uint8Array(png), linhas: linhasDe(data as DadosOcr) });
      }
      leituras.push(texto);
      maiorRodada = Math.max(maiorRodada, Date.now() - t);
    }
  } finally {
    await worker.terminate();
  }
  return { leituras, paginas: paginasOcr };
}

type DadosOcr = { blocks?: Array<{ paragraphs: Array<{ lines: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> }> }> | null };

/** Linhas com palavras e posição, como o tesseract devolve (blocos → parágrafos → linhas → palavras). */
function linhasDe(data: DadosOcr): LinhaOcr[] {
  const linhas: LinhaOcr[] = [];
  for (const b of data.blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        linhas.push({ texto: l.text.trim(), caixa: l.bbox, palavras: l.words.map((w) => ({ texto: w.text, caixa: w.bbox })) });
      }
    }
  }
  return linhas;
}
