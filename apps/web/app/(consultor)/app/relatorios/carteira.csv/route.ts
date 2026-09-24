import { NextResponse } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { nomeCultura } from '@/lib/culturas';
import { temFeature } from '@/lib/planos';

/** Exporta a carteira inteira (situação por talhão) em CSV — mesma fonte de agro.vw_talhao_situacao. */
export async function GET() {
  const sb = await criarClienteServidor();

  if (!(await temFeature(sb, 'relatorios_avancados'))) {
    return new NextResponse('Seu plano não inclui relatórios avançados.', { status: 403 });
  }

  const { data } = await sb
    .schema('agro')
    .from('vw_talhao_situacao')
    .select('nome, cultura, area_ha, data_coleta, v, m, situacao')
    .order('nome');

  const linhas = (data ?? []) as Array<{
    nome: string; cultura: string | null; area_ha: number | null;
    data_coleta: string | null; v: number | null; m: number | null; situacao: string;
  }>;

  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecalho = ['talhao', 'cultura', 'area_ha', 'ultima_coleta', 'saturacao_bases_pct', 'saturacao_aluminio_pct', 'situacao'];
  const corpo = linhas.map((l) => [
    l.nome, nomeCultura(l.cultura), l.area_ha ?? '', l.data_coleta ?? '', l.v ?? '', l.m ?? '', l.situacao,
  ].map(escapar).join(','));

  const csv = [cabecalho.join(','), ...corpo].join('\n');

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="agrotech-carteira-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
