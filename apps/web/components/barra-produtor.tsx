'use client';

import { BarraInferior, type GrupoBarra } from './barra-mobile';
import {
  IconeInicio, IconePropriedades, IconeTalhoes, IconeRecomendacoes, IconeMonitoramento,
  IconeFinanceiro, IconeAnalises, IconeLaudos,
} from './icones';

/** Mesmos destinos de NavProdutor (que no celular fica escondido). */
const GRUPOS: GrupoBarra[] = [
  {
    itens: [
      { href: '/produtor', rotulo: 'Início', icone: IconeInicio },
      { href: '/produtor/talhoes', rotulo: 'Talhões', icone: IconeTalhoes },
      { href: '/produtor/recomendacoes', rotulo: 'Recomendações', icone: IconeRecomendacoes },
      { href: '/produtor/atividades', rotulo: 'Atividades', icone: IconeMonitoramento },
      { href: '/produtor/fazenda', rotulo: 'Minha fazenda', icone: IconePropriedades },
      { href: '/produtor/financeiro', rotulo: 'Financeiro', icone: IconeFinanceiro },
      { href: '/produtor/producao', rotulo: 'Produção', icone: IconeAnalises },
      { href: '/produtor/documentos', rotulo: 'Documentos', icone: IconeLaudos },
    ],
  },
];

export function BarraProdutor({ nome }: { nome?: string | null }) {
  return (
    <BarraInferior
      grupos={GRUPOS}
      principais={['/produtor', '/produtor/talhoes', '/produtor/recomendacoes', '/produtor/atividades']}
      nome={nome}
      subtitulo="Portal do produtor"
      sairAction="/produtor/sair"
    />
  );
}
