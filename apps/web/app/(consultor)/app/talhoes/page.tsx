import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { PADRAO } from '@agrotech/agro-core';
import { f } from '@/lib/formato';
import { CabecalhoVista, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Talhoes() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('talhoes')
    .select('id, nome, cultura, variedade, area_ha, propriedade:propriedade_id(nome, produtor:produtor_id(nome))')
    .order('nome');

  const talhoes = data ?? [];

  return (
    <>
      <CabecalhoVista
        olho="Unidades de manejo"
        titulo="Talhões"
        descricao="Cada talhão carrega cultura, área e produtividade esperada — é o que alimenta a recomendação. Cadastre pela página do produtor."
      />
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
                  <h3>{t.nome as string}</h3>
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
