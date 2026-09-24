import Link from 'next/link';

export interface ItemPendencia { chave: string; nome: string; texto: string; href?: string }
export interface ColunaPendencias { id: string; titulo: string; tom: 'ruim' | 'alerta' | 'cinza'; itens: ItemPendencia[] }

const COR_BORDA: Record<string, string> = { ruim: 'var(--c-mb)', alerta: 'var(--c-b)', cinza: 'var(--linha-forte)' };

/**
 * Kanban só de leitura — a coluna vem da classificação da análise
 * (crítico/atenção/programado), não é um status que o consultor edite à
 * mão, então não tem drag-and-drop aqui (diferente do Kanban da agenda).
 */
export function KanbanPendencias({ colunas }: { colunas: ColunaPendencias[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {colunas.map((col) => (
        <div
          key={col.id}
          style={{
            minWidth: 250, flex: '1 0 250px', background: 'var(--papel-3)',
            border: '1px solid var(--linha)', borderRadius: 'var(--r)', padding: 10,
          }}
        >
          <div style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'var(--grafite)', marginBottom: 8, display: 'flex', justifyContent: 'space-between',
          }}
          >
            <span>{col.titulo}</span>
            <span>{col.itens.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
            {col.itens.map((it) => (
              <Link
                key={it.chave}
                href={it.href ?? '#'}
                style={{
                  display: 'block', background: '#fff', borderRadius: 'var(--r-p)',
                  border: '1px solid var(--linha)', borderLeftWidth: 3, borderLeftColor: COR_BORDA[col.tom],
                  padding: '10px 12px', color: 'inherit', boxShadow: 'var(--sombra)', textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.nome}</div>
                <div className="nota mono" style={{ marginTop: 2 }}>{it.texto}</div>
              </Link>
            ))}
            {col.itens.length === 0 && (
              <div className="nota" style={{ textAlign: 'center', padding: '16px 0' }}>vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
