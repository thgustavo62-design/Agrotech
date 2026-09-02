import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Analise, Recomendacao } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { LaudoView, type ContextoLaudo } from '@/components/laudo-view';
import { BotaoImprimir } from '@/components/botao-imprimir';
import { emitirRecomendacao } from '../../acoes';

export const dynamic = 'force-dynamic';

type Resultado = Recomendacao & {
  contexto: ContextoLaudo;
  analise_valores: Record<string, unknown>;
};

export default async function LaudoAnalise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const { data: rec, error } = await sb
    .schema('agro')
    .from('recomendacoes')
    .select('id, emitida_em, resultado')
    .eq('analise_id', id)
    .order('emitida_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) notFound();

  if (!rec) {
    return (
      <>
        <div className="cabecalho-vista">
          <div><h1>Laudo</h1><p>Ainda não há laudo emitido para esta análise.</p></div>
          <div className="acoes"><Link className="btn sec" href={`/app/analises/${id}`}>Voltar</Link></div>
        </div>
        <div className="aviso" style={{ marginBottom: 14 }}>
          Emitir grava a recomendação com a versão do motor e o snapshot das tabelas. É essa versão
          que o produtor passa a ver e que dá defensabilidade técnica ao laudo.
        </div>
        <form action={emitirRecomendacao}>
          <input type="hidden" name="analise_id" value={id} />
          <button className="btn verde" type="submit">Emitir laudo</button>
        </form>
      </>
    );
  }

  const resultado = rec.resultado as Resultado;
  const ctx: ContextoLaudo = {
    ...resultado.contexto,
    dataColeta: dataBR(resultado.contexto.dataColeta),
    emitidaEm: dataBR(String(rec.emitida_em).slice(0, 10)),
  };

  return (
    <>
      <div className="cabecalho-vista nao-imprime">
        <div>
          <h1>Laudo</h1>
          <p>Emitido em {ctx.emitidaEm} · motor {resultado.motor_versao}. Imprima ou salve em PDF.</p>
        </div>
        <div className="acoes">
          <BotaoImprimir />
          <form action={emitirRecomendacao}>
            <input type="hidden" name="analise_id" value={id} />
            <button className="btn sec" type="submit">Reemitir</button>
          </form>
          <Link className="btn sec" href={`/app/analises/${id}`}>Voltar</Link>
        </div>
      </div>

      <LaudoView
        rec={resultado}
        analise={resultado.analise_valores as unknown as Analise}
        ctx={ctx}
      />
    </>
  );
}
