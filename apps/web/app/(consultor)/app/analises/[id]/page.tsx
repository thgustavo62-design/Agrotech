import { notFound } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { paraAnalise } from '@/lib/culturas';
import { dataBR } from '@/lib/formato';
import { validarAnalise, REGRAS } from '@agrotech/agro-core';
import { InterpretacaoView } from '@/components/interpretacao-view';
import { emitirRecomendacao } from '../acoes';

export const dynamic = 'force-dynamic';

export default async function PaginaAnalise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const [{ data, error }, tabelas] = await Promise.all([
    sb.schema('agro').from('analises').select(
      `id, data_coleta, profundidade, prnt, incorporacao, prod_esperada,
       argila, ph, mo, p, k, na, ca, mg, al, h_al, s, b, zn, cu, mn, fe,
       talhao:talhao_id (
         nome, cultura, area_ha, prod_esperada,
         propriedade:propriedade_id ( produtor:produtor_id ( nome ) )
       )`,
    ).eq('id', id).single(),
    tabelasDaOrg(sb),
  ]);

  if (error || !data) notFound();

  // deno-lint-ignore no-explicit-any
  const t = (data as any).talhao;
  const cultura = t?.cultura ? tabelas.culturas[t.cultura as string] : undefined;

  const valores = paraAnalise(data);
  const validacao = validarAnalise(valores);

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link className="btn sec mini" href="/app/analises">← Análises</Link>
        <form action={emitirRecomendacao}>
          <input type="hidden" name="analise_id" value={id} />
          <button className="btn verde mini" type="submit" disabled={!validacao.ok} title={validacao.ok ? undefined : 'Complete a análise para emitir'}>Emitir laudo</button>
        </form>
        <Link className="btn sec mini" href={`/app/analises/${id}/laudo`}>Ver laudo</Link>
      </div>
      {!validacao.ok ? (
        <div className="aviso" role="alert" style={{ marginBottom: 14 }}>
          <b>Esta análise está incompleta e ainda não pode virar laudo.</b> A recomendação só é calculada com os dados do laboratório — campo em branco não é tratado como zero.
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {validacao.erros.map((e) => <li key={e.campo}>{e.mensagem}</li>)}
          </ul>
          <p className="nota" style={{ margin: '8px 0 0' }}>Os números abaixo são só uma leitura parcial (em branco aparece como 0) — não use como recomendação.</p>
        </div>
      ) : validacao.naoInformados.length > 0 ? (
        <p className="nota" style={{ marginBottom: 12 }}>Não informados (aparecem como “—” no laudo e não são avaliados): {validacao.naoInformados.map((k) => REGRAS[k].rotulo).join(', ')}.</p>
      ) : null}
      <InterpretacaoView
        analise={{ ...paraAnalise(data), prnt: data.prnt, incorp: data.incorporacao }}
        cultura={cultura}
        tabelas={tabelas}
        contexto={{
          produtor: t?.propriedade?.produtor?.nome ?? '—',
          talhao: t?.nome ?? '—',
          areaHa: Number(t?.area_ha ?? 0),
          data: dataBR(data.data_coleta),
          profundidade: data.profundidade ?? '0–20',
          prodEsperadaTalhao: Number(t?.prod_esperada ?? 0) || undefined,
        }}
      />
    </>
  );
}
