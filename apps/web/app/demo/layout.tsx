import Link from 'next/link';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="topo">
        <div className="marca">AgroTech <span>Assistência técnica</span></div>
        <div className="quem">
          <b>Vitrine</b>
          <Link href="/login" style={{ color: '#7fc6a3' }}>entrar no app</Link>
        </div>
      </header>
      <nav className="abas">
        <span className="aba" data-ativa="true">Interpretação</span>
        <Link className="aba" href="/demo/tabelas">Tabelas de referência</Link>
      </nav>
      <main className="vista">{children}</main>
    </div>
  );
}
