import Link from 'next/link';

/** Sino de notificações — link simples pro centro de notificações, com contagem de não lidas. Sem popover: revalida no carregamento de página (PRODUCT_V2.md §2.6). */
export function SinoNotificacoes({ href, contagem }: { href: string; contagem: number }) {
  return (
    <Link href={href} style={{ position: 'relative', color: 'inherit', fontSize: 17, lineHeight: 1, display: 'inline-flex' }}>
      🔔
      {contagem > 0 && (
        <span
          style={{
            position: 'absolute', top: -6, right: -8, minWidth: 15, height: 15, padding: '0 3px',
            borderRadius: 99, background: 'var(--c-mb)', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >
          {contagem > 9 ? '9+' : contagem}
        </span>
      )}
    </Link>
  );
}
