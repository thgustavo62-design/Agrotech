'use client';

import { useState } from 'react';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { gerarAcessoEquipe } from '../acoes';

/** "Senha esquecida": o proprietário gera o link de nova senha do colega e o entrega por WhatsApp. */
export function GerarAcesso({ id, nome }: { id: string; nome: string | null }) {
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof gerarAcessoEquipe>> | null>(null);

  async function gerar() {
    setBusy(true);
    const fd = new FormData();
    fd.set('id', id);
    try {
      setResultado(await gerarAcessoEquipe(fd));
    } catch {
      setResultado({ ok: false, mensagem: 'Sem conexão. Tente de novo quando houver sinal.' });
    } finally {
      setBusy(false);
    }
  }

  if (resultado?.ok) {
    const msg = `Oi${nome ? `, ${nome.split(' ')[0]}` : ''}! Crie sua nova senha do AgroTech por este link (vale por cerca de 1 hora e só funciona uma vez): ${resultado.link}`;
    return (
      <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
        <p className="aviso" style={{ margin: 0 }}>
          Este link dá acesso à conta de <b>{nome ?? 'esta pessoa'}</b>. Mande só para ela e não o guarde.
        </p>
        <LinkCompartilhado url={resultado.link} />
        <div>
          <a className="btn sec mini" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6 }}>
      <p className="nota" style={{ margin: '0 0 8px' }}>
        {nome ?? 'A pessoa'} esqueceu a senha? Gere um link para ela criar uma nova. Nada é enviado por e-mail.
      </p>
      <button className="btn sec mini" type="button" onClick={gerar} disabled={busy}>
        {busy ? 'Gerando…' : 'Gerar link de nova senha'}
      </button>
      {resultado && !resultado.ok ? <p style={{ color: 'var(--c-mb)', fontSize: 13, margin: '8px 0 0' }}>{resultado.mensagem}</p> : null}
    </div>
  );
}
