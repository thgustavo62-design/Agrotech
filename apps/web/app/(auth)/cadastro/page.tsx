'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { criarClienteNavegador } from '@/lib/supabase/client';

export default function Cadastro() {
  const router = useRouter();
  const [f, setF] = useState({ nome: '', escritorio: '', crea: '', email: '', senha: '' });
  const [estado, setEstado] = useState<'form' | 'enviando' | 'confirmar'>('form');
  const [erro, setErro] = useState<string | null>(null);

  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setErro(null);
    const sb = criarClienteNavegador();
    const { data, error } = await sb.auth.signUp({
      email: f.email,
      password: f.senha,
      options: { data: { role: 'consultor', nome: f.nome, crea: f.crea, escritorio: f.escritorio } },
    });
    if (error) {
      setErro(error.message);
      setEstado('form');
      return;
    }
    // confirmações desligadas (dev) => já vem sessão
    if (data.session) {
      router.replace('/app');
      return;
    }
    setEstado('confirmar');
  }

  if (estado === 'confirmar') {
    return (
      <div className="tela-login">
        <div className="marca">AgroTech <span>Assistência técnica</span></div>
        <p>
          Enviamos um e-mail de confirmação para <b>{f.email}</b>. Confirme e faça login — na primeira
          entrada o app cria seu escritório e copia as tabelas de referência padrão.
        </p>
        <Link className="btn verde" href="/login" style={{ width: '100%', justifyContent: 'center' }}>Ir para o login</Link>
      </div>
    );
  }

  return (
    <div className="tela-login">
      <div className="marca">AgroTech <span>Assistência técnica</span></div>
      <p>Criar escritório. Já tem conta? <Link href="/login">entrar</Link>.</p>
      <form onSubmit={enviar}>
        <label>Seu nome<input required autoComplete="name" {...campo('nome')} /></label>
        <label>Nome do escritório<input required autoComplete="organization" {...campo('escritorio')} /></label>
        <label>CREA<input {...campo('crea')} /></label>
        <label>E-mail<input type="email" required autoComplete="email" {...campo('email')} /></label>
        <label>Senha<input type="password" required minLength={8} autoComplete="new-password" {...campo('senha')} /></label>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button className="btn verde" type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}
