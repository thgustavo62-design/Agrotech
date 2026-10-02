import Link from 'next/link';
import { paraAnalise } from '@/lib/culturas';
import { dataBR } from '@/lib/formato';
import { Vazio } from '@/components/ui';
import { InterpretacaoView } from '@/components/interpretacao-view';
import type { ContextoTalhao } from '../dados';

export function PainelSolo({ ctx }: { ctx: ContextoTalhao }) {
  const { talhao, tabelas, produtor, ultima, cultura } = ctx;

  return (
    ultima ? (
      <InterpretacaoView
        analise={{ ...paraAnalise(ultima), prnt: ultima.prnt, incorp: ultima.incorporacao }}
        cultura={cultura}
        tabelas={tabelas}
        contexto={{
          produtor: produtor?.nome ?? '—',
          talhao: talhao.nome as string,
          areaHa: Number(talhao.area_ha ?? 0),
          data: dataBR(ultima.data_coleta),
          profundidade: ultima.profundidade ?? '0–20',
          prodEsperadaTalhao: Number(ultima.prod_esperada ?? talhao.prod_esperada ?? 0) || undefined,
        }}
      />
    ) : (
      <Vazio titulo="Sem análise de solo para este talhão">
        <Link href="/app/analises/nova">Lançar análise.</Link>
      </Vazio>
    )
  );
}
