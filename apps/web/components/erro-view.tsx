'use client';

/**
 * Corpo compartilhado dos error.tsx (raiz, consultor, produtor). Sem essa
 * tela, qualquer Error lançado numa server action (validação, RLS, trigger
 * do banco) virava a tela de erro genérica do Next — feia e sem a mensagem
 * de verdade. error.tsx é obrigatoriamente client component.
 */
export function ErroView({ error, reset, voltarHref = '/' }: { error: Error; reset: () => void; voltarHref?: string }) {
  return (
    <div style={{ maxWidth: 480, margin: '15vh auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, background: 'var(--c-mb, #b4342a)', borderRadius: 8,
        margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 16, height: 16, background: '#fff', borderRadius: 3, transform: 'rotate(45deg)' }} />
      </div>
      <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Não deu certo</h1>
      <p style={{ color: 'var(--grafite, #59635c)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
        {error.message || 'Aconteceu um erro inesperado.'}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn verde" type="button" onClick={() => reset()}>Tentar de novo</button>
        <a className="btn sec" href={voltarHref}>Voltar ao início</a>
      </div>
    </div>
  );
}
