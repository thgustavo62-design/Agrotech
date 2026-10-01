'use client';

/**
 * Corpo compartilhado dos error.tsx (raiz, consultor, produtor). error.tsx é
 * obrigatoriamente client component.
 *
 * Em PRODUÇÃO o Next troca a mensagem de qualquer erro vindo do servidor por
 * "An error occurred in the Server Components render…". Mensagens que o usuário
 * deve ler (validação, limite do plano) NÃO passam por aqui: as server actions as
 * convertem em aviso (lib/acao.ts → <AvisoFlash>). Esta tela é só para falha
 * inesperada, e por isso mostra um texto próprio + o código (digest) para o suporte.
 */
function mensagemSegura(error: Error): string {
  const m = error.message ?? '';
  const mascarada = !m || /Server Components render|omitted in production/i.test(m);
  return mascarada ? 'Algo deu errado do nosso lado. Tente de novo; se continuar, avise o suporte com o código abaixo.' : m;
}

export function ErroView({ error, reset, voltarHref = '/' }: { error: Error & { digest?: string }; reset: () => void; voltarHref?: string }) {
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
        {mensagemSegura(error)}
      </p>
      {error.digest ? <p style={{ fontSize: 12, color: 'var(--grafite, #59635c)', margin: '-8px 0 18px' }}>código: {error.digest}</p> : null}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn verde" type="button" onClick={() => reset()}>Tentar de novo</button>
        <a className="btn sec" href={voltarHref}>Voltar ao início</a>
      </div>
    </div>
  );
}
