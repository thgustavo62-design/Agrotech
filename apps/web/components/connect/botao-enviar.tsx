'use client';

import { useFormStatus } from 'react-dom';

/** Botão de envio que se desliga enquanto o formulário vai (evita pedido duplicado por duplo clique em sinal fraco). */
export function BotaoEnviar({ children, ocupado = 'Enviando…', className = 'btn verde' }: { children: React.ReactNode; ocupado?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending ? ocupado : children}</button>;
}
