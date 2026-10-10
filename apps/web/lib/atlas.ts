import { FICHAS, type FichaAtlas, type TipoFicha } from './atlas-base';

/** Minúsculas, sem acento, espaços colapsados — "ferrugem" acha "Ferrugem-alaranjada"; "folha" acha tudo que aparece na folha. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface FiltroAtlas { q?: string; tipo?: string; parte?: string }

/** Onde o problema aparece na planta: as "trilhas" da tela (uma ficha pode estar em mais de uma). */
export const GRUPOS_DE_PARTE = [
  { id: 'folha', rotulo: 'Na folha', partes: ['folha'] },
  { id: 'fruto', rotulo: 'No fruto e na flor', partes: ['fruto', 'flor'] },
  { id: 'ramo', rotulo: 'No ramo e nos ponteiros', partes: ['ramo', 'ponteiro'] },
  { id: 'raiz', rotulo: 'Na raiz, no colo e no caule', partes: ['raiz', 'colo', 'caule'] },
  { id: 'muda', rotulo: 'Na muda (viveiro)', partes: ['muda'] },
] as const;
export type GrupoDeParte = (typeof GRUPOS_DE_PARTE)[number]['id'];

export const noGrupo = (f: Pick<FichaAtlas, 'partes'>, id: string): boolean => {
  const g = GRUPOS_DE_PARTE.find((x) => x.id === id);
  return Boolean(g) && f.partes.some((p) => (g!.partes as readonly string[]).includes(p));
};

const PESO_IMPORTANCIA: Record<string, number> = { extrema: 0, elevada: 1, alta: 1, media: 2, moderada: 2, baixa: 3, rara: 4, nula: 5, baixissima: 5 };
/** 0 = a mais importante no campo (ordem das "mais importantes"). */
export const pesoDaImportancia = (f: Pick<FichaAtlas, 'importancia'>): number => PESO_IMPORTANCIA[normalizar(f.importancia.campo)] ?? 9;

/** As fichas de maior importância no campo (extrema, depois elevada/alta), primeiro as doenças. */
export function maisImportantes(base: readonly FichaAtlas[] = FICHAS, limite = 8): FichaAtlas[] {
  return [...base].filter((f) => pesoDaImportancia(f) <= 1).sort((a, b) => pesoDaImportancia(a) - pesoDaImportancia(b) || (a.tipo === b.tipo ? 0 : a.tipo === 'doenca' ? -1 : 1)).slice(0, limite);
}

/** Fichas parecidas: mesmo tipo e alguma parte em comum, as de maior importância primeiro. */
export function fichasParecidas(f: FichaAtlas, base: readonly FichaAtlas[] = FICHAS, limite = 4): FichaAtlas[] {
  return base
    .filter((x) => x.slug !== f.slug && x.tipo === f.tipo && x.partes.some((p) => f.partes.includes(p)))
    .sort((a, b) => pesoDaImportancia(a) - pesoDaImportancia(b))
    .slice(0, limite);
}

const palheiro = (f: FichaAtlas) =>
  normalizar([f.nome, f.cientifico, ...(f.outrosNomes ?? []), ...f.partes, f.tipo === 'doenca' ? 'doenca' : 'praga', ...f.sobre].join(' '));

/** Todas as palavras digitadas precisam aparecer (no nome, nome científico, outros nomes, parte da planta ou texto). */
export function buscarFichas(f: FiltroAtlas, base: readonly FichaAtlas[] = FICHAS): FichaAtlas[] {
  const termo = normalizar(f.q ?? '');
  const tipo: TipoFicha | '' = f.tipo === 'doenca' || f.tipo === 'praga' ? f.tipo : '';
  const parte = GRUPOS_DE_PARTE.some((g) => g.id === f.parte) ? (f.parte as string) : '';
  const achadas = base.filter((x) => {
    if (tipo && x.tipo !== tipo) return false;
    if (parte && !noGrupo(x, parte)) return false;
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

const UUID_EM_TEXTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMINHO_DE_FICHA = /\/academy\/atlas\/([a-z0-9-]{3,60})(?![a-z0-9-])/gi;

/** Ids de fichas do escritório citados num texto (para a tela buscar os nomes). */
export function idsDeFichasNoTexto(texto: string): string[] {
  const ids = new Set<string>();
  for (const m of texto.matchAll(CAMINHO_DE_FICHA)) if (UUID_EM_TEXTO.test(m[1]!)) ids.add(m[1]!.toLowerCase());
  return [...ids];
}

/**
 * Divide um texto em pedaços, separando os caminhos de ficha do Atlas (para a conversa mostrar como link). Fichas-base são
 * reconhecidas pelo slug; as do escritório, pelo id, e só viram link se o nome estiver em `extras` (a RLS já decidiu se a pessoa vê).
 */
export function partirComFichas(
  texto: string,
  extras: ReadonlyMap<string, string> = new Map(),
): Array<{ tipo: 'texto'; valor: string } | { tipo: 'ficha'; slug: string; nome: string }> {
  const saida: Array<{ tipo: 'texto'; valor: string } | { tipo: 'ficha'; slug: string; nome: string }> = [];
  let ultimo = 0;
  for (const m of texto.matchAll(CAMINHO_DE_FICHA)) {
    const ficha = FICHAS.find((f) => f.slug === m[1]);
    const nomeExtra = ficha ? undefined : extras.get(m[1]!.toLowerCase());
    if (!ficha && !nomeExtra) continue;
    const ini = m.index ?? 0;
    if (ini > ultimo) saida.push({ tipo: 'texto', valor: texto.slice(ultimo, ini) });
    saida.push({ tipo: 'ficha', slug: ficha ? ficha.slug : m[1]!.toLowerCase(), nome: ficha ? ficha.nome : nomeExtra! });
    ultimo = ini + m[0].length;
  }
  if (ultimo < texto.length) saida.push({ tipo: 'texto', valor: texto.slice(ultimo) });
  return saida;
}
