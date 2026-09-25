import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Lê o ícone real da marca (public/logo-icone.png) como data URI — usado dentro de `ImageResponse` (favicon/apple-icon/PWA), onde um `<img src="/...">` relativo não é resolvido pelo Satori. */
export async function logoIconeDataUri(): Promise<string> {
  const buf = await readFile(join(process.cwd(), 'public/logo-icone.png'));
  return `data:image/png;base64,${buf.toString('base64')}`;
}
