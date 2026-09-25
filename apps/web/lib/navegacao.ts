import type { ComponentType, SVGProps } from 'react';
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

export interface ItemNav {
  href: string;
  rotulo: string;
  icone: ComponentType<SVGProps<SVGSVGElement>>;
  /** true = rota ainda não tem tela própria (mostra "em breve" no lugar de navegar) */
  embreve?: boolean;
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
      { href: '/app/relatorios', rotulo: 'Relatórios', icone: IconeRelatorios },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { href: '/app/financeiro-escritorio', rotulo: 'Financeiro do escritório', icone: IconeFinanceiro },
      { href: '/app/equipe', rotulo: 'Equipe', icone: IconeEquipe, embreve: true },
      { href: '/app/tabelas', rotulo: 'Tabelas técnicas', icone: IconeTabelas },
      { href: '/app/assinatura', rotulo: 'Assinatura', icone: IconeAssinatura },
      { href: '/app/config', rotulo: 'Configurações', icone: IconeConfig },
    ],
  },
];

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
  equipe: 'Equipe',
  tabelas: 'Tabelas técnicas',
  assinatura: 'Assinatura',
  config: 'Configurações',
  nova: 'Novo',
  novo: 'Novo',
  editar: 'Editar',
  laudo: 'Laudo',
  exportar: 'Exportar',
};
