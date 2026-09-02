'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ABAS: Array<[string, string]> = [
  ['/app', 'Painel'],
  ['/app/produtores', 'Produtores'],
  ['/app/talhoes', 'Talhões'],
  ['/app/laudos', 'Laudos'],
  ['/app/analises', 'Análises'],
  ['/app/monitoramento', 'Monitoramento'],
  ['/app/tabelas', 'Tabelas'],
  ['/app/assinatura', 'Assinatura'],
];

export function NavAbas() {
  const path = usePathname();
  return (
    <nav className="abas">
      {ABAS.map(([href, rot]) => {
        const ativa = href === '/app' ? path === '/app' : path.startsWith(href);
        return (
          <Link key={href} href={href} className="aba" data-ativa={ativa}>
            {rot}
          </Link>
        );
      })}
    </nav>
  );
}
