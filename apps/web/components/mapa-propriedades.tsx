'use client';

import { MapContainer, TileLayer, Marker, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vazio } from '@/components/ui';

// Marcador próprio (losango da marca) em vez do pin padrão do Leaflet —
// evita o problema clássico de bundler com os ícones png default da lib.
const iconePropriedade = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#0f5c43;border:2px solid #fff;border-radius:3px;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export interface PropriedadeMapa {
  id: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  produtorNome?: string | null;
}
export interface TalhaoContorno {
  id: string;
  nome: string;
  poligono: [number, number][];
}

/**
 * Mapa das propriedades da carteira. Marcador usa propriedades.lat/lng (já
 * existe no schema desde 0002, nunca usado em UI antes). Contorno de
 * talhão (polígono) só aparece quando agro.talhoes.geom estiver preenchido
 * — hoje nenhum registro tem; a biblioteca já suporta, falta o dado.
 */
export function MapaPropriedades({
  propriedades, talhoesComContorno = [],
}: {
  propriedades: PropriedadeMapa[];
  talhoesComContorno?: TalhaoContorno[];
}) {
  const comCoordenada = propriedades.filter(
    (p): p is PropriedadeMapa & { lat: number; lng: number } => p.lat != null && p.lng != null,
  );

  if (comCoordenada.length === 0) {
    return (
      <Vazio titulo="Nenhuma propriedade com coordenada cadastrada">
        Latitude/longitude ficam no cadastro da propriedade — sem isso não dá pra mostrar no mapa.
      </Vazio>
    );
  }

  const centro: [number, number] = [
    comCoordenada.reduce((s, p) => s + p.lat, 0) / comCoordenada.length,
    comCoordenada.reduce((s, p) => s + p.lng, 0) / comCoordenada.length,
  ];

  return (
    <div style={{ height: 420, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--linha)' }}>
      <MapContainer center={centro} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {comCoordenada.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={iconePropriedade}>
            <Popup>
              <b>{p.nome}</b>
              {p.produtorNome ? <><br />{p.produtorNome}</> : null}
            </Popup>
          </Marker>
        ))}
        {talhoesComContorno.map((t) => (
          <Polygon key={t.id} positions={t.poligono} pathOptions={{ color: '#0f5c43', fillOpacity: 0.15 }}>
            <Popup>{t.nome}</Popup>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  );
}
