# Estrutura do código

Como o código está organizado e por quê. A regra geral: **um arquivo, uma responsabilidade**, e a ordem de
leitura de qualquer tela é *página → dados → seções*.

## Telas do app (`apps/web/app/...`)

Toda tela com mais de ~100 linhas é uma pasta:

```
produtores/[id]/
  page.tsx      fino: chama o carregador e monta o cabeçalho e as abas (46–110 linhas)
  dados.ts      carregar<Nome>(): TODAS as consultas e cálculos; devolve o "contexto" da tela
  paineis/      um componente por aba (telas com abas)       ┐ recebem `ctx` e só leem o que usam
  secoes/       um componente por bloco (telas sem abas)     ┘
  acoes.ts      server actions desta tela ('use server')
  editar/       sub-rotas
```

- **`page.tsx` não consulta o banco**. Se precisa de um dado novo, ele nasce em `dados.ts`.
- **`dados.ts` não renderiza nada**. Roda as consultas independentes **numa rodada só** (`Promise.all`); só o que
  depende de resultado anterior espera. Cada ida ao banco custa uma latência de rede: 3 consultas em fila são ~3× o tempo.
  Devolve um objeto tipado; o tipo do contexto sai de `Awaited<ReturnType<typeof carregar…>>` (nada de tipo duplicado).
- **Telas com plano/permissão** (financeiro) devolvem `{ bloqueado: true }` do carregador e a página decide o que mostrar.
- **`paineis/` e `secoes/`** são componentes de servidor puros: sem estado, sem consulta. O que for interativo
  (estado, eventos) vira componente de cliente em `components/` (`'use client'`).

Exemplos completos: `produtores/[id]`, `talhoes/[id]`, `laudos/[id]` (este com estados *lendo / revisão / confirmado*),
`(consultor)/app/page.tsx` (painel) e `inteligencia`.

## Regras puras fora da tela (`apps/web/lib/`)

Lógica que não é JSX nem acesso ao banco vai para `lib/` **com teste** (`*.test.ts` ao lado): `formato.ts` (datas no fuso
de Brasília), `laudo-conferencia.ts`, `fila-offline.ts`, `arquivos.ts`, `supabase/rotas.ts` (quem vai para onde),
`supabase/sessao.ts` (quem está logado), `acao.ts` (mensagens de erro das ações).

## Estilos (`apps/web/app/`)

`globals.css` é só um índice de `@import` na **ordem** que a cascata exige:
`estilos/base.css` → `navegacao.css` → `componentes.css` → `autenticacao.css` → `laudo.css` → `complementos.css`.
`mobile.css` vem depois (celular e toque). Uma regra nova vai no módulo do assunto dela.

## Pacotes (`packages/`)

| Pacote | O que é |
|---|---|
| `agro-core` | motor agronômico (TS puro). `parsers/lote/` lê laudo em tabela: `formato` (que linhas existem) → `leitura` (células) → `votacao` (várias leituras de OCR) → `coerencia` (SB/T) → `index` |
| `laudo-pdf` | gera o PDF A4 do laudo |
| `db-test` | aplica as migrations num Postgres em WASM e testa RLS e segurança |

## Como provar que uma refatoração não mudou nada

Refatorar sem mudar comportamento só vale se for **verificável**. Em `apps/web/e2e/` (ver `LEIA-ME.md`):

1. `fotografar-html.mjs` — grava o HTML renderizado de cada página e de **cada aba**; capture antes, refatore, capture depois e
   rode `diff -r`. A modularização das telas foi validada assim (36 páginas idênticas).
2. `comparar-pixels.mjs` — capturas de tela completas; `cmp` byte a byte antes/depois. Usado na divisão do CSS (36 imagens idênticas).
3. `medir-tempo.mjs` — tempo até o primeiro byte e nº de chamadas ao banco por página, com latência simulada.

Os três rodam contra `supabase-simulado.mjs` (auth, REST e RPC com dados de exemplo; assina JWT de verdade).
