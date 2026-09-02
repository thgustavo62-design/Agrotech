import { NextResponse } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { registrar } from '@/lib/audit';

/**
 * Exportação completa dos dados de um produtor em JSON aberto (LGPD — direito de
 * portabilidade; ver PRODUTO-VENDAVEL §7). A RLS garante que só sai o que é da
 * organização do consultor logado.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();

  const { data: produtor, error } = await sb
    .schema('agro').from('produtores').select('*').eq('id', id).single();
  if (error || !produtor) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });

  const [{ data: propriedades }, { data: talhoes }, { data: analises }, { data: recomendacoes }, { data: visitas }] =
    await Promise.all([
      sb.schema('agro').from('propriedades').select('*').eq('produtor_id', id),
      sb.schema('agro').from('talhoes').select('*').eq('produtor_id', id),
      sb.schema('agro').from('analises').select('*').eq('produtor_id', id),
      sb.schema('agro').from('recomendacoes').select('*').eq('produtor_id', id),
      sb.schema('agro').from('visitas').select('*').eq('produtor_id', id),
    ]);

  await registrar(sb, {
    acao: 'produtor.dados_exportados',
    entidade: 'produtores',
    entidade_id: id,
    org_id: (produtor as { org_id?: string }).org_id ?? null,
  });

  const pacote = {
    exportado_em: new Date().toISOString(),
    produtor,
    propriedades: propriedades ?? [],
    talhoes: talhoes ?? [],
    analises: analises ?? [],
    recomendacoes: recomendacoes ?? [],
    visitas: visitas ?? [],
  };

  const nome = String((produtor as { nome?: string }).nome ?? 'produtor')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return new NextResponse(JSON.stringify(pacote, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="agrotech-${nome}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
