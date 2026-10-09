import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { nivelDeAutenticacao } from '@/lib/supabase/sessao';
import { loginDoSite, type SiteId } from '@/lib/sites';
import { AcessoRemovido } from '@/components/acesso-removido';
import { TrocaDeSenhaObrigatoria } from '@/components/troca-de-senha-obrigatoria';

/**
 * Guarda de conta para os sites novos (Academy e Connect). A Assistência Técnica tem o dela no layout de /app; aqui valem as
 * mesmas regras, para que trocar de site nunca seja um atalho: conta removida não entra, senha provisória tem de ser trocada
 * e quem ligou a verificação em duas etapas precisa do código. A barreira real continua sendo a RLS no banco.
 */
export async function exigirConta(site: SiteId) {
  const sb = await criarClienteServidor();
  const perfil = await perfilAtual();
  if (!perfil) redirect(loginDoSite(site));
  if (perfil.role !== 'consultor' && perfil.role !== 'admin' && perfil.role !== 'produtor') redirect(loginDoSite(site));

  let bloqueio: ReactNode | null = null;
  if (perfil.desativado_em) bloqueio = <AcessoRemovido />;
  else if (perfil.senha_provisoria) bloqueio = <TrocaDeSenhaObrigatoria nome={perfil.nome} />;
  else if (perfil.mfa_ativo && (await nivelDeAutenticacao(sb)) !== 'aal2') redirect('/verificar-codigo');

  return {
    sb,
    perfil,
    bloqueio,
    /** o produtor é o aluno; a equipe vê como aluno (sem gravar progresso) e tem o estúdio */
    ehAluno: perfil.role === 'produtor',
    ehEquipe: perfil.role === 'consultor' || perfil.role === 'admin',
  };
}
