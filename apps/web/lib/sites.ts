import type { Papel } from './supabase/rotas';

/**
 * Os três sites do AgroTech. Cada um tem o próprio molde (menu, cores, telas) e a própria entrada; compartilham só a conta:
 * quem entra escolhe, na tela de login, para qual deles quer ir.
 *
 *   assistencia  o painel do escritório e o portal do produtor (carteira, análises, laudos, visitas…)
 *   academy      a universidade: catálogo de cursos, aulas, certificados
 *   connect      o relacionamento: pedidos do produtor, fila de atendimento, retornos
 */
export type SiteId = 'assistencia' | 'academy' | 'connect';

export const SITES_ORDEM: SiteId[] = ['assistencia', 'academy', 'connect'];

export interface DefinicaoSite {
  id: SiteId;
  nome: string;
  /** frase curta para o seletor de login */
  chamada: string;
  descricao: string;
  /** rota inicial (assistência depende do papel: ver `destinoDoSite`) */
  casa: string;
}

export const SITES: Record<SiteId, DefinicaoSite> = {
  assistencia: {
    id: 'assistencia',
    nome: 'Assistência Técnica',
    chamada: 'Carteira, visitas, análises e laudos',
    descricao: 'O dia a dia técnico do escritório e o acompanhamento da lavoura pelo produtor.',
    casa: '/app',
  },
  academy: {
    id: 'academy',
    nome: 'Academy',
    chamada: 'Cursos, aulas e certificados',
    descricao: 'Aprender no seu ritmo, com o conteúdo que o seu agrônomo escolheu.',
    casa: '/academy',
  },
  connect: {
    id: 'connect',
    nome: 'Connect',
    chamada: 'Pedidos, atendimento e retorno',
    descricao: 'Peça ajuda ao seu técnico com fotos e acompanhe cada atendimento até o fim.',
    casa: '/connect',
  },
};

/** Qualquer valor vira um site válido; sem valor (ou lixo), o de sempre: Assistência Técnica. */
export function siteDeValor(valor: unknown): SiteId {
  return valor === 'academy' || valor === 'connect' || valor === 'assistencia' ? valor : 'assistencia';
}

/** Para onde a pessoa vai depois de entrar (ou null se ainda não sabemos o papel dela). */
export function destinoDoSite(site: SiteId, papel: Papel): string | null {
  if (!papel) return null;
  if (site === 'assistencia') return papel === 'produtor' ? '/produtor' : '/app';
  return SITES[site].casa;
}

/** Tela de login já no site certo. `como=produtor` só muda o texto da tela (o destino vem do papel). */
export function loginDoSite(site: SiteId, como?: 'produtor'): string {
  return `/login?site=${site}${como === 'produtor' ? '&como=produtor' : ''}`;
}
