import { notFound } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';
import { dataBR } from '@/lib/formato';
import { CabecalhoVista, Cartao, Tag } from '@/components/ui';
import { ROTULO_NIVEL, ROTULO_STATUS, ROTULO_TEMA, ROTULO_TIPO, type Conteudo } from '@/lib/academy';
import { FormConteudo, type ProdutorOpcao } from '../secoes/FormConteudo';
import { Indicacoes, type IndicacaoLinha } from '../secoes/Indicacoes';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConteudoDaAcademy({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ indicado?: string; produtor?: string; visita?: string; analise?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();

  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  const { data } = await sb.schema('agro').from('academy_conteudos').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const conteudo = data as unknown as Conteudo;

  const [{ data: prod }, { data: pub }, { data: ind }, assinada] = await Promise.all([
    sb.schema('agro').from('produtores').select('id, nome').order('nome'),
    sb.schema('agro').from('academy_publicos').select('produtor_id').eq('conteudo_id', id),
    sb.schema('agro').from('academy_indicacoes')
      .select('id, produtor_id, mensagem, criado_em, aberto_em, concluido_em, produtor:produtor_id(nome)')
      .eq('conteudo_id', id)
      .order('criado_em', { ascending: false }),
    conteudo.arquivo_path
      ? sb.storage.from('academy').createSignedUrl(conteudo.arquivo_path, 3600)
      : Promise.resolve({ data: null }),
  ]);

  const produtores = (prod ?? []) as ProdutorOpcao[];
  const selecionados = (pub ?? []).map((p) => p.produtor_id as string);
  const indicacoes: IndicacaoLinha[] = (ind ?? []).map((i) => ({
    id: i.id as string,
    produtor_id: i.produtor_id as string,
    produtor: (i as unknown as { produtor: { nome: string } | null }).produtor?.nome ?? 'Produtor',
    mensagem: i.mensagem as string | null,
    criado_em: i.criado_em as string,
    aberto_em: i.aberto_em as string | null,
    concluido_em: i.concluido_em as string | null,
  }));

  const s = ROTULO_STATUS[conteudo.status];
  const podeEditar = pode(perfil?.perfis, 'academy.gerenciar');
  const podeIndicar = pode(perfil?.perfis, 'academy.indicar');
  const indicadoAgora = Number(q.indicado ?? 0);

  return (
    <>
      <CabecalhoVista
        olho={`Academy · ${ROTULO_TIPO[conteudo.tipo]}`}
        titulo={conteudo.titulo}
        descricao={
          <>
            <Tag tom={s.tom}>{s.txt}</Tag>{' '}
            {conteudo.tema ? `${ROTULO_TEMA[conteudo.tema]} · ` : ''}{ROTULO_NIVEL[conteudo.nivel]}
            {conteudo.cultura ? ` · ${conteudo.cultura}` : ''}
            {conteudo.revisado_em ? ` · revisado em ${dataBR(conteudo.revisado_em)}` : ''}
          </>
        }
      />

      {indicadoAgora > 0 ? (
        <div className="aviso" role="status" style={{ marginBottom: 14 }}>
          Indicado a {indicadoAgora} produtor(es). Quem já tem login recebe o aviso no portal.
        </div>
      ) : null}

      {!podeEditar ? (
        <div className="aviso" style={{ marginBottom: 14 }}>
          Seu perfil só consulta os conteúdos da Academy. Quem edita é o agrônomo ou o proprietário.
        </div>
      ) : null}

      <Cartao olho="Conteúdo" titulo={podeEditar ? 'Editar' : 'Detalhes'}>
        <FormConteudo
          conteudo={conteudo}
          produtores={produtores}
          selecionados={selecionados}
          arquivoUrl={assinada.data?.signedUrl ?? null}
          podeEditar={podeEditar}
        />
      </Cartao>

      {conteudo.status === 'publicado' ? (
        <div style={{ marginTop: 14 }}>
          <Indicacoes
            conteudoId={conteudo.id}
            produtores={produtores}
            indicacoes={indicacoes}
            podeIndicar={podeIndicar}
            preselecionado={UUID.test(q.produtor ?? '') ? q.produtor : undefined}
            visitaId={UUID.test(q.visita ?? '') ? q.visita : undefined}
            analiseId={UUID.test(q.analise ?? '') ? q.analise : undefined}
          />
        </div>
      ) : (
        <p className="nota" style={{ marginTop: 14 }}>Só conteúdo publicado pode ser indicado a produtores.</p>
      )}
    </>
  );
}
