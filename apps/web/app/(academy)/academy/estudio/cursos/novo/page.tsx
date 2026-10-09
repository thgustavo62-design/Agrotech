import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { CabecalhoVista, Cartao } from '@/components/ui';
import type { ProdutorOpcao } from '../../conteudos/secoes/FormConteudo';
import { FormCurso } from '../secoes/FormCurso';

export const dynamic = 'force-dynamic';

export default async function NovoCurso() {
  const perfil = await perfilAtual();
  if (!pode(perfil?.perfis, 'academy.gerenciar')) redirect('/academy/estudio/cursos');
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('produtores').select('id, nome').order('nome');

  return (
    <>
      <CabecalhoVista
        olho="Estúdio · Cursos"
        titulo="Novo curso"
        descricao="Crie o curso como rascunho; em seguida você monta os módulos e adiciona as aulas. Só aparece para os produtores depois de publicado."
      />
      <Cartao>
        <FormCurso curso={null} produtores={(data ?? []) as ProdutorOpcao[]} selecionados={[]} capaUrl={null} podeEditar />
      </Cartao>
    </>
  );
}
