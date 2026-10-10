import { FICHAS, type FichaAtlas, type TipoFicha } from './atlas-base';

/** Minúsculas, sem acento, espaços colapsados — "ferrugem" acha "Ferrugem-alaranjada"; "folha" acha tudo que aparece na folha. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface FiltroAtlas { q?: string; tipo?: string }

const palheiro = (f: FichaAtlas) =>
  normalizar([f.nome, f.cientifico, ...(f.outrosNomes ?? []), ...f.partes, f.tipo === 'doenca' ? 'doenca' : 'praga', ...f.sobre].join(' '));

/** Todas as palavras digitadas precisam aparecer (no nome, nome científico, outros nomes, parte da planta ou texto). */
export function buscarFichas(f: FiltroAtlas, base: readonly FichaAtlas[] = FICHAS): FichaAtlas[] {
  const termo = normalizar(f.q ?? '');
  const tipo: TipoFicha | '' = f.tipo === 'doenca' || f.tipo === 'praga' ? f.tipo : '';
  const achadas = base.filter((x) => {
    if (tipo && x.tipo !== tipo) return false;
    if (!termo) return true;
    const p = palheiro(x);
    return termo.split(' ').every((w) => p.includes(w));
  });
  // com busca, quem tem o termo no NOME vem primeiro
  if (!termo) return achadas;
  const noNome = (x: FichaAtlas) => normalizar([x.nome, x.cientifico, ...(x.outrosNomes ?? [])].join(' ')).includes(termo) ? 0 : 1;
  return [...achadas].sort((a, b) => noNome(a) - noNome(b));
}

/**
 * Atalhos para procurar o termo nos sites públicos da Embrapa e do Incaper. Só abre a pesquisa em outra aba: o AgroTech não
 * consulta nem copia nada desses sites por trás.
 */
export function linksDePesquisa(termo: string): Array<{ rotulo: string; url: string }> {
  const t = termo.trim().slice(0, 120);
  if (!t) return [];
  const q = (dominio: string) => `https://www.google.com/search?q=${encodeURIComponent(`${t} café site:${dominio}`)}`;
  return [
    { rotulo: 'Procurar na Embrapa', url: q('embrapa.br') },
    { rotulo: 'Procurar no Incaper', url: q('incaper.es.gov.br') },
  ];
}

export const caminhoDaFicha = (slug: string) => `/academy/atlas/${slug}`;

/** Trecho que a equipe cola na resposta do Connect para apontar uma ficha. */
export function textoDaFicha(f: Pick<FichaAtlas, 'slug' | 'nome'>): string {
  return `Veja a ficha do Atlas sobre ${f.nome}: ${caminhoDaFicha(f.slug)}`;
}

/** Divide um texto em pedaços, separando os caminhos de ficha do Atlas (para a conversa mostrar como link). */
export function partirComFichas(texto: string): Array<{ tipo: 'texto'; valor: string } | { tipo: 'ficha'; slug: string; nome: string }> {
  const saida: Array<{ tipo: 'texto'; valor: string } | { tipo: 'ficha'; slug: string; nome: string }> = [];
  const re = /\/academy\/atlas\/([a-z0-9-]{3,60})/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const ficha = FICHAS.find((f) => f.slug === m[1]);
    if (!ficha) continue;
    const ini = m.index ?? 0;
    if (ini > ultimo) saida.push({ tipo: 'texto', valor: texto.slice(ultimo, ini) });
    saida.push({ tipo: 'ficha', slug: ficha.slug, nome: ficha.nome });
    ultimo = ini + m[0].length;
  }
  if (ultimo < texto.length) saida.push({ tipo: 'texto', valor: texto.slice(ultimo) });
  return saida;
}
