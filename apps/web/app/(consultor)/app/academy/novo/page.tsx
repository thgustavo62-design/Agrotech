import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { CabecalhoVista, Cartao } from '@/components/ui';
import { FormConteudo, type ProdutorOpcao } from '../secoes/FormConteudo';

export const dynamic = 'force-dynamic';

export default async function NovoConteudo() {
  const perfil = await perfilAtual();
  if (!pode(perfil?.perfis, 'academy.gerenciar')) redirect('/app/academy');

  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('produtores').select('id, nome').order('nome');
  const produtores = (data ?? []) as ProdutorOpcao[];

  return (
    <>
      <CabecalhoVista
        olho="Academy"
        titulo="Novo conteúdo"
        descricao="Comece como rascunho: só você e a equipe veem. Os produtores só enxergam depois de publicar."
      />
      <Cartao>
        <FormConteudo conteudo={null} produtores={produtores} selecionados={[]} arquivoUrl={null} podeEditar />
      </Cartao>
    </>
  );
}
