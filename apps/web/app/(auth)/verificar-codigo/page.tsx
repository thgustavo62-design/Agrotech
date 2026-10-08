'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { TelaAuth } from '@/components/tela-auth';
import { CampoAuth } from '@/components/campo-auth';
import { IconeAgenda, IconeCadeado, IconeLaudos, IconeProdutores } from '@/components/icones';

const RECURSOS = [
  { icone: <IconeAgenda />, titulo: 'Agenda de campo', descricao: 'Organize visitas e acompanhe as atividades do escritório.' },
  { icone: <IconeLaudos />, titulo: 'Laudos e análises', descricao: 'Registre e gerencie análises técnicas de forma simples.' },
  { icone: <IconeProdutores />, titulo: 'Produtores e propriedades', descricao: 'Os mesmos clientes do escritório, todos em um só lugar.' },
];

/**
 * Segunda etapa do login (verificação em duas etapas). A senha já foi aceita; falta o código de 6 dígitos do aplicativo
 * autenticador. Enquanto a sessão for só de senha (aal1) o banco não entrega dado nenhum — esta tela só leva ao aal2.
 */
export default function VerificarCodigo() {
  const router = useRouter();
  const [fator, setFator] = useState<string | null | 'nenhum'>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const sb = criarClienteNavegador();
    void sb.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) return void router.replace('/login');
      const totp = data?.totp?.[0]; // só fatores confirmados
      setFator(totp ? totp.id : 'nenhum');
    });
  }, [router]);

  useEffect(() => {
    if (fator === 'nenhum') router.replace('/app');
  }, [fator, router]);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!fator || fator === 'nenhum' || !/^\d{6}$/.test(codigo)) return;
    setEnviando(true);
    setErro(null);
    const { error } = await criarClienteNavegador().auth.mfa.challengeAndVerify({ factorId: fator, code: codigo });
    setEnviando(false);
    if (error) {
      setErro('Código incorreto ou vencido. Abra o aplicativo autenticador e digite o código atual.');
      setCodigo('');
      return;
    }
    router.replace('/app');
    router.refresh();
  }

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.replace('/login');
  }

  return (
    <TelaAuth
      imagem="/banners/tecnico-campo.jpg"
      tagline="Assistência técnica"
      headline={<>Gestão técnica, visitas, análises e laudos <em>em um só lugar.</em></>}
      descricao="Mais produtividade para o seu dia a dia no campo com uma plataforma completa e fácil de usar."
      recursos={RECURSOS}
      titulo="Verificação em duas etapas"
      legenda="Digite o código de 6 dígitos que aparece no aplicativo autenticador do seu celular."
    >
      <form onSubmit={verificar} noValidate>
        <label>
          Código
          <CampoAuth
            icone={<IconeCadeado width={16} height={16} />}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="000000" autoFocus
          />
        </label>
        {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, marginTop: 12 }} role="alert">{erro}</p> : null}
        <button type="submit" className="btn verde" disabled={enviando || fator === null || codigo.length !== 6}>
          {enviando ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
      <p className="tela-auth-rodape">
        Perdeu o celular? Peça a outro proprietário do escritório ou ao responsável pelo sistema para remover a verificação da sua conta.{' '}
        <button type="button" className="link-sair" style={{ color: 'var(--folha)' }} onClick={sair}>Sair</button>
      </p>
    </TelaAuth>
  );
}
