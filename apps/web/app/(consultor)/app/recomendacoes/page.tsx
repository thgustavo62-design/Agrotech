import Link from 'next/link';
import { nomeCorretivo } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR, f } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { CabecalhoVista, Tag, Vazio } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Recomendacoes() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('recomendacoes')
    .select(`
      id, analise_id, emitida_em, motor_versao, resultado,
      produtor:produtor_id ( nome ),
      analise:analise_id ( talhao:talhao_id ( nome, cultura ) )
    `)
    .is('arquivada_em', null)
    .order('emitida_em', { ascending: false });

  const recomendacoes = data ?? [];

  return (
    <>
      <CabecalhoVista
        olho="Gestão técnica"
        titulo="Recomendações"
        descricao="Todas as recomendações emitidas, de todos os produtores e talhões — cada uma carrega a versão do motor e o snapshot das tabelas usadas."
      />
      {recomendacoes.length === 0 ? (
        <Vazio titulo="Nenhuma recomendação emitida ainda">
          Emita uma pela tela de interpretação de uma análise.
        </Vazio>
      ) : (
        <div className="lista">
          {recomendacoes.map((r) => {
            // deno-lint-ignore no-explicit-any
            const talhao = (r as any).analise?.talhao;
            // deno-lint-ignore no-explicit-any
            const produtor = (r as any).produtor;
            const res = r.resultado as Record<string, unknown>;
            const cal = res.calagem as { corrigido?: number } | undefined;
            const corretivo = res.corretivo as { corretivo?: string } | undefined;
            const ad = res.adubacao as { N?: number; P2O5?: number; K2O?: number } | undefined;
            return (
              <div className="item" key={r.id as string}>
                <div className="cresce">
                  <h3>{talhao?.nome ?? 'Talhão removido'} — {produtor?.nome ?? '—'}</h3>
                  <small className="mono">
                    {nomeCultura(talhao?.cultura ?? null)} · emitida em {dataBR(String(r.emitida_em).slice(0, 10))}
                    {cal?.corrigido != null ? ` · calcário ${f(cal.corrigido, 1)} t/ha` : ''}
                    {corretivo?.corretivo ? ` (${nomeCorretivo(corretivo.corretivo as never).toLowerCase()})` : ''}
                    {ad ? ` · N ${ad.N} P₂O₅ ${ad.P2O5} K₂O ${ad.K2O}` : ''}
                  </small>
                </div>
                <Tag tom="cinza">motor {r.motor_versao as string}</Tag>
                <Link className="btn sec mini" href={`/app/analises/${r.analise_id}/laudo`}>ver laudo</Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
