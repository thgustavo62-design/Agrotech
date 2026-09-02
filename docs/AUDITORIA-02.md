# Auditoria 02 — extração do motor e fundação

Feita ao portar o protótipo `agrotech.html` para o monorepo (`packages/agro-core`
+ `supabase/` + `apps/web`). Complementa `AUDITORIA.md` (revisão do protótipo).
Data: setembro de 2026 · Motor: `agro-core` 0.1.0 · Suíte: 45 testes, vitest.

---

## Resumo

A extração confirmou os achados da primeira auditoria e **implementou as
correções que estavam só descritas**. O motor agora é código isolado e testado;
a suíte de 45 testes é a própria auditoria contínua — roda no CI a cada PR.

| # | Item | Severidade | Situação |
|---|---|---|---|
| A1 | Escolha do corretivo invertida | grave | **corrigida no código** (`calagem.ts` + 5 testes) |
| A4 | pH na escala genérica | alto | **corrigida** — régua aceita escala/cores por parâmetro |
| A5 | Al contado 2× no perfil da CTC | médio | **corrigida** — `perfil-ctc.tsx`, Al é fração do H+Al |
| A7 | Sem faixas de sanidade | médio | **corrigida** — `parsers/sanidade.ts` + constraints no banco |
| A9 | Navegação duplicada | baixo | resolvida pela arquitetura (roteador do Next) |
| A10 | `gessagem()` chamada 3× | baixo | resolvida — `gerarRecomendacao` calcula uma vez |
| A11 | Escalonamento de N em pastagem | baixo | mantida por decisão; documentada em `MOTOR.md` |
| D2 | Perfis de laboratório só descritos | — | **implementados** — `parsers/perfis.ts` + `extrair.ts` + testes |

A2, A3, A6, A8 eram específicos do DOM do protótipo (modal, `confirm()`,
`@page`) e não têm equivalente no motor; voltam quando a UI correspondente for
migrada para o Next.

---

## O que a extração acrescentou

### 1. Rastreabilidade real (era conceito, virou tipo)

`gerarRecomendacao()` devolve `Recomendacao` com `motor_versao` e
`tabelas_snapshot`. Teste `recomendacao.test.ts` prova que o snapshot é uma
cópia (não referência) das tabelas. Sem isso, um laudo de 2026 não é
reproduzível depois de a organização recalibrar.

### 2. Parser declarativo funcionando

`extrairDeTexto()` lê um laudo em texto e devolve `{campo: {valor, confiança,
origem, bruto}}`. Cobre as três armadilhas da doc:

- **vírgula decimal / ponto de milhar** — `parseNumeroBR('1.250') === 1250`,
  `parseNumeroBR('4,52') === 4.52`
- **unidade de K divergente** — `K 0,102 cmolc/dm³` → ×391 → 39,88 mg/dm³
- **carbono no lugar de M.O.** — rótulo "Carbono orgânico" → ×1,724

### 3. Sanidade em duas camadas

`parsers/sanidade.ts` rejeita valor fora de faixa (confiança 0, `valor: null`,
aviso) **e** o banco tem `constraint ph_plausivel`, `argila_plausivel`, etc.
Teste `parser.test.ts`: `pH 42` no laudo → campo rejeitado, não "corrigido".

### 4. Travas do LLM

`normalizar.ts` — `interpretarResposta()` nunca devolve confiança acima de
`CONFIANCA_MAX_LLM = 0.65`; resposta não-JSON devolve `{}`. O LLM preenche, não
decide.

### 5. RLS em todas as tabelas

Todas as tabelas com `enable row level security`. **Nota (`0012_tenancy.sql`):** as
políticas em cadeia (EXISTS + joins) foram trocadas por `coluna = literal` com o
tenant vindo do JWT, mais uma guarda `RESTRICTIVE` de tenant em cada tabela — ver
`PRODUTO-VENDAVEL.md §1`. `supabase/tests/rls.test.sql` (pgTAP, 7 asserts) cobre o
caso obrigatório: produtor A lê talhão de B → 0 linhas.

---

## Cobertura da suíte (45 testes)

```
calculos.test.ts     6  conversão K/Na, SB/t/T/V/m à mão, classe de P por argila
interpretacao.test.ts 6  quebra fechada por baixo, faixa de fósforo, nomes invertidos
calagem.test.ts      9  fator Y, fator profundidade, 2 métodos, PRNT, A1 (4 cenários)
gessagem.test.ts     2  indica investigar / não indica
adubacao.test.ts     3  doses por classe, escala linear, sem cultura -> null
diagnostico.test.ts  2  Colatina (4 críticos), solo bom (1 "ok")
parser.test.ts      12  número BR, perfil, extração, K cmolc, C.O., valor absurdo, LLM
recomendacao.test.ts 5  carimbo de versão, snapshot imutável, A1, totais, fontes
```

Caso-fixture: latossolo ácido de meia encosta, café conilon, Colatina
(`test/fixtures/casos.ts`).

---

## Pendências (ordem de prioridade)

1. **Calibrar as tabelas de referência.** Continua sendo o maior risco. Nenhum
   código resolve. `PADRAO` é literatura.
2. **5 a 10 laudos reais anonimizados** dos laboratórios mais usados → cada um
   vira caso de teste em `parser.test.ts` e, se preciso, um novo perfil em
   `perfis.ts`. É o que tira a ingestão de PDF do papel.
3. **Rodar `supabase test db` no CI de verdade** (workflow pronto em `ci.yml`,
   job `rls`) assim que houver projeto Supabase.
4. **Migrar as telas do protótipo** para o Next, tela a tela, reaproveitando
   `agro-core`. Começar por Análises (interpretação) — é onde o motor aparece.
5. Só depois: OCR de PDF digitalizado, análise foliar, múltiplas camadas por
   talhão, produtividade realizada (fechar o ciclo).
