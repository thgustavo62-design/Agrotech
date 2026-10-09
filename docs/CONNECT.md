# AgroTech Connect

O site onde o produtor **pede ajuda ao técnico** — com foto, sem precisar lembrar de um WhatsApp perdido — e a equipe do escritório **atende numa fila**, com responsável, prazo e histórico. É o segundo site do plano de expansão (depois da Academy); o desenho dos três sites está em [SITES.md](SITES.md).

Fatia 1 (2026-10-09): pedido com foto, fila de atendimento, conversa com nota interna, histórico, avaliação, avisos. Fica para as próximas fatias: suspeita fitossanitária com fotos vinda do Atlas (AC-09, origem `atlas` já existe no banco), WhatsApp Business (serviço pago — pergunta antes), painel de qualidade do atendimento.

## Como funciona

**Produtor** (`/connect`)
- **Início:** convite para pedir ajuda, destaque dos pedidos em que o técnico espera resposta, últimos pedidos.
- **Novo pedido** (`/connect/pedidos/novo`): tipo (dúvida, problema na lavoura, pedir visita, documento, outro), assunto, descrição, propriedade/talhão, até 5 fotos (reduzidas no celular antes de subir), "é urgente". `?categoria=` deixa o tipo marcado (usado por links de outras telas).
- **Pedido** (`/connect/pedidos/[id]`): conversa, fotos, histórico (situação e prazo — nunca responsável nem prioridade interna), responder (reabre um pedido resolvido) e **avaliar** o atendimento (nota de 1 a 5, uma vez, só depois de resolvido).
- **Avisos** (`/connect/avisos`): só os do atendimento; marcar lido.

**Equipe** (`/connect/fila`) — o menu do escritório vê o Connect; quem tem `atendimento.gerir` (Proprietário, Agronômico, Campo) atende, os demais só consultam.
- **Fila:** 5 colunas por situação (Novo, Em triagem, Aguardando o produtor, Em acompanhamento, Resolvido), resumo clicável (em aberto, sem responsável, prazo vencido, urgentes), filtros (meus, sem responsável, prioridade, só atrasados, busca por assunto/produtor), arquivados à parte. Dentro da coluna: urgente primeiro, depois o prazo mais próximo, depois o mais antigo.
- **Atendimento** (`/connect/atendimentos/[id]`): conversa com **nota interna** (o produtor não vê nem é avisado), fotos e PDF, histórico completo com nomes, situação, responsável/prioridade/prazo, **Assumir**, **Marcar retorno na agenda** (evento `retorno`), **WhatsApp** (link `wa.me` com o texto pronto — a pessoa clica e envia; nada sai sozinho), cadastro do produtor, avaliação recebida.
- **Novo atendimento** (`/connect/atendimentos/novo`): a equipe abre em nome do produtor (ligação, WhatsApp, visita), já com responsável e prazo.

## Regras que o banco garante (migração 0049)

- O produtor só enxerga e cria o que é dele; **nota interna e arquivo de nota interna nunca chegam a ele** (RLS + Storage). A situação, o responsável e o prazo de um pedido novo são forçados pelo banco (o produtor não escolhe); prioridade só `normal`/`urgente`; **no máximo 10 pedidos abertos por produtor**.
- O responsável tem de ser da equipe ativa do escritório. Quem escreve na conversa, a hora e o histórico são gravados pelo banco — o cliente não escolhe.
- A conversa anda com o pedido: resposta do produtor tira de "Aguardando o produtor"/"Resolvido"; resposta pública da equipe tira de "Novo"/"Em triagem". Cada mudança vira linha no histórico e aviso para quem precisa (equipe: novo pedido, atribuído a você, produtor respondeu; produtor: o técnico respondeu, precisamos de você, resolvido).
- Arquivos: bucket privado `atendimentos` (`{escritório}/{pedido}/…`), JPG/PNG/WebP/PDF até 10 MB, no máximo 30 por pedido; links assinados de 1 h. A foto "interna" enviada pelo produtor é neutralizada, não aceita.
- A avaliação é feita por função do banco (uma vez, só o dono do pedido, só resolvido). Apagar o produtor (LGPD) apaga pedidos, conversa e histórico em cascata **e os arquivos do bucket** (`lib/lgpd-arquivos.ts`).

## Onde está o código

| O quê | Onde |
|---|---|
| Banco, RLS, gatilhos, bucket | `supabase/migrations/0049_connect_atendimentos.sql` · testes `packages/db-test/test/connect.test.ts` (31) |
| Regras puras (rótulos, validação, fila, atraso, WhatsApp, histórico) | `apps/web/lib/connect.ts` (+ teste) |
| Leituras | `apps/web/lib/connect-dados.ts` |
| Ações do servidor | `apps/web/app/(connect)/connect/acoes.ts` |
| Telas | `apps/web/app/(connect)/connect/…` e `apps/web/components/connect/` |
| Redução de foto no navegador | `apps/web/lib/reduzir-foto.ts` |
| Tema azul | `apps/web/app/estilos/connect-site.css` (`.site-connect`) |
| Navegador (simulado) | `apps/web/e2e/suite.mjs` — cenários `connect_produtor` e `connect_equipe` |

## Pendências conhecidas

- Backup dos arquivos do Storage (inclui `academy` e `atendimentos`) segue pendente de credencial do dono — ver [OPERACAO.md](OPERACAO.md).
- Notificação por e-mail/WhatsApp ao produtor: hoje o aviso é dentro do site. WhatsApp Business é serviço pago e mensagem externa a produtor: só com aprovação ([POLITICA-DE-APROVACAO.md](POLITICA-DE-APROVACAO.md)).
- O simulador do navegador não tem RLS; a segurança é provada no `db-test` (PGlite) e no job pgTAP.
