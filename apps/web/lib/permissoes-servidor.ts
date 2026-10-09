import { perfilAtual } from '@/lib/supabase/server';
import { ErroDeUsuario } from '@/lib/acao';
import { PERFIS, pode, type Permissao } from '@/lib/permissoes';

const FRASE: Record<Permissao, string> = {
  'carteira.editar': 'alterar a carteira de produtores',
  'recomendacao.emitir': 'emitir recomendações',
  'tabelas.editar': 'alterar as tabelas técnicas',
  'dados.exportar': 'exportar dados',
  'relatorios.ver': 'ver relatórios',
  financeiro: 'acessar o financeiro do escritório',
  'equipe.gerenciar': 'gerenciar a equipe',
  'plano.gerenciar': 'gerenciar o plano e a cobrança',
  'escritorio.editar': 'alterar os dados do escritório',
  'dados.excluir': 'excluir dados',
  'academy.gerenciar': 'criar e publicar conteúdos da Academy',
  'academy.indicar': 'indicar conteúdos da Academy aos produtores',
  'atendimento.gerir': 'atender os pedidos dos produtores',
};

/**
 * Para server actions: devolve o perfil se a pessoa for do escritório e tiver a permissão; senão lança
 * um ErroDeUsuario em linguagem de gente (vira aviso na tela). O banco barra do mesmo jeito (RLS, 0038) —
 * isto só troca o "erro genérico" por uma explicação.
 */
export async function exigir(permissao: Permissao) {
  const perfil = await perfilAtual();
  if (!perfil?.org_id) throw new ErroDeUsuario('Sessão sem escritório associado.');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') throw new ErroDeUsuario('Sem permissão.');
  if (!pode(perfil.perfis, permissao)) {
    throw new ErroDeUsuario(`Seu perfil não permite ${FRASE[permissao]}. Peça ao proprietário do escritório.`);
  }
  return { ...perfil, org_id: perfil.org_id };
}

/** Rótulos de perfil para o texto de "acesso negado". */
export const nomesDosPerfis = (ids: readonly string[]) => ids.map((i) => PERFIS[i as keyof typeof PERFIS]?.nome ?? i);
