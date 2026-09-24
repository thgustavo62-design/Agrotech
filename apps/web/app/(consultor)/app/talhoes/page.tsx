import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { PADRAO } from '@agrotech/agro-core';
import { f } from '@/lib/formato';
import { Grade, Metrica, Tag, Vazio } from '@/components/ui';
import { BannerHero } from '@/components/banner-hero';
import { IconeTalhoes, IconePropriedades } from '@/components/icones';

export const dynamic = 'force-dynamic';

export default async function Talhoes() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('talhoes')
    .select('id, nome, cultura, variedade, area_ha, propriedade:propriedade_id(nome, produtor:produtor_id(nome))')
    .order('nome');

  const talhoes = data ?? [];
  const areaTotal = talhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const culturas = new Set(talhoes.map((t) => t.cultura).filter(Boolean)).size;

  return (
    <>
      <BannerHero
        olho="Unidades de manejo"
        titulo="Talhões"
        descricao="Cada talhão carrega cultura, área e produtividade esperada — é o que alimenta a recomendação. Cadastre pela página do produtor."
        tags={['Manejo', 'Produtividade', 'Solo']}
      />

      {talhoes.length > 0 && (
        <Grade cols={3} style={{ marginBottom: 14 }}>
          <Metrica rotulo="Talhões" valor={talhoes.length} icone={IconeTalhoes} />
          <Metrica rotulo="Área total" valor={`${f(areaTotal, 1)} ha`} icone={IconePropriedades} />
          <Metrica rotulo="Culturas" valor={culturas} />
        </Grade>
      )}

      {talhoes.length === 0 ? (
        <Vazio titulo="Nenhum talhão cadastrado">Cadastre um produtor primeiro.</Vazio>
      ) : (
        <div className="lista">
          {talhoes.map((t) => {
            const cult = t.cultura ? PADRAO.culturas[t.cultura as string] : undefined;
            // deno-lint-ignore no-explicit-any
            const prop = (t as any).propriedade;
            return (
              <div className="item" key={t.id as string}>
                <div className="cresce">
                  <h3><Link href={`/app/talhoes/${t.id}`}>{t.nome as string}</Link></h3>
                  <small>
                    {prop?.produtor?.nome ?? '—'} · {prop?.nome ?? '—'} · {f(Number(t.area_ha ?? 0), 1)} ha
                    {t.variedade ? ` · ${t.variedade}` : ''}
                  </small>
                </div>
                <Tag tom="cinza">{cult?.nome.split(' –')[0] ?? (t.cultura as string) ?? '—'}</Tag>
                <Link className="btn sec mini" href={`/app/talhoes/${t.id}/editar`}>editar</Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
