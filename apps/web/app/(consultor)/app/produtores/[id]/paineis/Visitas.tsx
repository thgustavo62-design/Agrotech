import { dataBR } from '@/lib/formato';
import { Tag, Vazio } from '@/components/ui';
import type { ContextoProdutor } from '../dados';

export function PainelVisitas({ ctx }: { ctx: ContextoProdutor }) {
  const { talhoes, visitas } = ctx;

  return (
    visitas.length === 0 ? (
      <Vazio titulo="Nenhuma visita registrada para este produtor">
        Para registrar uma visita, abra um talhão deste produtor e use &ldquo;Registrar visita&rdquo; (aceita fotos e localização, e funciona sem sinal).
      </Vazio>
    ) : (
      <div className="lista">
        {visitas.map((v) => {
          const talhao = talhoes.find((t) => t.id === v.talhao_id);
          const acima = v.ocorrencias.filter((o) => o.acima_nivel).length;
          return (
            <div className="item" key={v.id}>
              <div className="cresce">
                <h3>{talhao?.nome ?? 'Talhão'} — {dataBR(v.data)}</h3>
                <small>{v.fenologia ?? 'estádio não informado'} · condição {v.condicao ?? '—'}</small>
              </div>
              {acima > 0 ? <Tag tom="ruim">{acima} acima do nível</Tag> : <Tag>sob controle</Tag>}
            </div>
          );
        })}
      </div>
    )
  );
}
