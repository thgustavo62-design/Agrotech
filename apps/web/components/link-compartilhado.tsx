'use client';

import { useState } from 'react';

/** Mostra o link público com botão de copiar. */
export function LinkCompartilhado({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
      <code
        style={{
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 12, background: 'var(--papel-3)', border: '1px solid var(--linha)',
          borderRadius: 6, padding: '5px 8px',
        }}
      >
        {url}
      </code>
      <button type="button" className="btn sec mini" onClick={copiar}>
        {copiado ? 'copiado ✓' : 'copiar'}
      </button>
    </div>
  );
}
