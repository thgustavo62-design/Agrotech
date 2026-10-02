import Link from 'next/link';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { rotuloDosPerfis } from '@/lib/permissoes';
import { CabecalhoVista, Cartao } from '@/components/ui';

/**
 * Tela no lugar de uma área que o perfil da pessoa não cobre. Em vez de um "403" seco, diz o que ela é,
 * por que não vê isto e QUEM resolve (os proprietários do escritório, pelo nome).
 */
export async function AcessoNegado({ titulo, o_que }: { titulo: string; o_que: string }) {
  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();
  const { data } = perfil?.org_id
    ? await sb.schema('agro').from('profiles').select('nome').eq('org_id', perfil.org_id).contains('perfis', ['proprietario']).order('nome')
    : { data: null };
  const donos = (data ?? []).map((d) => d.nome).filter((n): n is string => Boolean(n));

  return (
    <>
      <CabecalhoVista olho="Acesso restrito" titulo={titulo} descricao={o_que} />
      <Cartao olho="Seu acesso" titulo={`Seu perfil é ${rotuloDosPerfis(perfil?.perfis)}`}>
        <p className="nota" style={{ margin: '0 0 10px' }}>
          Este perfil não inclui esta área. {donos.length
            ? <>Quem pode liberar: <b>{donos.join(', ')}</b>.</>
            : 'Peça a quem administra o escritório.'}
        </p>
        <Link className="btn sec" href="/app/config/equipe">Ver o que cada perfil pode</Link>
      </Cartao>
    </>
  );
}
