import Link from 'next/link';
import { Cartao, Vazio } from '@/components/ui';
import type { ContextoInicioProdutor } from '../dados';

export function PrecisaDaSuaAtencao({ ctx }: { ctx: ContextoInicioProdutor }) {
  const { atencao } = ctx;

  return (
    <Cartao olho="Fique de olho" titulo="Precisa da sua atenção">
      {atencao.length === 0 ? (
        <Vazio titulo="Nada pedindo atenção agora" />
      ) : (
        <div className="lista">
          {atencao.map((it) => (
            <div className="item" key={it.chave}>
              <div className="cresce"><p style={{ margin: 0 }}>{it.texto}</p></div>
              {it.href ? <Link className="btn sec mini" href={it.href}>ver</Link> : null}
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}
