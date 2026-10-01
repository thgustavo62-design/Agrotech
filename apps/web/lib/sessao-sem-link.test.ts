import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    if (nome === 'node_modules' || nome === '.next') return [];
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(tsx?|mjs)$/.test(nome) ? [caminho] : [];
  });
}

describe('logout', () => {
  it('nenhum <Link>/<a> aponta para rota que encerra a sessão (o Next pré-carrega e desloga sozinho)', () => {
    const culpados: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const f of arquivos(join(RAIZ, dir))) {
        if (/href=\{?["'`]\/(produtor\/)?sair/.test(readFileSync(f, 'utf8'))) culpados.push(f.replace(RAIZ, ''));
      }
    }
    expect(culpados).toEqual([]);
  });
});
