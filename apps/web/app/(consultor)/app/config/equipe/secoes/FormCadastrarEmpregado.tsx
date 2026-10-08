'use client';

import { useRef, useState, type ReactNode } from 'react';
import { LinkCompartilhado } from '@/components/link-compartilhado';
import { regrasDaSenha } from '@/lib/senha';
import { cadastrarEmpregado } from '../acoes';
import { CampoSenhaGerada } from './CampoSenhaGerada';

/**
 * Cadastro direto do empregado: nome, e-mail, cargo, perfis (vêm prontos do servidor em `children`) e a senha
 * inicial. Depois de criar, mostra o acesso (e-mail + senha) e uma mensagem pronta para o WhatsApp —
 * é a única vez em que a senha aparece; ela não fica guardada em lugar nenhum.
 */
export function FormCadastrarEmpregado({ children, site }: { children: ReactNode; site: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [geracao, setGeracao] = useState(0); // trocar a key limpa o formulário depois de cadastrar

  const senhaOk = regrasDaSenha(senha).every((r) => r.ok);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!senhaOk) {
      setErro('A senha precisa ter pelo menos 8 caracteres, com letras e números.');
      return;
    }
    setBusy(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    fd.set('senha', senha);
    try {
      const r = await cadastrarEmpregado(fd);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setCriado({ nome: r.nome, email: r.email, senha });
      setSenha('');
      setGeracao((g) => g + 1);
    } catch {
      setErro('Sem conexão. Tente de novo quando houver sinal.');
    } finally {
      setBusy(false);
    }
  }

  const entrada = `${site}/login`;
  const mensagem = criado
    ? `Oi, ${criado.nome.split(' ')[0]}! Seu acesso ao AgroTech está pronto.\nEntre em: ${entrada}\nE-mail: ${criado.email}\nSenha: ${criado.senha}\nNo primeiro acesso o sistema pede para você criar a sua própria senha.`
    : '';

  return (
    <>
      {criado ? (
        <div className="aviso" role="status" style={{ marginBottom: 14 }}>
          <b>{criado.nome} foi cadastrado(a).</b> Passe o acesso abaixo — a senha é provisória (a pessoa cria a própria no primeiro acesso) e não aparece de novo.
          <div style={{ display: 'grid', gap: 6, margin: '10px 0' }}>
            <div><small>Endereço</small><LinkCompartilhado url={entrada} /></div>
            <div><small>E-mail</small><LinkCompartilhado url={criado.email} /></div>
            <div><small>Senha</small><LinkCompartilhado url={criado.senha} /></div>
          </div>
          <a className="btn verde mini" href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>{' '}
          <button className="btn sec mini" type="button" onClick={() => setCriado(null)}>Fechar</button>
        </div>
      ) : null}

      <form key={geracao} ref={form} onSubmit={enviar} noValidate>
        <fieldset disabled={busy} style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}>
          <div className="grade g2">
            <div className="campo">
              <label htmlFor="ce_nome">Nome completo</label>
              <input id="ce_nome" name="nome" required maxLength={80} autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="ce_email">E-mail (é o login da pessoa)</label>
              <input id="ce_email" name="email" type="email" required autoComplete="off" inputMode="email" autoCapitalize="off" />
            </div>
            <div className="campo">
              <label htmlFor="ce_titulo">Cargo <span className="un">(opcional)</span></label>
              <input id="ce_titulo" name="titulo" maxLength={60} placeholder="Agrônomo, técnico de campo…" autoComplete="off" />
            </div>
            <CampoSenhaGerada id="ce_senha" rotulo="Senha inicial" valor={senha} aoMudar={setSenha} />
          </div>
          <label style={{ marginTop: 14 }}>O que esta pessoa vai poder fazer (pode marcar mais de um)</label>
          {children}
          {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, margin: '0 0 10px' }} role="alert">{erro}</p> : null}
          <button className="btn verde" type="submit" disabled={busy}>{busy ? 'Cadastrando…' : 'Cadastrar empregado'}</button>
        </fieldset>
      </form>
    </>
  );
}
