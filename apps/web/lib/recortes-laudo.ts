import { norm } from '@agrotech/agro-core/parsers';

/**
 * Recortes do laudo escaneado: ao lado de cada valor extraído, o trecho da IMAGEM do laudo de onde ele veio (o rótulo da
 * linha + o número ampliado e circulado). O técnico compara o que está impresso com o que o OCR leu sem procurar no PDF,
 * que é onde a conferência humana falha. Este arquivo tem só a parte pura (achar a linha e a palavra); a montagem da
 * imagem (canvas, só no servidor) fica em `recortes-imagem.ts`.
 */

export interface Caixa { x0: number; y0: number; x1: number; y1: number }
export interface PalavraOcr { texto: string; caixa: Caixa }
export interface LinhaOcr { texto: string; caixa: Caixa; palavras: PalavraOcr[] }

const SO_NUMERO = /^\d[\d.,]*$/;
const limpo = (t: string) => t.replace(/[^0-9.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
const digitos = (t: string) => t.replace(/\D/g, '');

/** Palavras da linha que parecem número, da esquerda para a direita. */
export function palavrasNumericas(linha: LinhaOcr): PalavraOcr[] {
  return [...linha.palavras]
    .sort((a, b) => a.caixa.x0 - b.caixa.x0)
    .filter((p) => SO_NUMERO.test(limpo(p.texto)));
}

/**
 * A palavra da linha que traz o valor da amostra. Laudo em tabela (várias amostras em colunas): as últimas `colunas`
 * palavras numéricas são as amostras, na ordem. Linha comum: a palavra cujos dígitos batem com o valor lido; se o OCR
 * trocou algum dígito, a primeira palavra numérica (a que vem logo depois do rótulo).
 */
export function palavraDoValor(linha: LinhaOcr, valor: number | null, coluna: number, colunas: number): PalavraOcr | null {
  const nums = palavrasNumericas(linha);
  if (nums.length === 0) return null;
  if (colunas > 1) return nums.length >= colunas ? nums.slice(-colunas)[coluna] ?? null : null;
  if (valor !== null) {
    const alvo = digitos(String(valor));
    const igual = nums.find((p) => digitos(limpo(p.texto)) === alvo || digitos(limpo(p.texto)).replace(/0+$/, '') === alvo.replace(/0+$/, ''));
    if (igual) return igual;
  }
  return nums[0] ?? null;
}

export interface CampoParaRecorte { chave: string; valor: number | null; bruto?: string }

/**
 * A linha do OCR que originou o campo: pela linha impressa guardada na extração (`bruto`) quando existe; senão pelo
 * reconhecedor de linhas da tabela (`reconhecer(chave)` devolve a regex da linha, ou undefined).
 */
export function acharLinha(linhas: LinhaOcr[], campo: CampoParaRecorte, reconhecer: (chave: string) => RegExp | undefined): LinhaOcr | null {
  if (campo.bruto) {
    const alvo = norm(campo.bruto);
    const exata = linhas.find((l) => norm(l.texto) === alvo);
    if (exata) return exata;
    // a leitura que originou o campo pode ser outra resolução que a das posições: acha a linha mais parecida
    const palavras = new Set(alvo.split(/\s+/).filter(Boolean));
    let melhor: { l: LinhaOcr; nota: number } | null = null;
    for (const l of linhas) {
      const nota = [...palavras].filter((p) => norm(l.texto).split(/\s+/).includes(p)).length / Math.max(1, palavras.size);
      if (nota >= 0.6 && (!melhor || nota > melhor.nota)) melhor = { l, nota };
    }
    if (melhor) return melhor.l;
  }
  const re = reconhecer(campo.chave);
  return re ? linhas.find((l) => re.test(norm(l.texto))) ?? null : null;
}
