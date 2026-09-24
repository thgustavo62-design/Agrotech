'use client';

import { useState, useTransition } from 'react';
import { moverEvento } from '@/app/(consultor)/app/agenda/acoes';

export interface EventoKanban { id: string; titulo: string; subtitulo: string }
export interface ColunaKanban { id: string; titulo: string; dataAlvo: string | null; eventos: EventoKanban[] }

/**
 * Kanban da agenda — arrastar um card pra outra coluna reagenda de verdade
 * (chama moverEvento, só muda agenda_eventos.data). Coluna "Atrasados" não
 * aceita soltar (dataAlvo null) — não faz sentido "reagendar pro passado".
 * Concluir/cancelar continuam na aba Lista, pra não sobrecarregar o card.
 */
export function KanbanAgenda({ colunas }: { colunas: ColunaKanban[] }) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  function soltar(dataAlvo: string | null) {
    if (!arrastando || !dataAlvo) { setArrastando(null); return; }
    const id = arrastando;
    setArrastando(null);
    iniciarTransicao(() => { void moverEvento(id, dataAlvo); });
  }

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {colunas.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => { if (col.dataAlvo) e.preventDefault(); }}
          onDrop={() => soltar(col.dataAlvo)}
          style={{
            minWidth: 230, flex: '1 0 230px', background: 'var(--papel-3)',
            border: '1px solid var(--linha)', borderRadius: 'var(--r)', padding: 10,
          }}
        >
          <div style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'var(--grafite)', marginBottom: 8, display: 'flex', justifyContent: 'space-between',
          }}
          >
            <span>{col.titulo}</span>
            <span>{col.eventos.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
            {col.eventos.map((ev) => (
              <div
                key={ev.id}
                draggable
                onDragStart={() => setArrastando(ev.id)}
                onDragEnd={() => setArrastando(null)}
                style={{
                  background: '#fff', border: '1px solid var(--linha)', borderRadius: 'var(--r-p)',
                  padding: '10px 12px', cursor: 'grab',
                  opacity: arrastando === ev.id ? 0.4 : 1,
                  boxShadow: 'var(--sombra)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.titulo}</div>
                <div className="nota" style={{ marginTop: 2 }}>{ev.subtitulo}</div>
              </div>
            ))}
            {col.eventos.length === 0 && (
              <div className="nota" style={{ textAlign: 'center', padding: '16px 0' }}>vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
