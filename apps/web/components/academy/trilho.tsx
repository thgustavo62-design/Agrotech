import Link from 'next/link';
import type { ReactNode } from 'react';

/** Uma faixa da vitrine: título, "ver todos" e os cartões rolando na horizontal (no celular, com o dedo). */
export function Trilho({ titulo, subtitulo, verTodos, children, rolagem = true }: {
  titulo: string;
  subtitulo?: string;
  verTodos?: { href: string; rotulo?: string };
  children: ReactNode;
  rolagem?: boolean;
}) {
  return (
    <section className="ac-secao">
      <header className="ac-secao-cabecalho">
        <div>
          <h2>{titulo}</h2>
          {subtitulo ? <p>{subtitulo}</p> : null}
        </div>
        {verTodos ? <Link href={verTodos.href}>{verTodos.rotulo ?? 'Ver todos'} →</Link> : null}
      </header>
      <div className={rolagem ? 'ac-trilho' : 'ac-grade'}>{children}</div>
    </section>
  );
}
