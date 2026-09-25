'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { TelaAuth } from '@/components/tela-auth';
import { CampoAuth, CampoSenha } from '@/components/campo-auth';
import { FOTO_PRODUTOR } from '@/components/banner-hero';
import { IconeAnalises, IconeCadeado, IconeEmail, IconeFinanceiro, IconeTalhoes } from '@/components/icones';

export default function LoginProdutor() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const sb = criarClienteNavegador();
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro('E-mail ou senha inválidos.');
      return;
    }
    router.replace('/produtor');
  }

  return (
    <TelaAuth
      imagem={FOTO_PRODUTOR}
      tagline="Sua lavoura"
      headline={<>Seus talhões, análises e resultados <em>em um só lugar.</em></>}
      descricao="Acompanhe o trabalho do seu técnico e a situação da sua lavoura direto do celular."
      recursos={[
        { icone: <IconeTalhoes />, titulo: 'Seus talhões', descricao: 'Área, cultura e situação de cada talhão da sua propriedade.' },
        { icone: <IconeAnalises />, titulo: 'Análises de solo', descricao: 'Resultados e recomendações explicados em linguagem simples.' },
        { icone: <IconeFinanceiro />, titulo: 'Financeiro da lavoura', descricao: 'Custos e receitas da sua produção, separados do seu técnico.' },
      ]}
      titulo="Entrar na sua conta"
      legenda="Entrada do produtor. O acesso é criado pelo seu técnico."
    >
      <form onSubmit={entrar}>
        <label>
          E-mail
          <CampoAuth icone={<IconeEmail width={16} height={16} />} type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <CampoSenha icone={<IconeCadeado width={16} height={16} />} placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }}>{erro}</p> : null}
        <button className="btn verde" type="submit" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </TelaAuth>
  );
}
