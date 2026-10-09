import Link from 'next/link';

export default function InicioConnect() {
  return (
    <main style={{ maxWidth: 640, margin: '14vh auto', padding: '0 22px', textAlign: 'center' }}>
      <h1>AgroTech Connect</h1>
      <p>Pedidos ao seu técnico, fila de atendimento e retorno — chegando em breve.</p>
      <Link className="btn verde" href="/sites">Trocar de site</Link>
    </main>
  );
}
