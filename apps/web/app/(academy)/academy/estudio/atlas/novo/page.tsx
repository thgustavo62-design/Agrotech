import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { CabecalhoVista, Cartao } from '@/components/ui';
import { FormFicha } from '@/components/atlas/form-ficha';

export const dynamic = 'force-dynamic';

export default async function NovaFicha() {
  const perfil = await perfilAtual();
  if (!pode(perfil?.perfis, 'academy.gerenciar')) redirect('/academy/estudio/atlas');

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Atlas"
        titulo="Nova ficha"
        descricao="Comece como rascunho: só a equipe vê. Salve, adicione as fotos e então publique."
      />
      <Cartao>
        <FormFicha ficha={null} nFotos={0} podeEditar />
      </Cartao>
    </>
  );
}
