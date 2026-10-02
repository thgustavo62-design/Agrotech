'use client';

import { useState } from 'react';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { regrasDaSenha } from '@/lib/senha';
import { definirSenhaEquipe, gerarAcessoEquipe } from '../acoes';
import { CampoSenhaGerada } from './CampoSenhaGerada';

/**
 * "Senha esquecida": o proprietário define uma nova senha para o colega (vale na hora, o mais simples) ou gera
 * um link para a própria pessoa criar a dela. Nada é enviado por e-mail.
 */
export function GerarAcesso({ id, nome, site }: { id: string; nome: string | null; site: string }) {
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState<'senha' | 'link' | null>(null);
  const [definida, setDefinida] = useState<{ email: string; senha: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const primeiro = nome?.split(' ')[0] ?? '';
  const senhaOk = regrasDaSenha(senha).every((r) => r.ok);

  async function definir() {
    setBusy('senha');
    setErro(null);
    const fd = new FormData();
    fd.set('id', id);
    fd.set('senha', senha);
    try {
      const r = await definirSenhaEquipe(fd);
      if (!r.ok) setErro(r.mensagem);
      else { setDefinida({ email: r.email, senha }); setSenha(''); }
    } catch {
      setErro('Sem conexão. Tente de novo quando houver sinal.');
    } finally {
      setBusy(null);
    }
  }

  async function gerarLink() {
    setBusy('link');
    setErro(null);
    const fd = new FormData();
    fd.set('id', id);
    try {
      const r = await gerarAcessoEquipe(fd);
      if (!r.ok) setErro(r.mensagem);
      else setLink(r.link);
    } catch {
      setErro('Sem conexão. Tente de novo quando houver sinal.');
    } finally {
      setBusy(null);
    }
  }

  const msgSenha = definida
    ? `Oi${primeiro ? `, ${primeiro}` : ''}! Sua nova senha do AgroTech.\nEntre em: ${site}/login\nE-mail: ${definida.email}\nSenha: ${definida.senha}\nDepois de entrar, troque a senha em Configurações → Meu perfil.`
    : '';
  const msgLink = link
    ? `Oi${primeiro ? `, ${primeiro}` : ''}! Crie sua nova senha do AgroTech por este link (vale por cerca de 1 hora e só funciona uma vez): ${link}`
    : '';

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 6 }}>
      {definida ? (
        <div className="aviso" role="status" style={{ margin: 0 }}>
          <b>Senha de {nome ?? 'esta pessoa'} alterada.</b> Passe o acesso — a senha não aparece de novo.
          <div style={{ display: 'grid', gap: 6, margin: '8px 0' }}>
            <LinkCompartilhado url={definida.email} />
            <LinkCompartilhado url={definida.senha} />
          </div>
          <a className="btn verde mini" href={`https://wa.me/?text=${encodeURIComponent(msgSenha)}`} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
        </div>
      ) : (
        <div>
          <p className="nota" style={{ margin: '0 0 8px' }}>{nome ?? 'A pessoa'} esqueceu a senha? Defina uma nova — vale na hora.</p>
          <CampoSenhaGerada id={`sn-${id}`} rotulo="Nova senha" valor={senha} aoMudar={setSenha} />
          <button className="btn verde mini" type="button" onClick={definir} disabled={!senhaOk || busy !== null}>
            {busy === 'senha' ? 'Salvando…' : 'Definir nova senha'}
          </button>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--linha)', paddingTop: 10 }}>
        {link ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="aviso" style={{ margin: 0 }}>
              Este link dá acesso à conta de <b>{nome ?? 'esta pessoa'}</b>. Mande só para ela e não o guarde.
            </p>
            <LinkCompartilhado url={link} />
            <div>
              <a className="btn sec mini" href={`https://wa.me/?text=${encodeURIComponent(msgLink)}`} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
            </div>
          </div>
        ) : (
          <>
            <p className="nota" style={{ margin: '0 0 8px' }}>Ou deixe que a própria pessoa escolha: gere um link de nova senha.</p>
            <button className="btn sec mini" type="button" onClick={gerarLink} disabled={busy !== null}>
              {busy === 'link' ? 'Gerando…' : 'Gerar link de nova senha'}
            </button>
          </>
        )}
      </div>
      {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, margin: 0 }} role="alert">{erro}</p> : null}
    </div>
  );
}
