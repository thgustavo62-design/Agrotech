'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rotaAtiva } from '@/lib/navegacao';

const ITENS = [
  { href: '/produtor', rotulo: 'Início' },
  { href: '/produtor/fazenda', rotulo: 'Minha fazenda' },
  { href: '/produtor/talhoes', rotulo: 'Talhões' },
  { href: '/produtor/recomendacoes', rotulo: 'Recomendações' },
  { href: '/produtor/atividades', rotulo: 'Atividades' },
  { href: '/produtor/financeiro', rotulo: 'Financeiro' },
  { href: '/produtor/producao', rotulo: 'Produção' },
  { href: '/produtor/documentos', rotulo: 'Documentos' },
];

/** Menu simples do portal do produtor — sem grupos, de propósito (UX_ARCHITECTURE.md §1.2). */
export function NavProdutor() {
  const path = usePathname();

  return (
    <nav style={{ display: 'flex', gap: 16, overflowX: 'auto', fontSize: 13.5, scrollbarWidth: 'none' }}>
      {ITENS.map((it) => {
        const ativo = path ? rotaAtiva(path, it.href) : false;
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              color: ativo ? '#fff' : '#9db8a8',
              fontWeight: ativo ? 700 : 500,
              whiteSpace: 'nowrap',
              borderBottom: ativo ? '2px solid #7fc6a3' : '2px solid transparent',
              paddingBottom: 3,
            }}
          >
            {it.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
