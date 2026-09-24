import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f } from '@/lib/formato';
import { geomParaPoligono } from '@/lib/geo';
import { Grade, Metrica, Vazio } from '@/components/ui';
import { BannerHero } from '@/components/banner-hero';
import { AbasPaineis, type Painel } from '@/components/abas-paineis';
import { MapaPropriedades } from '@/components/mapa-propriedades';
import { IconePropriedades, IconeTalhoes } from '@/components/icones';

export const dynamic = 'force-dynamic';

type Propriedade = {
  id: string; nome: string; municipio: string | null; area_total: number | null;
  lat: number | null; lng: number | null;
  produtor: { id: string; nome: string } | null;
  talhoes: Array<{ id: string; nome: string; area_ha: number | null; geom: unknown }>;
};

export default async function Propriedades() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('propriedades')
    .select('id, nome, municipio, area_total, lat, lng, produtor:produtor_id(id, nome), talhoes:talhoes(id, nome, area_ha, geom)')
    .order('nome');

  const propriedades = (data ?? []) as unknown as Propriedade[];
  const totalTalhoes = propriedades.reduce((s, p) => s + p.talhoes.length, 0);
  const comCoordenada = propriedades.filter((p) => p.lat != null && p.lng != null).length;

  const talhoesComContorno = propriedades
    .flatMap((p) => p.talhoes.map((t) => ({ id: t.id, nome: `${t.nome} — ${p.nome}`, poligono: geomParaPoligono(t.geom) })))
    .filter((t): t is { id: string; nome: string; poligono: [number, number][] } => t.poligono != null);

  const listaConteudo = propriedades.length === 0 ? (
    <Vazio titulo="Nenhuma propriedade cadastrada">Cadastre pela página de um produtor.</Vazio>
  ) : (
    <div className="lista">
      {propriedades.map((p) => {
        const areaTalhoes = p.talhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
        return (
          <div className="item" key={p.id}>
            <div className="cresce">
              <h3>{p.nome}</h3>
              <small>
                {p.produtor?.nome ?? '—'} · {p.municipio ?? 'município não informado'} ·{' '}
                {p.area_total ? `${f(Number(p.area_total), 1)} ha declarados` : `${f(areaTalhoes, 1)} ha em talhões`}
                {' '}· {p.talhoes.length} talhão(ões)
              </small>
            </div>
            {p.produtor ? <Link className="btn sec mini" href={`/app/produtores/${p.produtor.id}`}>abrir produtor</Link> : null}
          </div>
        );
      })}
    </div>
  );

  const paineis: Painel[] = [
    { id: 'lista', rotulo: 'Lista', conteudo: listaConteudo },
    {
      id: 'mapa',
      rotulo: 'Mapa',
      conteudo: (
        <MapaPropriedades
          propriedades={propriedades.map((p) => ({ id: p.id, nome: p.nome, lat: p.lat, lng: p.lng, produtorNome: p.produtor?.nome }))}
          talhoesComContorno={talhoesComContorno}
        />
      ),
    },
  ];

  return (
    <>
      <BannerHero
        olho="Gestão técnica"
        titulo="Propriedades"
        descricao="Todas as propriedades da carteira, de todos os produtores. Cadastro fica na página de cada produtor."
        tags={['Território', 'Localização', 'Carteira']}
      />

      {propriedades.length > 0 && (
        <Grade cols={3} style={{ marginBottom: 14 }}>
          <Metrica rotulo="Propriedades" valor={propriedades.length} icone={IconePropriedades} />
          <Metrica rotulo="Talhões" valor={totalTalhoes} icone={IconeTalhoes} />
          <Metrica rotulo="Com coordenada no mapa" valor={comCoordenada} detalhe={`de ${propriedades.length}`} />
        </Grade>
      )}

      <AbasPaineis paineis={paineis} />
    </>
  );
}
