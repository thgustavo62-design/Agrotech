import { notFound } from 'next/navigation';
import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { CabecalhoVista } from '@/components/ui';
import { FormTalhao } from '@/components/form-talhao';

export const dynamic = 'force-dynamic';

export default async function EditarTalhao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();
  const { data, error } = await sb
    .schema('agro')
    .from('talhoes')
    .select('id, nome, cultura, variedade, area_ha, prod_esperada, espacamento, ano_implantacao, obs, propriedade:propriedade_id(produtor_id)')
    .eq('id', id)
    .single();

  if (error || !data) notFound();
  // deno-lint-ignore no-explicit-any
  const produtorId = ((data as any).propriedade?.produtor_id as string) ?? '';

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link className="btn sec mini" href={`/app/produtores/${produtorId}`}>← Produtor</Link>
      </div>
      <CabecalhoVista olho="Unidade de manejo" titulo={`Editar — ${data.nome}`} />
      <FormTalhao talhao={data} produtorId={produtorId} />
    </>
  );
}
