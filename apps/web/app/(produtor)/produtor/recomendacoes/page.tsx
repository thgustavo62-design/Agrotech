import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { CabecalhoVista, Cartao, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RecomendacoesProdutor() {
  const sb = await criarClienteServidor();

  const { data } = await sb
    .schema('agro')
    .from('recomendacoes')
    .select('id, emitida_em, analise:analise_id(talhao:talhao_id(nome, cultura))')
    .is('arquivada_em', null)
    .order('emitida_em', { ascending: false });

  const recomendacoes = (data ?? []) as unknown as Array<{
    id: string; emitida_em: string; analise: { talhao: { nome: string; cultura: string | null } | null } | null;
  }>;

  return (
    <>
      <CabecalhoVista
        olho="Sua lavoura"
        titulo="Recomendações"
        descricao="Toda recomendação que o seu técnico já emitiu, com o laudo completo."
      />

      <Cartao olho={`${recomendacoes.length} recomendação(ões)`} titulo="Histórico">
        {recomendacoes.length === 0 ? (
          <Vazio titulo="Nenhuma recomendação recebida ainda" />
        ) : (
          <div className="lista">
            {recomendacoes.map((r) => (
              <div className="item" key={r.id}>
                <div className="cresce">
                  <h3>{r.analise?.talhao?.nome ?? 'Talhão'}</h3>
                  <small>{nomeCultura(r.analise?.talhao?.cultura ?? null)} · emitida em {dataBR(r.emitida_em.slice(0, 10))}</small>
                </div>
                <Link className="btn sec mini" href={`/produtor/laudos/${r.id}`}>ver laudo</Link>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
