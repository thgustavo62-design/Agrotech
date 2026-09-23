import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { f } from '@/lib/formato';
import { CabecalhoVista, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Propriedades() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('propriedades')
    .select('id, nome, municipio, area_total, produtor:produtor_id(id, nome), talhoes:talhoes(id, area_ha)')
    .order('nome');

  const propriedades = data ?? [];

  return (
    <>
      <CabecalhoVista
        olho="Gestão técnica"
        titulo="Propriedades"
        descricao="Todas as propriedades da carteira, de todos os produtores. Cadastro fica na página de cada produtor."
      />
      {propriedades.length === 0 ? (
        <Vazio titulo="Nenhuma propriedade cadastrada">Cadastre pela página de um produtor.</Vazio>
      ) : (
        <div className="lista">
          {propriedades.map((p) => {
            // deno-lint-ignore no-explicit-any
            const produtor = (p as any).produtor;
            // deno-lint-ignore no-explicit-any
            const talhoes = ((p as any).talhoes ?? []) as Array<{ area_ha: number | null }>;
            const areaTalhoes = talhoes.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
            return (
              <div className="item" key={p.id as string}>
                <div className="cresce">
                  <h3>{p.nome as string}</h3>
                  <small>
                    {produtor?.nome ?? '—'} · {(p.municipio as string) ?? 'município não informado'} ·{' '}
                    {p.area_total ? `${f(Number(p.area_total), 1)} ha declarados` : `${f(areaTalhoes, 1)} ha em talhões`}
                    {' '}· {talhoes.length} talhão(ões)
                  </small>
                </div>
                {produtor ? <Link className="btn sec mini" href={`/app/produtores/${produtor.id}`}>abrir produtor</Link> : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
