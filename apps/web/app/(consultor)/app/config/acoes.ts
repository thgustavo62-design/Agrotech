'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteServidor, perfilAtual } from '@/lib/supabase/server';
import { exigir } from '@/lib/permissoes-servidor';
import { registrar } from '@/lib/audit';
import { comAviso, ErroDeUsuario, lancarDoBanco } from '@/lib/acao';
import { clienteAdmin } from '@/lib/supabase/admin';

/** Edita o próprio perfil — coberto pela policy profiles_atualiza_proprio; o gatilho (0037) impede mexer em papel/perfis/escritório. */
async function salvarPerfilConsultorImpl(fd: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) throw new ErroDeUsuario('sessão inválida');

  const nome = String(fd.get('nome') ?? '').trim();
  if (!nome) throw new ErroDeUsuario('Informe seu nome.');

  const dados = {
    nome,
    titulo: String(fd.get('titulo') ?? '').trim().slice(0, 60) || null,
    crea: String(fd.get('crea') ?? '').trim() || null,
    art: String(fd.get('art') ?? '').trim() || null,
    fone: String(fd.get('fone') ?? '').trim() || null,
  };

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('profiles').update(dados).eq('id', perfil.id);
  if (error) lancarDoBanco(error);

  await registrar(sb, {
    acao: 'perfil.editado', entidade: 'profiles', entidade_id: perfil.id, org_id: perfil.org_id,
  });
  revalidatePath('/app/config', 'layout');
}

/** Edita o escritório (org) — só quem tem `escritorio.editar` (proprietário); a RLS restritiva de 0038 confere de novo. */
async function salvarEscritorioImpl(fd: FormData) {
  const perfil = await exigir('escritorio.editar');

  const nome = String(fd.get('nome') ?? '').trim();
  if (!nome) throw new ErroDeUsuario('Informe o nome do escritório.');

  const dados = {
    nome,
    municipio: String(fd.get('municipio') ?? '').trim() || null,
    uf: String(fd.get('uf') ?? '').trim().toUpperCase().slice(0, 2) || null,
  };

  const sb = await criarClienteServidor();
  const { error } = await sb.schema('agro').from('orgs').update(dados).eq('id', perfil.org_id);
  if (error) lancarDoBanco(error);

  await registrar(sb, {
    acao: 'escritorio.editado', entidade: 'orgs', entidade_id: perfil.org_id, org_id: perfil.org_id,
  });
  revalidatePath('/app/config', 'layout');
}

export const salvarPerfilConsultor = comAviso(salvarPerfilConsultorImpl);
export const salvarEscritorio = comAviso(salvarEscritorioImpl);

/**
 * Espelha em profiles.mfa_ativo se a pessoa tem um segundo fator CONFIRMADO. O gatilho do banco já faz isso; esta ação é
 * a rede de segurança (a tabela de fatores é do Auth e o gatilho pode não existir no projeto real) e é idempotente.
 * Só mexe no perfil de quem chama. Sem a chave de serviço no servidor, não faz nada.
 */
export async function sincronizarMfa(): Promise<{ ok: boolean }> {
  const perfil = await perfilAtual();
  const admin = clienteAdmin();
  if (!perfil || !admin) return { ok: false };
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: perfil.id });
  if (error) { console.error('[sincronizarMfa]', error); return { ok: false }; }
  const ativo = (data?.factors ?? []).some((f) => f.status === 'verified');
  const { error: eUp } = await admin.schema('agro').from('profiles').update({ mfa_ativo: ativo }).eq('id', perfil.id);
  if (eUp) { console.error('[sincronizarMfa] perfil', eUp); return { ok: false }; }
  revalidatePath('/app/config', 'layout');
  return { ok: true };
}
