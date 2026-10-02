import Link from 'next/link';
import { f, dataBR } from '@/lib/formato';
import { Cartao, Grade, Metrica, Vazio } from '@/components/ui';
import type { ContextoTalhao } from '../dados';

export function PainelGeral({ ctx }: { ctx: ContextoTalhao }) {
  const { talhao, ultima, cultura, calc, V2, mMax, situacao, proximaVisita } = ctx;

  return (
    (
      <>
        <Grade cols={4}>
          <Metrica rotulo="Área" valor={`${f(Number(talhao.area_ha ?? 0), 1)} ha`} />
          <Metrica
            rotulo="Saturação de bases"
            valor={calc ? `${f(calc.V, 0)}%` : '—'}
            detalhe={cultura ? `meta ${V2}%` : undefined}
            cor={calc ? (calc.V >= V2 ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined}
          />
          <Metrica
            rotulo="Saturação de alumínio"
            valor={calc ? `${f(calc.m, 0)}%` : '—'}
            detalhe={cultura ? `limite ${mMax}%` : undefined}
            cor={calc ? (calc.m <= mMax ? 'var(--c-mbom)' : 'var(--c-mb)') : undefined}
          />
          <Metrica rotulo="Situação" valor={situacao.txt} cor={situacao.tom === 'ruim' ? 'var(--c-mb)' : situacao.tom === 'ok' ? 'var(--c-mbom)' : undefined} />
        </Grade>

        <Cartao olho="Cadastro" titulo="Dados do talhão" style={{ marginTop: 14 }}>
          <Grade cols={4}>
            <Metrica rotulo="Variedade" valor={talhao.variedade || '—'} />
            <Metrica rotulo="Espaçamento" valor={talhao.espacamento || '—'} />
            <Metrica rotulo="Implantação" valor={talhao.ano_implantacao || '—'} />
            <Metrica rotulo="Produtividade esperada" valor={talhao.prod_esperada ? `${f(Number(talhao.prod_esperada), 1)} ${cultura?.un ?? ''}` : '—'} />
          </Grade>
          {talhao.obs ? <p className="nota" style={{ marginTop: 12 }}>{talhao.obs}</p> : null}
        </Cartao>

        {proximaVisita && (
          <div className="aviso" style={{ marginTop: 14 }}>
            Próxima visita prevista para {dataBR(proximaVisita)}.
          </div>
        )}

        {ultima ? (
          <Cartao olho="Última coleta" titulo={`Análise de ${dataBR(ultima.data_coleta)}`} style={{ marginTop: 14 }}>
            <p className="nota" style={{ margin: '0 0 10px' }}>
              Veja os detalhes completos (réguas, diagnóstico, calagem e adubação) na aba Solo &amp; Nutrição.
            </p>
            <Link className="btn sec mini" href={`/app/analises/${ultima.id}`}>Abrir interpretação</Link>
          </Cartao>
        ) : (
          <Vazio titulo="Nenhuma análise lançada ainda" style={{ marginTop: 14 }}>
            <Link href="/app/analises/nova">Lançar a primeira.</Link>
          </Vazio>
        )}
      </>
    )
  );
}
