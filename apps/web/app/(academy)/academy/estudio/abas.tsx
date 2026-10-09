'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rotaAtiva } from '@/lib/navegacao';

const ABAS = [
  { href: '/academy/estudio', rotulo: 'Visão geral', exato: true },
  { href: '/academy/estudio/cursos', rotulo: 'Cursos' },
  { href: '/academy/estudio/conteudos', rotulo: 'Conteúdos' },
];

export function AbasDoEstudio() {
  const path = usePathname() ?? '';
  return (
    <nav className="ac-estudio-abas" aria-label="Estúdio">
      {ABAS.map((a) => {
        const ativa = a.exato ? path === a.href : rotaAtiva(path, a.href);
        return <Link key={a.href} href={a.href} data-ativa={ativa} aria-current={ativa ? 'page' : undefined}>{a.rotulo}</Link>;
      })}
    </nav>
  );
}
