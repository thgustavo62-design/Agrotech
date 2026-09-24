'use client';

/**
 * Só pega erro no próprio layout raiz (raríssimo) — precisa da própria
 * <html>/<body> porque substitui o layout inteiro quando entra em ação.
 * Sem next/font aqui de propósito: se o layout raiz quebrou, não arrisca
 * depender de mais nada dele.
 */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#eef1ec', color: '#111a14' }}>
        <div style={{ maxWidth: 480, margin: '15vh auto', padding: '0 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Não deu certo</h1>
          <p style={{ color: '#59635c', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
            {error.message || 'Aconteceu um erro inesperado.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: '10px 18px', borderRadius: 8, border: 0, background: '#0f5c43', color: '#fff', cursor: 'pointer' }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
