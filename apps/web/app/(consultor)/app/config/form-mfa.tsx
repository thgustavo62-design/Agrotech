'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { sincronizarMfa } from './acoes';

type Estado =
  | { etapa: 'carregando' }
  | { etapa: 'desligada' }
  | { etapa: 'configurando'; fatorId: string; qr: string; segredo: string }
  | { etapa: 'ligada'; fatorId: string };

/**
 * Verificação em duas etapas (TOTP — Google Authenticator, Microsoft Authenticator, Authy…). Opcional por pessoa,
 * recomendada ao proprietário e a quem emite laudos. Ligada, o login pede o código e o banco só entrega dados a
 * sessões que passaram por ele (migration 0044). Roda no navegador: quem fala com o Auth é a sessão da própria pessoa.
 */
export function FormMfa() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ etapa: 'carregando' });
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await criarClienteNavegador().auth.mfa.listFactors();
    if (error) { setErro('Não foi possível ler o estado da verificação. Recarregue a página.'); return; }
    const ativo = data?.totp?.[0];
    setEstado(ativo ? { etapa: 'ligada', fatorId: ativo.id } : { etapa: 'desligada' });
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function comecar() {
    setOcupado(true); setErro(null);
    const sb = criarClienteNavegador();
    // uma tentativa abandonada antes deixa um fator "não confirmado": limpa para não dar conflito de nome
    const { data: todos } = await sb.auth.mfa.listFactors();
    for (const f of (todos?.all ?? []).filter((x) => x.status === 'unverified')) await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `AgroTech ${new Date().toLocaleDateString('pt-BR')}` });
    setOcupado(false);
    if (error || !data) { setErro('Não foi possível iniciar. Tente de novo em instantes.'); return; }
    setCodigo('');
    setEstado({ etapa: 'configurando', fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.etapa !== 'configurando' || !/^\d{6}$/.test(codigo)) return;
    setOcupado(true); setErro(null);
    const { error } = await criarClienteNavegador().auth.mfa.challengeAndVerify({ factorId: estado.fatorId, code: codigo });
    setOcupado(false);
    if (error) { setErro('Código incorreto ou vencido. Confira o código atual no aplicativo.'); setCodigo(''); return; }
    await sincronizarMfa().catch(() => undefined); // espelha no perfil (o banco passa a exigir o código)
    setEstado({ etapa: 'ligada', fatorId: estado.fatorId });
    router.refresh();
  }

  async function cancelar() {
    if (estado.etapa === 'configurando') await criarClienteNavegador().auth.mfa.unenroll({ factorId: estado.fatorId });
    setCodigo(''); setErro(null);
    await carregar();
  }

  async function desligar() {
    if (estado.etapa !== 'ligada') return;
    if (!window.confirm('Desligar a verificação em duas etapas? A conta volta a depender só da senha.')) return;
    setOcupado(true); setErro(null);
    const { error } = await criarClienteNavegador().auth.mfa.unenroll({ factorId: estado.fatorId });
    setOcupado(false);
    if (error) { setErro('Não foi possível desligar agora. Entre de novo (com o código) e tente outra vez.'); return; }
    await sincronizarMfa().catch(() => undefined);
    await carregar();
    router.refresh();
  }

  if (estado.etapa === 'carregando') return <p className="nota" style={{ margin: 0 }}>Carregando…</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {estado.etapa === 'desligada' ? (
        <>
          <p className="nota" style={{ margin: 0 }}>
            Hoje a sua conta depende só da senha. Com a verificação em duas etapas, quem descobrir a senha ainda precisa do código do seu celular.
          </p>
          <div><button className="btn verde" type="button" onClick={comecar} disabled={ocupado}>Ativar verificação em duas etapas</button></div>
        </>
      ) : null}

      {estado.etapa === 'configurando' ? (
        <form onSubmit={confirmar} style={{ display: 'grid', gap: 10 }} noValidate>
          <ol className="nota" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Instale um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Authy).</li>
            <li>Escaneie o código abaixo (ou digite a chave).</li>
            <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL gerado pelo Auth */}
          <img src={estado.qr} alt="QR code para o aplicativo autenticador" width={180} height={180} style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--linha)' }} />
          <p className="nota" style={{ margin: 0 }}>Chave: <code style={{ userSelect: 'all' }}>{estado.segredo}</code></p>
          <div className="campo" style={{ maxWidth: 220 }}>
            <label htmlFor="mfa_codigo">Código de 6 dígitos</label>
            <input id="mfa_codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn verde" type="submit" disabled={ocupado || codigo.length !== 6}>Confirmar e ativar</button>
            <button className="btn sec" type="button" onClick={cancelar} disabled={ocupado}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {estado.etapa === 'ligada' ? (
        <>
          <p className="nota" style={{ margin: 0, color: 'var(--folha)' }}>
            <b>Ativada.</b> No login, depois da senha, o sistema pede o código do aplicativo. Guarde um jeito de recuperar o acesso: se perder o celular, outro proprietário ou o responsável pelo sistema precisa remover a verificação da sua conta.
          </p>
          <div><button className="btn sec" type="button" onClick={desligar} disabled={ocupado}>Desligar</button></div>
        </>
      ) : null}

      {erro ? <p style={{ color: 'var(--c-mb)', fontSize: 13, margin: 0 }} role="alert">{erro}</p> : null}
    </div>
  );
}
