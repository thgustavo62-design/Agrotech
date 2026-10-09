# Os três sites do AgroTech

Um login, três sites, cada um com o próprio molde (menu, cores, telas). Quem entra escolhe, na tela de login, **para onde quer ir**; depois pode **trocar de site** a qualquer momento (link no topo de cada site, ou `/sites`).

| Site | Para quê | Entrada | Molde |
|---|---|---|---|
| **Assistência Técnica** | Carteira, visitas, análises, laudos, recomendações, financeiro do escritório; e o portal do produtor (lavoura, laudos, atividades) | `/app` (escritório) · `/produtor` (produtor) | Menu lateral, verde |
| **Academy** | Cursos, aulas, certificados; Estúdio da equipe | `/academy` | Barra no topo, vitrine de cursos, âmbar/terra — ver [ACADEMY.md](ACADEMY.md) |
| **Connect** | Pedidos do produtor ao técnico (com foto), fila de atendimento, conversa, retorno, avaliação | `/connect` | Barra azul no topo; produtor: pedidos · equipe: fila — ver [CONNECT.md](CONNECT.md) |

## Como funciona

- **Uma conta, três sites.** O e-mail e a senha são os mesmos; o que a pessoa vê em cada site depende do papel dela (escritório × produtor) e do perfil da equipe (Proprietário, Agronômico, Campo, Financeiro, Consulta).
- **Login único com seletor** (`/login?site=academy|connect|assistencia`): a tela troca de texto e de cor conforme o site escolhido e, depois de entrar, abre o site certo (`/?site=…` decide pelo papel). O endereço antigo `/produtor/login` continua valendo e redireciona.
- **Cada área protegida manda para a entrada do SEU site** quando não há sessão (`/academy` → `/login?site=academy`).
- **As mesmas travas de conta valem em todos:** conta removida não entra, senha provisória tem de ser trocada, quem ligou a verificação em duas etapas precisa do código (`lib/guarda-de-site.tsx`). A barreira real continua sendo o banco (RLS).
- Código: `lib/sites.ts` (definição e destino), `lib/supabase/rotas.ts` (roteamento, testado), `app/(auth)/login` (entrada), `app/sites` (trocar de site), `app/(academy)`, `app/(connect)`, `app/(consultor)` e `app/(produtor)` (Assistência).

## Endereços próprios (quando houver domínio)

Hoje os três sites são caminhos do mesmo endereço, porque o escritório ainda não tem domínio. Com um domínio, dá para apontar `academy.seudominio.com.br` e `connect.seudominio.com.br` para o mesmo projeto e reescrever o endereço para `/academy` e `/connect` no `proxy.ts` — sem mexer nas telas. A conta compartilhada entre subdomínios exige configurar o cookie de sessão para o domínio-pai; isso entra junto.
