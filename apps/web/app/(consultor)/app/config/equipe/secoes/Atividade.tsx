import { Cartao } from '@/components/ui';
import { dataBR } from '@/lib/formato';
import { perfisValidos, rotuloDosPerfis } from '@/lib/permissoes';
import type { ContextoEquipe } from '../dados';

/** Frase legível para uma linha da trilha de auditoria da equipe. */
function frase(a: ContextoEquipe['atividade'][number], quem: string): string {
  const d = a.dados ?? {};
  switch (a.acao) {
    case 'equipe.convidado': return `${quem} convidou ${String(d.email ?? 'alguém')} (${rotuloDosPerfis(perfisValidos(d.perfis))})`;
    case 'equipe.convite_cancelado': return `${quem} cancelou um convite`;
    case 'equipe.perfis_alterados': return `${quem} mudou o acesso de ${String(d.nome ?? 'um colega')} para ${rotuloDosPerfis(perfisValidos(d.perfis))}`;
    case 'equipe.acesso_gerado': return `${quem} gerou um novo acesso (senha) para ${String(d.nome ?? 'um colega')}`;
    case 'equipe.cadastrado': return `${quem} cadastrou ${String(d.nome ?? 'um colega')} (${rotuloDosPerfis(perfisValidos(d.perfis))})`;
    case 'equipe.senha_definida': return `${quem} definiu uma nova senha para ${String(d.nome ?? 'um colega')}`;
    case 'equipe.removido': return `${quem} removeu ${String(d.nome ?? 'um colega')} do escritório`;
    default: return `${quem}: ${a.acao}`;
  }
}

export function SecaoAtividade({ ctx }: { ctx: ContextoEquipe }) {
  if (ctx.atividade.length === 0) return null;
  const nomes = new Map(ctx.membros.map((m) => [m.id, m.nome ?? 'Alguém']));
  return (
    <Cartao olho="Histórico" titulo="Movimentação recente da equipe">
      <div className="atividade">
        {ctx.atividade.map((a) => (
          <div className="atividade-linha" key={a.id}>
            <time dateTime={a.criado_em}>{dataBR(a.criado_em.slice(0, 10))}</time>
            <span>{frase(a, a.user_id ? (nomes.get(a.user_id) ?? 'Alguém') : 'Alguém')}</span>
          </div>
        ))}
      </div>
    </Cartao>
  );
}
