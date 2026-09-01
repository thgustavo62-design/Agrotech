import { redirect } from 'next/navigation';
import { perfilAtual } from '@/lib/supabase/server';

/** Guarda de rota da área do consultor. A barreira real continua sendo a RLS. */
export default async function LayoutConsultor({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/login');
  if (perfil.role !== 'consultor' && perfil.role !== 'admin') redirect('/produtor');

  return (
    <div>
      <header style={{ padding: '11px 20px', background: '#111a14', color: '#eaefe9', display: 'flex', gap: 12 }}>
        <strong>AgroTech</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>
          {perfil.nome ?? 'consultor'} {perfil.crea ? `· CREA ${perfil.crea}` : ''}
        </span>
      </header>
      <nav style={{ display: 'flex', gap: 12, padding: '8px 20px', borderBottom: '1px solid var(--linha)', fontSize: 13 }}>
        <a href="/app">Painel</a>
        <a href="/app/produtores">Produtores</a>
        <a href="/app/talhoes">Talhões</a>
        <a href="/app/laudos">Laudos</a>
        <a href="/app/analises">Análises</a>
        <a href="/app/monitoramento">Monitoramento</a>
        <a href="/app/tabelas">Tabelas</a>
      </nav>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 18px' }}>{children}</main>
    </div>
  );
}
