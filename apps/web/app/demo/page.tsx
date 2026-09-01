import type { Metadata } from 'next';
import { InterpretacaoView } from '@/components/interpretacao-view';
import {
  ANALISE_DEMO, CONTEXTO_DEMO, CULTURA_DEMO, TABELAS_DEMO,
} from '@/lib/demo';

export const metadata: Metadata = {
  title: 'AgroTech — vitrine da interpretação',
};

export default function DemoInterpretacao() {
  return (
    <InterpretacaoView
      analise={ANALISE_DEMO}
      cultura={CULTURA_DEMO}
      tabelas={TABELAS_DEMO}
      contexto={CONTEXTO_DEMO}
    />
  );
}
