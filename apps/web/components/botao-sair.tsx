/**
 * Botão de sair. É um <form method="post">, nunca um <Link>/<a href>: o Next pré-carrega
 * todo <Link> visível, e uma rota GET que encerra a sessão seria "clicada" sozinha a cada
 * navegação (o usuário via a tela de login "do nada"). Logout muda estado, então é POST.
 */
export function BotaoSair({
  action = '/sair', className = 'link-sair', rotulo = 'sair',
}: {
  action?: string;
  className?: string;
  rotulo?: string;
}) {
  return (
    <form method="post" action={action} style={{ display: 'inline' }}>
      <button type="submit" className={className}>{rotulo}</button>
    </form>
  );
}
