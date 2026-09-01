import { notFound } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { CabecalhoVista } from '@/components/ui';
import { FormProdutor } from '@/components/form-produtor';

export const dynamic = 'force-dynamic';

export default async function EditarProdutor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await criarClienteServidor();
  const { data, error } = await sb
    .schema('agro').from('produtores')
    .select('id, nome, cpf_cnpj, email, fone').eq('id', id).single();
  if (error || !data) notFound();

  return (
    <>
      <CabecalhoVista olho="Carteira" titulo={`Editar — ${data.nome}`} />
      <FormProdutor produtor={data} />
    </>
  );
}
