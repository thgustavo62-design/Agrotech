import { Vazio } from '@/components/ui';
import type { ContextoTalhao } from '../dados';

export function PainelFotos({ ctx }: { ctx: ContextoTalhao }) {
  const { todasFotos, urlsFotos } = ctx;

  return (
    todasFotos.length === 0 ? (
      <Vazio titulo="Nenhuma foto registrada" />
    ) : (
      <div className="grade g4">
        {todasFotos.map((ft) => {
          const url = urlsFotos.get(ft.storage_path);
          return (
            <div className="cartao" key={ft.id} style={{ padding: 8 }}>
              {/* URL assinada do Storage, host desconhecido em build-time — next/image exigiria remotePatterns por projeto */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url ? <img src={url} alt={ft.legenda ?? 'foto da visita'} style={{ width: '100%', borderRadius: 6, display: 'block' }} /> : null}
              {ft.legenda ? <p className="nota" style={{ margin: '6px 0 0' }}>{ft.legenda}</p> : null}
              {ft.lat != null && ft.lng != null ? (
                <p className="nota" style={{ margin: '4px 0 0' }}>
                  <a href={`https://www.openstreetmap.org/?mlat=${ft.lat}&mlon=${ft.lng}#map=17/${ft.lat}/${ft.lng}`} target="_blank" rel="noopener noreferrer">
                    📍 {Number(ft.lat).toFixed(5)}, {Number(ft.lng).toFixed(5)}
                  </a>
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    )
  );
}
