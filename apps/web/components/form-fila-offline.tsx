'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { enfileirar, ehErroDeRede } from '@/lib/fila-offline';

/**
 * <form> que não perde o que o técnico digitou no campo sem sinal. Envia pela
 * server action; se falhar por conexão, guarda o formulário (com as fotos) na fila
 * do aparelho e o `SincronizadorOffline` reenvia quando o sinal volta. O `children`
 * vem do servidor — o componente só cuida do envio.
 */
export function FormFilaOffline({
  action, children, className, rotuloOk,
}: {
  action: (fd: FormData) => Promise<unknown>;
  children: ReactNode;
  className?: string;
  /** mensagem de sucesso, ex.: "Visita salva." */
  rotuloOk: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tom: 'ok' | 'fila' | 'erro'; txt: string } | null>(null);
  // trocar a key remonta o form e zera inputs de arquivo e o estado dos filhos
  const [geracao, setGeracao] = useState(0);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // a mesma chave vale para a tentativa direta e para a fila: reenvio não duplica
    fd.set('chave_cliente', crypto.randomUUID());
    setBusy(true);
    setMsg(null);
    try {
      await action(fd);
      setMsg({ tom: 'ok', txt: rotuloOk });
      setGeracao((g) => g + 1);
    } catch (err) {
      if (ehErroDeRede(err)) {
        try {
          await enfileirar(fd);
          setMsg({ tom: 'fila', txt: 'Sem sinal: guardei no aparelho e envio sozinho quando a conexão voltar.' });
          setGeracao((g) => g + 1);
        } catch {
          setMsg({ tom: 'erro', txt: 'Sem sinal e não consegui guardar no aparelho. Não feche esta tela.' });
        }
      } else {
        setMsg({ tom: 'erro', txt: err instanceof Error ? err.message : 'Não foi possível salvar.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form key={geracao} onSubmit={enviar} className={className}>
        <fieldset disabled={busy} style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}>
          {children}
        </fieldset>
      </form>
      {msg ? (
        <div className={msg.tom === 'erro' ? 'aviso' : 'nota'} role="status" style={{ marginTop: 8 }}>
          {msg.txt}
        </div>
      ) : null}
    </>
  );
}
