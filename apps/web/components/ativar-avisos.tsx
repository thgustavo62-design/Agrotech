'use client';

import { useCallback, useEffect, useState } from 'react';
import { ativarAvisos, desativarAvisos, enviarAvisoDeTeste } from '@/lib/push-acoes';
import { bytesParaChave, chaveParaBytes, situacaoDosAvisos, type SituacaoDosAvisos } from '@/lib/push-navegador';

/**
 * Liga/desliga os avisos no celular neste aparelho (Web Push). A chave pública vem do servidor; sem ela (avisos não configurados)
 * o bloco nem aparece. No iPhone o aviso só chega com o app instalado na tela inicial — a tela explica.
 */
export function AtivarAvisos({ chavePublica, texto }: { chavePublica: string | null; texto?: string }) {
  const [situacao, setSituacao] = useState<SituacaoDosAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const ler = useCallback(async () => {
    const temServiceWorker = 'serviceWorker' in navigator;
    const temPush = 'PushManager' in window;
    const temNotificacao = 'Notification' in window;
    const ua = navigator.userAgent;
    const ehIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    let assinado = false;
    if (temServiceWorker && temPush) {
      try {
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
        assinado = Boolean(reg && (await reg.pushManager.getSubscription()));
      } catch {
        assinado = false;
      }
    }
    setSituacao(situacaoDosAvisos({ temServiceWorker, temPush, temNotificacao, permissao: temNotificacao ? Notification.permission : 'denied', assinado, ehIos, instalado }));
  }, []);

  useEffect(() => { void ler(); }, [ler]);

  if (!chavePublica || !situacao || situacao === 'sem-suporte') return null;

  async function ligar() {
    if (!chavePublica) return;
    setOcupado(true);
    setMensagem(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') { await ler(); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) as unknown as BufferSource }));
      const r = await ativarAvisos({ endpoint: sub.endpoint, p256dh: bytesParaChave(sub.getKey('p256dh')), auth: bytesParaChave(sub.getKey('auth')), agente: navigator.userAgent });
      if (!r.ok) { await sub.unsubscribe().catch(() => undefined); setMensagem({ ok: false, texto: r.erro }); }
      else setMensagem({ ok: true, texto: 'Pronto! Você vai receber os avisos neste aparelho.' });
    } catch {
      setMensagem({ ok: false, texto: 'Não foi possível ligar os avisos neste navegador. Tente de novo ou use outro navegador.' });
    } finally {
      setOcupado(false);
      await ler();
    }
  }

  async function desligar() {
    setOcupado(true);
    setMensagem(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await desativarAvisos(sub.endpoint); await sub.unsubscribe(); }
      setMensagem({ ok: true, texto: 'Avisos desligados neste aparelho.' });
    } catch {
      setMensagem({ ok: false, texto: 'Não foi possível desligar agora. Tente de novo.' });
    } finally {
      setOcupado(false);
      await ler();
    }
  }

  async function testar() {
    setOcupado(true);
    setMensagem(null);
    const r = await enviarAvisoDeTeste();
    setMensagem(r.ok ? { ok: true, texto: 'Aviso de teste enviado. Se não apareceu em alguns segundos, desligue e ligue de novo.' } : { ok: false, texto: r.erro });
    setOcupado(false);
  }

  return (
    <section className="avisos-celular" aria-label="Avisos no celular" data-situacao={situacao}>
      <div className="avisos-celular-texto">
        <b>Avisos no celular</b>
        {situacao === 'ligado' ? <p>Ligados neste aparelho: você recebe um aviso mesmo com o site fechado.</p> : null}
        {situacao === 'desligado' ? <p>{texto ?? 'Receba um aviso no celular quando houver novidade para você, mesmo com o site fechado.'}</p> : null}
        {situacao === 'bloqueado' ? <p>Os avisos estão bloqueados neste navegador. Para ligar, libere as notificações nas configurações do site (o cadeado ao lado do endereço) e volte aqui.</p> : null}
        {situacao === 'precisa-instalar' ? <p>No iPhone, os avisos só chegam com o AgroTech instalado: toque em Compartilhar e depois em &ldquo;Adicionar à Tela de Início&rdquo;, abra o app por lá e ligue os avisos.</p> : null}
        {mensagem ? <p role="status" className={mensagem.ok ? 'avisos-celular-ok' : 'avisos-celular-erro'}>{mensagem.texto}</p> : null}
      </div>
      <div className="avisos-celular-acoes">
        {situacao === 'desligado' ? <button type="button" className="btn verde" onClick={ligar} disabled={ocupado}>{ocupado ? 'Ligando…' : 'Ligar avisos'}</button> : null}
        {situacao === 'ligado' ? (
          <>
            <button type="button" className="btn sec" onClick={testar} disabled={ocupado}>Enviar aviso de teste</button>
            <button type="button" className="btn sec" onClick={desligar} disabled={ocupado}>Desligar</button>
          </>
        ) : null}
      </div>
    </section>
  );
}
