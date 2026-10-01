'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EVENTO_FILA, listar, remover, sincronizar, type ItemFila } from '@/lib/fila-offline';
import { registrarVisita } from '@/app/(consultor)/app/talhoes/[id]/acoes';

/**
 * Reenvia a fila offline (hoje: visitas) ao abrir o app, quando o sinal volta e
 * sob demanda. Mostra uma faixa só quando há algo pendente. Itens que o servidor
 * recusou ficam visíveis com o motivo, para o técnico decidir descartar.
 */
export function SincronizadorOffline() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [enviando, setEnviando] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      setItens(await listar());
    } catch {
      setItens([]); // sem IndexedDB (navegação privada antiga): sem fila, sem faixa
    }
  }, []);

  const enviar = useCallback(async () => {
    if (enviando || !navigator.onLine) return;
    setEnviando(true);
    try {
      // trava entre abas para não reenviar o mesmo item em paralelo
      const rodar = async () => {
        const r = await sincronizar(registrarVisita);
        if (r.enviadas > 0) router.refresh();
      };
      if (navigator.locks) await navigator.locks.request('agrotech-fila', { ifAvailable: true }, async (lock) => { if (lock) await rodar(); });
      else await rodar();
    } finally {
      setEnviando(false);
      await atualizar();
    }
  }, [enviando, router, atualizar]);

  useEffect(() => {
    void atualizar().then(() => enviar());
    const aoVoltar = () => void enviar();
    window.addEventListener('online', aoVoltar);
    window.addEventListener(EVENTO_FILA, atualizar);
    return () => {
      window.removeEventListener('online', aoVoltar);
      window.removeEventListener(EVENTO_FILA, atualizar);
    };
    // roda uma vez ao montar; `enviar` muda de identidade a cada estado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (itens.length === 0) return null;
  const recusadas = itens.filter((i) => i.erro);

  return (
    <div className="aviso nao-imprime" role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 70, zIndex: 50 }}>
      <b>{itens.length} visita(s) aguardando envio.</b>{' '}
      {enviando ? 'Enviando…' : navigator.onLine ? '' : 'Sem sinal — envio automático quando voltar.'}
      {recusadas.length > 0 ? <> {recusadas.length} recusada(s): {recusadas[0]!.erro}</> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button className="btn mini verde" type="button" disabled={enviando} onClick={() => void enviar()}>Enviar agora</button>
        {recusadas.length > 0 ? (
          <button
            className="btn mini sec" type="button"
            onClick={async () => { for (const i of recusadas) await remover(i.id); }}
          >
            Descartar recusadas
          </button>
        ) : null}
      </div>
    </div>
  );
}
