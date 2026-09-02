import { notFound } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';
import { tabelasDaOrg } from '@/lib/tabelas-org';
import { dataBR } from '@/lib/formato';
import { paraAnalise } from '@/lib/culturas';
import { LaudoView } from '@/components/laudo-view';
import { BotaoImprimir } from '@/components/botao-imprimir';

export const dynamic = 'force-dynamic';

export default async function LaudoAnalise({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const [{ data, error }, perfil, tabelas] = await Promise.all([
    sb.schema('agro').from('analises').select(
      `id, data_coleta, profundidade, laboratorio, prnt, incorporacao, prod_esperada,
       argila, ph, mo, p, k, na, ca, mg, al, h_al, s, b, zn, cu, mn, fe,
       talhao:talhao_id (
         nome, cultura, variedade, area_ha, prod_esperada,
         propriedade:propriedade_id ( nome, municipio, produtor:produtor_id ( nome ) )
       )`,
    ).eq('id', id).single(),
    perfilAtual(),
    tabelasDaOrg(sb),
  ]);

  if (error || !data) notFound();
  // deno-lint-ignore no-explicit-any
  const t = (data as any).talhao;
  const cultura = t?.cultura ? tabelas.culturas[t.cultura as string] : undefined;

  await registrar(sb, {
    acao: 'laudo.emitido',
    entidade: 'analises',
    entidade_id: id,
    org_id: perfil?.org_id ?? null,
  });

  return (
    <>
      <div className="cabecalho-vista nao-imprime">
        <div>
          <h1>Laudo</h1>
          <p>Confira e imprima ou salve em PDF pela caixa de impressão.</p>
        </div>
        <div className="acoes">
          <BotaoImprimir />
          <Link className="btn sec" href={`/app/analises/${id}`}>Voltar</Link>
        </div>
      </div>

      <LaudoView
        analise={{
          ...paraAnalise(data),
          prnt: data.prnt, incorp: data.incorporacao,
        }}
        cultura={cultura}
        tabelas={tabelas}
        produtor={t?.propriedade?.produtor?.nome ?? ''}
        propriedade={t?.propriedade?.nome ?? ''}
        municipio={t?.propriedade?.municipio ?? ''}
        talhao={t?.nome ?? ''}
        variedade={t?.variedade ?? ''}
        areaHa={Number(t?.area_ha ?? 0)}
        dataColeta={dataBR(data.data_coleta)}
        profundidade={data.profundidade ?? '0-20'}
        laboratorio={data.laboratorio ?? ''}
        prodEsperadaTalhao={Number(data.prod_esperada ?? t?.prod_esperada ?? 0) || undefined}
        consultor={{
          nome: perfil?.nome ?? '',
          crea: perfil?.crea ?? '',
          fone: '',
          empresa: 'Campo Forte Soluções Agrícolas',
        }}
      />
    </>
  );
}
