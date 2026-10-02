import { headers } from 'next/headers';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { pode } from '@/lib/permissoes';

export type Membro = { id: string; nome: string | null; crea: string | null; titulo: string | null; role: string; perfis: string[] };
export type Convite = { id: string; email: string; titulo: string | null; perfis: string[]; token: string; expira_em: string; criado_em: string };
export type Atividade = { id: number; acao: string; user_id: string | null; dados: Record<string, unknown> | null; criado_em: string };

export const ACOES_DA_EQUIPE = ['equipe.convidado', 'equipe.convite_cancelado', 'equipe.perfis_alterados', 'equipe.removido', 'equipe.acesso_gerado'];

/** Endereço do site (para o link do convite): variável de ambiente, ou o host da própria requisição. */
export async function enderecoDoSite(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return '';
  return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
}

/** Tudo da tela "Equipe e permissões" numa rodada só de consultas (nada depende de nada). */
export async function carregarEquipe() {
  const perfil = await perfilAtual();
  const sb = await criarClienteServidor();
  const org = perfil?.org_id ?? null;
  const gerencia = pode(perfil?.perfis, 'equipe.gerenciar');
  const vazio = Promise.resolve({ data: null });

  const [{ data: membrosRaw }, { data: convitesRaw }, { data: plano }, { data: atividadeRaw }, site] = await Promise.all([
    org
      ? sb.schema('agro').from('profiles').select('id, nome, crea, titulo, role, perfis').eq('org_id', org).in('role', ['consultor', 'admin']).order('nome')
      : vazio,
    org && gerencia
      ? sb.schema('agro').from('convites_equipe').select('id, email, titulo, perfis, token, expira_em, criado_em')
          .is('usado_em', null).gt('expira_em', new Date().toISOString()).order('criado_em', { ascending: false })
      : vazio,
    org
      ? sb.schema('agro').from('assinaturas').select('plano, planos(nome, usuarios_max)').maybeSingle()
      : vazio,
    org
      ? sb.schema('agro').from('audit_log').select('id, acao, user_id, dados, criado_em').in('acao', ACOES_DA_EQUIPE).order('criado_em', { ascending: false }).limit(8)
      : vazio,
    enderecoDoSite(),
  ]);

  const membros = (membrosRaw ?? []) as Membro[];
  const convites = (convitesRaw ?? []) as Convite[];
  const planoRel = (plano as { planos?: { nome: string; usuarios_max: number } | { nome: string; usuarios_max: number }[] | null } | null)?.planos;
  const infoPlano = Array.isArray(planoRel) ? planoRel[0] : planoRel;
  const limite = infoPlano?.usuarios_max ?? null;

  return {
    eu: perfil,
    gerencia,
    membros,
    convites,
    atividade: (atividadeRaw ?? []) as Atividade[],
    site,
    plano: { nome: infoPlano?.nome ?? null, limite, usados: membros.length, reservados: convites.length, cheio: limite != null && membros.length + convites.length >= limite },
  };
}

export type ContextoEquipe = Awaited<ReturnType<typeof carregarEquipe>>;
