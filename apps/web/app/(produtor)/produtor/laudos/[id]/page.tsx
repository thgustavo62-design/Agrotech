import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Analise, Recomendacao } from '@agrotech/agro-core';
import { criarClienteServidor } from '@/lib/supabase/server';
import { dataBR } from '@/lib/formato';
import { LaudoView, type ContextoLaudo } from '@/components/laudo-view';
import { BotaoImprimir } from '@/components/botao-imprimir';

export const dynamic = 'force-dynamic';

type Resultado = Recomendacao & { contexto: ContextoLaudo; analise_valores: Record<string, unknown> };

export default async function LaudoProdutor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const { data: rec, error } = await sb
    .schema('agro')
    .from('recomendacoes')
    .select('id, emitida_em, resultado')
    .eq('id', id)
    .maybeSingle();

  if (error || !rec) notFound();

  const resultado = rec.resultado as Resultado;
  const ctx: ContextoLaudo = {
    ...resultado.contexto,
    dataColeta: dataBR(resultado.contexto.dataColeta),
    emitidaEm: dataBR(String(rec.emitida_em).slice(0, 10)),
  };

  return (
    <>
      <div className="cabecalho-vista nao-imprime">
        <div><h1>Laudo</h1><p>Emitido pelo seu técnico em {ctx.emitidaEm}.</p></div>
        <div className="acoes">
          <BotaoImprimir />
          <Link className="btn sec" href="/produtor">Voltar</Link>
        </div>
      </div>
      <LaudoView rec={resultado} analise={resultado.analise_valores as unknown as Analise} ctx={ctx} />
    </>
  );
}
