import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/server';
import { Cartao } from '@/components/ui';
import { dataBR } from '@/lib/formato';

export const dynamic = 'force-dynamic';

const ROTULO: Record<string, string> = {
  'equipe.convidado': 'Convite de equipe enviado',
  'equipe.convite_cancelado': 'Convite de equipe cancelado',
  'equipe.perfis_alterados': 'Acesso de um colega alterado',
  'equipe.removido': 'Colega removido do escritório',
  'escritorio.editado': 'Dados do escritório alterados',
  'perfil.editado': 'Perfil pessoal alterado',
  'recomendacao.emitida': 'Recomendação emitida',
  'laudo.campo_corrigido': 'Campo de laudo corrigido',
};

/** Privacidade e dados: o que o escritório pode exportar (LGPD) e a trilha de auditoria recente. */
export default async function ConfigPrivacidade() {
  const sb = await criarClienteServidor();
  const { data } = await sb.schema('agro').from('audit_log')
    .select('id, acao, user_id, criado_em').order('criado_em', { ascending: false }).limit(15);
  const ids = [...new Set((data ?? []).map((a) => a.user_id).filter((x): x is string => Boolean(x)))];
  const { data: pessoas } = ids.length ? await sb.schema('agro').from('profiles').select('id, nome').in('id', ids) : { data: [] };
  const nomes = new Map((pessoas ?? []).map((p) => [p.id, p.nome ?? 'Alguém']));

  return (
    <>
      <Cartao olho="LGPD" titulo="Os dados dos seus clientes">
        <p className="nota" style={{ margin: '0 0 12px' }}>
          Cada escritório só enxerga os próprios dados — o isolamento é feito no banco, não só na tela. O produtor pode pedir
          uma cópia dos dados dele: na ficha do produtor, use <b>Exportar dados</b> (arquivo JSON aberto). A exportação é do
          perfil Agronômico ou do proprietário.
        </p>
        <Link className="btn sec" href="/app/produtores">Ir para os produtores</Link>
      </Cartao>

      <Cartao olho="Auditoria" titulo="Atividade recente do escritório">
        {(data ?? []).length === 0 ? (
          <p className="nota" style={{ margin: 0 }}>Nada registrado ainda.</p>
        ) : (
          <div className="atividade">
            {(data ?? []).map((a) => (
              <div className="atividade-linha" key={a.id}>
                <time dateTime={a.criado_em}>{dataBR(a.criado_em.slice(0, 10))}</time>
                <span><b>{a.user_id ? (nomes.get(a.user_id) ?? 'Alguém') : 'Sistema'}</b> · {ROTULO[a.acao] ?? a.acao}</span>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
