import Link from 'next/link';
import { Cartao, Tag, Vazio } from '@/components/ui';
import type { ContextoPainel } from '../dados';

export function PrecisaDaSuaAtencao({ ctx }: { ctx: ContextoPainel }) {
  const { p, atencao } = ctx;

  return (
    <Cartao olho="Fila de trabalho" titulo="Precisa da sua atenção" style={{ marginTop: 14 }}>
      {(p.talhoes_sem_analise_atualizada > 0 || p.produtores_sem_visita_recente > 0) && (
        <p className="nota" style={{ margin: '0 0 12px' }}>
          {p.talhoes_sem_analise_atualizada > 0 ? `${p.talhoes_sem_analise_atualizada} talhão(ões) sem análise há mais de 6 meses` : ''}
          {p.talhoes_sem_analise_atualizada > 0 && p.produtores_sem_visita_recente > 0 ? ' · ' : ''}
          {p.produtores_sem_visita_recente > 0 ? `${p.produtores_sem_visita_recente} produtor(es) sem visita há mais de 60 dias` : ''}
        </p>
      )}
      {atencao.length === 0 ? (
        <Vazio titulo="Nada pedindo atenção agora">
          Sem correção pendente, sem laudo represado, sem visita atrasada.
        </Vazio>
      ) : (
        <div className="lista">
          {atencao.map((it) => (
            <div className="item" key={it.chave}>
              <div className="cresce">
                <h3>{it.nome}</h3>
                <small>{it.texto}</small>
              </div>
              <Tag tom={it.tom}>{it.tom === 'ruim' ? 'crítico' : it.tom === 'alerta' ? 'atenção' : 'programado'}</Tag>
              {it.href ? <Link className="btn sec mini" href={it.href}>abrir</Link> : null}
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}
