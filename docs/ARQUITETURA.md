# Arquitetura (as-built)

Estado do repositório depois da **Fase 1 — Fundação**. Complementa
`AGROTECH.md` (a visão) descrevendo o que já está no código.

> Diferença deliberada em relação ao `AGROTECH.md`: o monorepo usa **npm
> workspaces** (não pnpm/turbo). A troca é mecânica e pode ser feita depois; npm
> workspaces já entrega o isolamento de pacotes que a Fase 1 precisa.

---

## Mapa do monorepo

```
agrotech/
├─ package.json               workspaces: packages/*, apps/*
├─ tsconfig.base.json         strict, noUncheckedIndexedAccess
├─ prototipo/agrotech.html    protótipo de referência (congelado)
│
├─ packages/
│  └─ agro-core/              ★ motor agronômico — TS puro, sem DOM/DB/rede
│     ├─ src/
│     │  ├─ tipos.ts          contratos do domínio
│     │  ├─ num.ts            n(), arred(), div()
│     │  ├─ formato.ts        f0/f1/f2 (pt-BR, só para as frases do motor)
│     │  ├─ interpretacao.ts  classificar(), faixaFosforo(), classes
│     │  ├─ calculos.ts       complexo sortivo: SB, t, T, V, m, relações
│     │  ├─ calagem.ts        2 métodos + escolha do corretivo (A1)
│     │  ├─ gessagem.ts       indica investigar (não calcula dose)
│     │  ├─ adubacao.ts       N-P-K por classe e produtividade
│     │  ├─ fontes.ts         conversão em fertilizante comercial
│     │  ├─ diagnostico.ts    regras encadeadas -> crítico/atenção/ok
│     │  ├─ recomendacao.ts   orquestra tudo + motor_versao + snapshot
│     │  ├─ versao.ts         MOTOR_VERSAO
│     │  ├─ tabelas/padrao.ts PADRAO (5ª Aproximação/MG + ES)
│     │  └─ parsers/          ingestão de laudo (texto -> campos + confiança)
│     │     ├─ numero.ts      parseNumeroBR(), norm()
│     │     ├─ sanidade.ts    SANIDADE + dentroDaFaixa()
│     │     ├─ perfis.ts      PERFIS declarativos por laboratório
│     │     ├─ extrair.ts     extrairDeTexto()
│     │     └─ normalizar.ts  travas do LLM (confiança <= 0,65)
│     └─ test/                45 testes (vitest) — a suíte É a auditoria
│
├─ apps/
│  └─ web/                    Next.js 15 (App Router) — esqueleto
│     ├─ middleware.ts        roteamento por perfil (conveniência)
│     ├─ lib/supabase/        client / server / middleware (@supabase/ssr)
│     ├─ components/          regua-interpretacao, perfil-ctc (portados)
│     └─ app/
│        ├─ (auth)/login/     entrada do consultor
│        └─ (consultor)/app/  layout com guarda + painel
│
├─ supabase/
│  ├─ migrations/0001..0009   schema agro, RLS em todas as tabelas, trigrama
│  ├─ functions/              processar-laudo, gerar-laudo-pdf, convidar-produtor
│  ├─ tests/rls.test.sql      pgTAP — isolamento produtor/organização
│  ├─ config.toml
│  └─ seed.sql
│
└─ .github/workflows/         ci.yml, deploy-supabase.yml, backup.yml
```

★ = ativo mais valioso. `agro-core` não importa nada de Next, Supabase ou DOM.

---

## Fluxo de dados

```
lançamento manual OU laudo PDF
        │
        ▼
 parsers/extrairDeTexto ──► payload {campo: {valor, confiança}}  (só no fluxo PDF)
        │                         │
        │              tela de conferência (confiança < 0,90 destacada)
        ▼                         ▼
   agro.analises  ◄── agrônomo confirma
        │
        ▼
 gerarRecomendacao(analise, cultura, tabelas)
        │   calcular → calagem → corretivo → gessagem → adubacao → fontes → diagnostico
        ▼
 Recomendacao { motor_versao, tabelas_snapshot, calculo, calagem, ... }
        │
        ▼
 agro.recomendacoes  ──►  gerar-laudo-pdf  ──►  Storage recomendacoes/
```

Uma recomendação é **reproduzível para sempre**: guarda a versão do motor e a
cópia das tabelas usadas.

---

## Decisões de arquitetura

| Decisão | Porquê |
|---|---|
| Motor em pacote isolado, funções puras | testável com casos reais; reaproveitável em app nativo; roda igual no browser e na Edge Function |
| Tabelas de referência por organização | cada escritório calibra sem afetar os outros; semeadas no cadastro a partir de `clonarPadrao()` |
| RLS em **todas** as tabelas + testes pgTAP no CI | falha de política = vazamento de carteira |
| Snapshot das tabelas em cada recomendação | defensabilidade técnica do laudo (ART) |
| Faixas de sanidade no parser **e** no banco (constraints) | auditoria A7 — nada de pH 42 |
| LLM só como preenchimento, confiança teto 0,65, sem pular conferência | o agrônomo valida, sempre |
| npm workspaces em vez de pnpm/turbo | menos ferramenta para a Fase 1; migração posterior é trivial |

---

## Como rodar

```bash
npm install
npm run test:core        # 45 testes do motor
npm run typecheck        # strict, agro-core
npm run build            # compila agro-core para dist/

# app web (precisa de deps adicionais e de um .env.local)
cp .env.example .env.local
npm run dev

# banco local (precisa do Supabase CLI + Docker)
supabase start
supabase test db         # políticas RLS
```
