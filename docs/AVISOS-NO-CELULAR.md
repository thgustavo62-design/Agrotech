# Avisos no celular (Web Push)

Quando nasce uma notificação para alguém (o técnico respondeu um pedido, novo pedido para a equipe, ficha indicada, recomendação nova…), o AgroTech manda um **aviso para o celular** da pessoa, mesmo com o site fechado. Sem custo e sem domínio: usa o serviço de push do próprio navegador (Chrome/Edge/Firefox/Safari), com o app instalado ou não (no iPhone, só com o app na tela inicial).

> Decisão do dono (10/10/2026): começar pelos avisos no celular; e-mail e WhatsApp Business ficam para depois (exigem domínio / serviço pago e aprovação).

## Como a pessoa liga

Bloco **"Avisos no celular"** em: Avisos do Connect, início do Connect (produtor), Notificações do produtor e Notificações do escritório. Botão **Ligar avisos** → o navegador pede permissão → pronto. Dá para **enviar um aviso de teste** e **desligar** (por aparelho). Se o navegador bloqueou, o bloco explica como liberar; no iPhone, explica como instalar na tela inicial.

## Como funciona por dentro

- **Banco (migração 0052):** `push_assinaturas` (uma por aparelho; só https; a pessoa vê e apaga as próprias, quem grava é o servidor) e `notificacoes.push_enviado_em` (marca a notificação já tratada).
- **Envio:** depois de cada ação do servidor (`comAviso` em `lib/acao.ts`), roda `despacharPush()` (`lib/push.ts`): lê as notificações recentes ainda não tratadas, **reivindica** cada uma (dois despachos juntos não repetem o aviso), manda para os aparelhos do destinatário e **apaga** assinaturas que o serviço de push diz que não existem mais (404/410) ou que falharam 5 vezes seguidas. Notificação com mais de 15 minutos não vira aviso atrasado.
- **Conteúdo:** título (até 90 letras), resumo (até 140) e o caminho para abrir ao tocar (só caminho do próprio site). Aparece na tela de bloqueio: o título do pedido é visível ali.
- **Service worker** (`app/sw.js/route.ts`): mostra o aviso e abre a tela certa ao tocar. Sair de qualquer um dos três sites também limpa o cache do aparelho.
- **Limite conhecido:** o envio acontece quando alguém usa o sistema (qualquer ação). Uma notificação criada por processo sem ação do usuário (ex.: leitura de laudo em segundo plano) só vira aviso na próxima ação de alguém, e se passar de 15 minutos é descartada como aviso (continua no sino). Para cobrir isso seria preciso um agendador (plano pago da Vercel ou do Supabase).

## Configuração (uma vez)

Três variáveis no servidor (Vercel → Project → Settings → Environment Variables, ambiente Production), depois **Redeploy**:

| Variável | O que é |
|---|---|
| `VAPID_PUBLIC_KEY` | chave pública (a que o navegador usa para assinar) |
| `VAPID_PRIVATE_KEY` | chave privada — **segredo**, nunca vai para o repositório |
| `VAPID_SUBJECT` | `mailto:` de contato do escritório (o serviço de push usa para falar com você se algo der errado) |

Sem as variáveis, o bloco nem aparece e nada é enviado: o resto do sistema não muda. Para gerar outro par: `npx web-push generate-vapid-keys`. **Trocar o par invalida as assinaturas existentes** (cada pessoa liga de novo).

## Testes

`lib/push.test.ts` (conteúdo e despacho, com banco falso), `lib/push-navegador.test.ts`, `packages/db-test/test/push.test.ts` (6) e os cenários de navegador `connect_produtor`/`connect_equipe` (bloco bloqueado/liberado, ligar → assinatura gravada, teste, desligar; as APIs de permissão e assinatura são simuladas porque o Chromium sem janela nega notificações). O envio de verdade ao serviço de push só se confere num aparelho real, com as chaves configuradas.
