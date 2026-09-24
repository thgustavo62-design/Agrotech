/**
 * Converte o GeoJSON de agro.talhoes.geom (quando existir) num array de
 * [lat, lng] pro Leaflet. Nunca testado contra um geom real — nenhum
 * talhão da carteira tem contorno cadastrado ainda (campo existe desde
 * 0002, sempre ficou vazio). Defensivo de propósito: qualquer formato
 * inesperado cai em null em vez de quebrar a página.
 */
export function geomParaPoligono(geom: unknown): [number, number][] | null {
  try {
    const g = geom as { type?: string; coordinates?: unknown };
    if (g?.type !== 'Polygon') return null;
    const anel = (g.coordinates as number[][][])?.[0];
    if (!Array.isArray(anel) || anel.length < 3) return null;
    return anel.map(([lng, lat]) => [Number(lat), Number(lng)]);
  } catch {
    return null;
  }
}
