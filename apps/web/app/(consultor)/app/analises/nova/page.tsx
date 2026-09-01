import { criarClienteServidor } from '@/lib/supabase/server';
import { CabecalhoVista, Vazio } from '@/components/ui';
import { FormAnalise } from '@/components/form-analise';

export const dynamic = 'force-dynamic';

export default async function NovaAnalise() {
  const sb = await criarClienteServidor();
  const { data } = await sb
    .schema('agro')
    .from('talhoes')
    .select('id, nome, propriedade:propriedade_id(produtor:produtor_id(nome))')
    .order('nome');

  const talhoes = (data ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    // deno-lint-ignore no-explicit-any
    produtor: (t as any).propriedade?.produtor?.nome ?? '—',
  }));

  return (
    <>
      <CabecalhoVista
        olho="Fertilidade"
        titulo="Lançar análise de solo"
        descricao="Digite os parâmetros do laudo. pH e H+Al são o mínimo para a CTC."
      />
      {talhoes.length === 0 ? (
        <Vazio titulo="Nenhum talhão cadastrado">
          Cadastre um produtor e um talhão antes de lançar a análise.
        </Vazio>
      ) : (
        <FormAnalise talhoes={talhoes} />
      )}
    </>
  );
}
