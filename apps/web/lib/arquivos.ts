/**
 * Confere o CONTEÚDO do arquivo, não o tipo que o navegador declarou (o `type` do File e
 * a extensão vêm do cliente e são triviais de forjar).
 */

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

const ASCII = (b: Uint8Array, de: number, txt: string) => [...txt].every((c, i) => b[de + i] === c.charCodeAt(0));

/** PDF começa com "%PDF-" (a especificação aceita lixo nos primeiros 1024 bytes; aceitamos só o caso normal). */
export function ehPdf(b: Uint8Array): boolean {
  return b.length > 5 && ASCII(b, 0, '%PDF-');
}

export type TipoImagem = 'image/jpeg' | 'image/png' | 'image/webp';

export function tipoDeImagem(b: Uint8Array): TipoImagem | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && ASCII(b, 1, 'PNG\r\n') && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length > 12 && ASCII(b, 0, 'RIFF') && ASCII(b, 8, 'WEBP')) return 'image/webp';
  return null;
}
