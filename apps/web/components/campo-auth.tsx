'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconeOlho, IconeOlhoFechado } from '@/components/icones';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { icone: ReactNode };

/** Input com ícone à esquerda — usado nas telas de autenticação (tela-auth). */
export function CampoAuth({ icone, ...props }: Props & { type?: 'text' | 'email' }) {
  return (
    <div className="campo-auth">
      <span className="campo-auth-icone">{icone}</span>
      <input {...props} />
    </div>
  );
}

/** Como CampoAuth, mas para senha — com botão de mostrar/ocultar. */
export function CampoSenha({ icone, ...props }: Props) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="campo-auth">
      <span className="campo-auth-icone">{icone}</span>
      <input type={mostrar ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="campo-auth-alterna"
        onClick={() => setMostrar((v) => !v)}
        aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {mostrar ? <IconeOlhoFechado width={17} height={17} /> : <IconeOlho width={17} height={17} />}
      </button>
    </div>
  );
}
