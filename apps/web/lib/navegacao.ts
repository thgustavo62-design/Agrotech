import type { ComponentType, SVGProps } from 'react';
import { pode, type Permissao } from './permissoes';
import {
  IconeInicio, IconePendencia, IconeAgenda, IconeProdutores, IconePropriedades,
  IconeTalhoes, IconeAnalises, IconeLaudos, IconeRecomendacoes, IconeMonitoramento,
  IconeInteligencia, IconeRelatorios, IconeFinanceiro, IconeEquipe, IconeTabelas,
  IconeAssinatura, IconeConfig,
} from '@/components/icones';

/**
 * Rota `path` está "dentro" de `href` pra fins de destacar item de menu.
 * `startsWith` puro colide com rotas irmãs que só compartilham o prefixo de
 * texto (achado real: "/apple-icon" batendo em "/app" no middleware) — aqui
 * o efeito seria só cosmético (item errado destacado), mas o mesmo cuidado
 * de limite de segmento vale.
 */
export function rotaAtiva(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

/** Dentre os itens do menu, o mais específico que contém a rota (Equipe, em /app/config/equipe, não acende "Configurações"). */
export function hrefAtivo(path: string, hrefs: readonly string[]): string | undefined {
  return hrefs.filter((h) => rotaAtiva(path, h)).sort((a, b) => b.length - a.length)[0];
}

export interface ItemNav {
  href: string;
  rotulo: string;
  icone: ComponentType<SVGProps<SVGSVGElement>>;
  /** true = rota ainda não tem tela própria (mostra "em breve" no lugar de navegar) */
  embreve?: boolean;
  /** permissão (lib/permissoes.ts) para o item aparecer; sem ela, todo mundo da equipe vê */
  permissao?: Permissao;
}

export interface GrupoNav {
  titulo: string;
  itens: ItemNav[];
}

/**
 * Fonte única da navegação da Central do Agrônomo — usada pela sidebar
 * (desktop), pela barra inferior (mobile) e pela paleta de comandos.
 * Ver docs/UX_ARCHITECTURE.md §1.1 para o raciocínio de cada grupo.
 */
export const NAVEGACAO_CONSULTOR: GrupoNav[] = [
  {
    titulo: 'Visão geral',
    itens: [
      { href: '/app', rotulo: 'Início', icone: IconeInicio },
      { href: '/app/pendencias', rotulo: 'Pendências', icone: IconePendencia },
      { href: '/app/agenda', rotulo: 'Agenda', icone: IconeAgenda },
    ],
  },
  {
    titulo: 'Gestão técnica',
    itens: [
      { href: '/app/produtores', rotulo: 'Produtores', icone: IconeProdutores },
      { href: '/app/propriedades', rotulo: 'Propriedades', icone: IconePropriedades },
      { href: '/app/talhoes', rotulo: 'Talhões', icone: IconeTalhoes },
      { href: '/app/analises', rotulo: 'Análises', icone: IconeAnalises },
      { href: '/app/laudos', rotulo: 'Laudos', icone: IconeLaudos },
      { href: '/app/recomendacoes', rotulo: 'Recomendações', icone: IconeRecomendacoes },
      { href: '/app/monitoramento', rotulo: 'Monitoramento', icone: IconeMonitoramento },
    ],
  },
  {
    titulo: 'Inteligência',
    itens: [
      { href: '/app/inteligencia', rotulo: 'Indicadores', icone: IconeInteligencia },
      { href: '/app/relatorios', rotulo: 'Relatórios', icone: IconeRelatorios, permissao: 'relatorios.ver' },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { href: '/app/financeiro-escritorio', rotulo: 'Financeiro do escritório', icone: IconeFinanceiro, permissao: 'financeiro' },
      { href: '/app/config/equipe', rotulo: 'Equipe', icone: IconeEquipe },
      { href: '/app/tabelas', rotulo: 'Tabelas técnicas', icone: IconeTabelas },
      { href: '/app/assinatura', rotulo: 'Assinatura', icone: IconeAssinatura, permissao: 'plano.gerenciar' },
      { href: '/app/config', rotulo: 'Configurações', icone: IconeConfig },
    ],
  },
];

/** O menu que ESTA pessoa vê: itens sem permissão para ela somem (o banco barra de qualquer jeito — RLS). */
export function navegacaoPara(perfis: readonly string[] | null | undefined): GrupoNav[] {
  return NAVEGACAO_CONSULTOR
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !i.permissao || pode(perfis, i.permissao)) }))
    .filter((g) => g.itens.length > 0);
}

/** Os 5 mais usados, para a barra inferior no mobile (o resto vai no drawer "Mais"). */
export const NAVEGACAO_MOBILE_PRINCIPAL = ['/app', '/app/produtores', '/app/talhoes', '/app/analises', '/app/laudos'];

/** Rótulos de segmento estático para as breadcrumbs (ver components/breadcrumbs.tsx). */
export const ROTULOS_SEGMENTO: Record<string, string> = {
  app: 'Início',
  produtores: 'Produtores',
  propriedades: 'Propriedades',
  talhoes: 'Talhões',
  analises: 'Análises',
  laudos: 'Laudos',
  recomendacoes: 'Recomendações',
  monitoramento: 'Monitoramento',
  pendencias: 'Pendências',
  agenda: 'Agenda',
  inteligencia: 'Indicadores',
  relatorios: 'Relatórios',
  'financeiro-escritorio': 'Financeiro do escritório',
  equipe: 'Equipe e permissões',
  escritorio: 'Escritório',
  privacidade: 'Privacidade e dados',
  tabelas: 'Tabelas técnicas',
  assinatura: 'Assinatura',
  config: 'Configurações',
  nova: 'Novo',
  novo: 'Novo',
  editar: 'Editar',
  laudo: 'Laudo',
  exportar: 'Exportar',
};
