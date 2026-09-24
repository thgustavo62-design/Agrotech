export default function Offline() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 360, textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, background: '#0f5c43', borderRadius: 8,
          margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 16, height: 16, background: '#eef1ec', borderRadius: 3, transform: 'rotate(45deg)' }} />
        </div>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Sem conexão</h1>
        <p style={{ color: '#59635c', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Esta página ainda não tinha sido aberta antes, então não dá pra ver sem internet.
          Páginas que você já visitou continuam disponíveis. Tente de novo quando o sinal voltar.
        </p>
      </div>
    </div>
  );
}
