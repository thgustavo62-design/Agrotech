import Link from 'next/link';
import { f, dataBR } from '@/lib/formato';
import { nomeCultura } from '@/lib/culturas';
import { Cartao, Tag, Vazio } from '@/components/ui';
import type { ContextoInicioProdutor } from '../dados';
import { ESTADO } from '../dados';

export function SituacaoDosTalhoes({ ctx }: { ctx: ContextoInicioProdutor }) {
  const { lista, precisamCorrecao } = ctx;

  return (
    <Cartao
      olho="Situação"
      titulo={precisamCorrecao.length > 0 ? `${precisamCorrecao.length} talhão(ões) pedem atenção` : 'Nenhum talhão pedindo correção'}
      style={{ marginTop: 14 }}
    >
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum talhão cadastrado">Fale com o seu técnico.</Vazio>
      ) : (
        <div className="lista">
          {lista.slice(0, 6).map((t) => {
            const e = ESTADO[t.situacao] ?? ESTADO.sem_analise!;
            return (
              <div className="item" key={t.talhao_id}>
                <div className="cresce">
                  <h3>{t.nome}</h3>
                  <small>
                    {nomeCultura(t.cultura)} · {f(Number(t.area_ha ?? 0), 1)} ha
                    {t.data_coleta ? ` · análise de ${dataBR(t.data_coleta)}` : ''}
                  </small>
                </div>
                <Tag tom={e.tom}>{e.txt}</Tag>
              </div>
            );
          })}
        </div>
      )}
      {lista.length > 6 && (
        <Link className="btn sec mini" href="/produtor/talhoes" style={{ marginTop: 10 }}>Ver todos os talhões</Link>
      )}
      <p className="nota" style={{ marginTop: 12 }}>
        &ldquo;Precisa de correção&rdquo; significa que a saturação por bases está baixa ou o alumínio
        alto na última análise. Os números técnicos estão no laudo.
      </p>
    </Cartao>
  );
}
