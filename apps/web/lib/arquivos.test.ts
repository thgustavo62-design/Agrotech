import { describe, expect, it } from 'vitest';
import { ehPdf, tipoDeImagem } from './arquivos';

const bytes = (...x: Array<number | string>) =>
  new Uint8Array(x.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe('ehPdf', () => {
  it('aceita cabeçalho de PDF e recusa o resto', () => {
    expect(ehPdf(bytes('%PDF-1.7\n...'))).toBe(true);
    expect(ehPdf(bytes('<html><body>oi</body></html>'))).toBe(false);
    expect(ehPdf(bytes('%PDF'))).toBe(false);
    expect(ehPdf(new Uint8Array())).toBe(false);
  });
});

describe('tipoDeImagem', () => {
  it('reconhece JPEG, PNG e WebP pelo conteúdo', () => {
    expect(tipoDeImagem(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('image/jpeg');
    expect(tipoDeImagem(bytes(0x89, 'PNG\r\n', 0x1a, 0x0a, 0, 0, 0, 0))).toBe('image/png');
    expect(tipoDeImagem(bytes('RIFF', 1, 2, 3, 4, 'WEBPVP8 '))).toBe('image/webp');
  });
  it('recusa script e HTML disfarçados de imagem, e SVG', () => {
    expect(tipoDeImagem(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(tipoDeImagem(bytes('<script>alert(1)</script>'))).toBeNull();
    expect(tipoDeImagem(bytes('GIF89a....'))).toBeNull();
    expect(tipoDeImagem(new Uint8Array())).toBeNull();
  });
});
