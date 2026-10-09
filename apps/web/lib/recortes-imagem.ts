import { LINHAS } from '@agrotech/agro-core/parsers';
import { acharLinha, palavraDoValor, palavrasNumericas, type Caixa, type LinhaOcr } from './recortes-laudo';

/** Uma página do laudo já rasterizada, com as linhas que o OCR enxergou nela (coordenadas em pixels dessa imagem). */
export interface PaginaOcr { png: Uint8Array; linhas: LinhaOcr[] }

/** Só o que a conferência precisa de uma extração para saber o que recortar. */
interface ExtracaoParaRecorte {
  campos: Partial<Record<string, { valor: number | null; bruto?: string }>>;
  amostras?: Array<{ indice: number; campos: Partial<Record<string, { valor: number | null; bruto?: string }>> }>;
}

// Ampliação FIXA (não por altura de caixa, que o OCR varia): o dígito sai do mesmo tamanho em toda linha da mesma página.
const FATOR_ROTULO = 1.15;
const FATOR_VALOR = 2.3;
const LARGURA_ROTULO_MAX = 260;
const REGEX_DA_LINHA = (chave: string) => LINHAS.find((d) => d.chave === chave && d.analise)?.re;

/**
 * Monta, para cada campo de cada amostra, a imagem "rótulo da linha + número ampliado e circulado" (JPEG pequeno em data URL).
 * Chave: `${indice da amostra, ou 0 se o laudo tem uma só}:${campo}`. Nunca lança — recorte é ajuda, não pode derrubar a leitura.
 */
export async function montarRecortes(extracao: ExtracaoParaRecorte, paginas: PaginaOcr[]): Promise<Record<string, string>> {
  const saida: Record<string, string> = {};
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const imagens = await Promise.all(paginas.map((p) => loadImage(Buffer.from(p.png))));
    const colunas = extracao.amostras?.length ?? 1;
    const grupos = extracao.amostras && extracao.amostras.length > 0
      ? extracao.amostras.map((a, col) => ({ indice: a.indice, col, campos: a.campos }))
      : [{ indice: 0, col: 0, campos: extracao.campos }];

    for (const g of grupos) {
      for (const [chave, campo] of Object.entries(g.campos)) {
        if (!campo || campo.valor === null) continue;
        let achada: { linha: LinhaOcr; pagina: number } | null = null;
        for (let i = 0; i < paginas.length && !achada; i++) {
          const linha = acharLinha(paginas[i]!.linhas, { chave, valor: campo.valor, bruto: campo.bruto }, REGEX_DA_LINHA);
          if (linha) achada = { linha, pagina: i };
        }
        if (!achada) continue;
        const palavra = palavraDoValor(achada.linha, campo.valor, g.col, colunas);
        const img = imagens[achada.pagina]!;
        const rotulo = rotuloDaLinha(achada.linha, palavra ? palavra.caixa.x0 : null);
        const url = compor(createCanvas, img, rotulo, palavra?.caixa ?? null, img.width, img.height);
        if (url) saida[`${g.indice}:${chave}`] = url;
      }
    }
  } catch {
    /* sem recortes a conferência funciona igual, só sem a imagem ao lado */
  }
  return saida;
}

/** A parte da linha que é o nome do parâmetro: da borda esquerda até o primeiro número (no máximo 55% da linha). */
function rotuloDaLinha(linha: LinhaOcr, xPrimeiroValor: number | null): Caixa {
  const { x0, y0, x1, y1 } = linha.caixa;
  const primeiroNumero = palavrasNumericas(linha)[0]?.caixa.x0;
  const corte = Math.min(primeiroNumero ?? xPrimeiroValor ?? x1, x0 + (x1 - x0) * 0.55);
  return { x0, y0, x1: Math.max(x0 + 40, corte - 4), y1 };
}

function compor(
  criar: typeof import('@napi-rs/canvas').createCanvas,
  img: import('@napi-rs/canvas').Image,
  rotulo: Caixa,
  valor: Caixa | null,
  largura: number,
  altura: number,
): string | null {
  const pad = 6;
  const sr = (c: Caixa): Caixa => ({ x0: Math.max(0, c.x0 - pad), y0: Math.max(0, c.y0 - pad), x1: Math.min(largura, c.x1 + pad), y1: Math.min(altura, c.y1 + pad) });
  const r = sr(rotulo);
  const v = valor ? sr(valor) : null;
  const hRotuloOrigem = r.y1 - r.y0;
  const hValorOrigem = v ? v.y1 - v.y0 : 0;
  if (Math.max(hRotuloOrigem, hValorOrigem) < 6) return null;
  // O número é o que se confere: ampliado; o rótulo é só referência (menor, e estreito).
  let fRotulo = FATOR_ROTULO;
  if ((r.x1 - r.x0) * fRotulo > LARGURA_ROTULO_MAX) fRotulo = LARGURA_ROTULO_MAX / (r.x1 - r.x0);
  const wR = Math.round((r.x1 - r.x0) * fRotulo);
  const hR = Math.round(hRotuloOrigem * fRotulo);
  const wV = v ? Math.round((v.x1 - v.x0) * FATOR_VALOR) : 0;
  const hV = v ? Math.round(hValorOrigem * FATOR_VALOR) : 0;
  const gap = v ? 12 : 0;
  const alturaTela = Math.max(hR, hV) + 4;
  const tela = criar(Math.max(60, wR + gap + wV), alturaTela);
  const g = tela.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, tela.width, tela.height);
  g.drawImage(img, r.x0, r.y0, r.x1 - r.x0, hRotuloOrigem, 0, Math.round((alturaTela - hR) / 2), wR, hR);
  if (v) {
    g.drawImage(img, v.x0, v.y0, v.x1 - v.x0, hValorOrigem, wR + gap, 2, wV, hV);
    g.strokeStyle = '#b4342a';
    g.lineWidth = 2;
    g.strokeRect(wR + gap + 1, 3, wV - 2, hV - 2);
  }
  return `data:image/jpeg;base64,${tela.toBuffer('image/jpeg', 78).toString('base64')}`;
}
