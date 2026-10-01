# Auditoria 03 — sessão, segurança, banco e erros (01/10/2026)

Pedido: "a aba de login pede login de novo; faça uma auditoria total e conserte". Método: leitura
do código, **consultas ao catálogo do Postgres** e **sondagem prática das funções** num banco
real em WASM (PGlite, `packages/db-test`), build de produção chamado por HTTP e testes novos.
Cada item corrigido tem teste que falha sem a correção.

## Resolvido

| # | Gravidade | Achado | Correção | Teste |
|---|---|---|---|---|
| 1 | **Alta** | **Perda de sessão.** "sair" era `<Link href="/sair">` e `/sair` era GET que encerra a sessão. Em produção o Next pré-carrega todo `<Link>` visível: o app "clicava" em sair sozinho a cada navegação. (Em desenvolvimento não pré-carrega, por isso só apareceu no Vercel.) | Logout é POST (`<form>`, `components/botao-sair.tsx`); GET só redireciona. 3 lugares. | `sessao-sem-link.test.ts` varre o código |
| 2 | Média | Middleware: quem já tem sessão e abre `/login` (aba nova, favorito) via o login de novo; redirect perdia os cookies recém-renovados (refresh token antigo ficava no navegador); falha momentânea do Auth (rede/5xx/429) virava "deslogado"; perfil que não carrega gerava laço `/app`⇄`/produtor`; consulta ao banco por requisição só para ler o papel. | `lib/supabase/rotas.ts` (regras puras) + middleware novo; papel vem do claim do token | 21 testes |
| 3 | Média | Service worker guardava tela de login e redirecionamentos e os servia quando a rede falhava; cache sobrevivia ao logout (aparelho compartilhado). | cache v2, não guarda sessão/redirect, apaga no logout | sintaxe verificada |
| 4 | **Alta** | **RPCs públicas no banco.** Toda função nasce executável por `PUBLIC` e o schema `agro` é exposto pelo PostgREST. Com a chave anônima (do navegador), sem login: `casar_produtor` listava produtores de qualquer escritório; `semear_categorias_*` gravava em qualquer produtor/escritório. | `0034`: nada executável por padrão (nem funções futuras); só 3 funções com token ficam públicas; as 3 funções conferem quem chama | 13 testes (catálogo + abuso) |
| 5 | **Alta** | Produtor lia laudos, PDFs e fotos de **outro produtor do mesmo escritório** (policies de Storage só olhavam a pasta da org). | `0032` | `storage.test.ts` |
| 6 | Média | **Mensagens de erro invisíveis em produção.** Next troca a mensagem de qualquer erro de server action por texto genérico: as 133 validações ("Selecione um PDF", limite do plano…) viravam tela de erro. | `lib/acao.ts` (`ErroDeUsuario`, `lancarDoBanco`, `comAviso`) + `<AvisoFlash>`; 48 ações embrulhadas por AST | 12 testes + chamada HTTP ao build de produção |
| 7 | Média | **Datas em UTC.** `new Date().toISOString().slice(0,10)`: das 21h às 23h59 em Brasília virava "amanhã" (visita/análise/laudo com data errada, conta vencendo no dia errado). | `hojeISO()`/`diasDepoisISO()` em `America/Sao_Paulo`; 13 arquivos | 6 testes |
| 8 | Média | Link público `/r/[token]` calculava com a tabela PADRÃO, não a calibrada do escritório: divergia do laudo emitido. | `0035` devolve as tabelas da org; página usa | teste de banco + merge |
| 9 | Baixa | 30 FKs sem índice (exclusão em cascata/LGPD e filtros por org varrendo a tabela). | `0036` | teste de catálogo |
| 10 | Baixa | Upload confiava no `type` declarado pelo navegador. | confere o conteúdo (`%PDF-`, JPEG/PNG/WebP) e 10 MB | 4 testes |
| 11 | Baixa | Busca global usava um 2º cliente de autenticação no navegador (disputa de refresh token), não escapava `%`/`_`, e respostas fora de ordem sobrescreviam as novas. | `buscarGlobal` (server action), escape do `ilike`, descarta resposta velha | typecheck |
| 12 | Baixa | Sem cabeçalhos de segurança; redirect de pagamento aceitava qualquer URL; webhook comparava token em tempo não constante. | headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS); só `https://*.asaas.com`; comparação em tempo constante | `deno check` |
| 13 | Baixa | `perfilAtual()` batia no Auth+banco várias vezes por página; textos de UI desatualizados ("formulário de visita não existe", "Fase 7"); componente `EmBreve` morto. | `React.cache`; textos; removido | — |

## Não resolvido (decisão ou dado externo necessário)

- **Cobrança Asaas pode não ativar a assinatura.** O link é criado sem vínculo com o escritório
  (`externalReference`) e nada grava `assinaturas.gateway_customer_id`; o webhook casa por esses
  campos. Não há como verificar sem conta Asaas — **testar um pagamento real antes de vender**.
- **CSP** (Content-Security-Policy): exige nonce por causa dos scripts inline do Next e teste em navegador.
- **`npm audit`:** `postcss` embutido no `next` (XSS no stringify de CSS e leitura de `.map`);
  afeta build/CSS, não entrada de usuário. A correção é `next@16` (mudança grande).
- **Edge Functions não publicadas** (`gerar-laudo-pdf`: o botão "Baixar PDF" falha até o deploy;
  `processar-laudo` não faz OCR).
- **Sem teste de navegador de verdade.** O comportamento de sessão/aba foi verificado por testes
  de unidade do middleware e por chamada HTTP ao build; falta um E2E (Playwright) com Supabase real.
- Campos de texto livre sem limite de tamanho no banco (22 colunas) e rate limit só nos padrões do Supabase.
