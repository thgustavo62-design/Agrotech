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
│  └─ web/                    Next.js 15 (App Router) — buildando
│     ├─ middleware.ts        roteamento por perfil; pula /demo e /r/*
│     ├─ app/globals.css      sistema visual (tokens do protótipo, refinados)
│     ├─ lib/
│     │  ├─ supabase/         client / server / middleware / publico (anon)
│     │  ├─ tabelas-org.ts    tabelas calibradas da org (fallback PADRAO por tipo)
│     │  ├─ onboarding.ts     garantirEscritorio() — org + tabelas + assinatura trial
│     │  ├─ audit.ts          registrar() -> agro.audit_log (LGPD)
│     │  ├─ culturas.ts       label da cultura + linha do banco -> Analise
│     │  ├─ demo.ts           fixture da vitrine
│     │  └─ formato.ts        f() / dataBR() pt-BR
│     ├─ components/
│     │  ├─ ui.tsx            Cartao, Metrica, Tag, Grade, Vazio, CabecalhoVista
│     │  ├─ nav-abas.tsx      abas com estado ativo (client)
│     │  ├─ regua-interpretacao.tsx · perfil-ctc.tsx
│     │  ├─ interpretacao-view.tsx  tela inteira do motor (reutilizável)
│     │  ├─ laudo-view.tsx · botao-imprimir.tsx   laudo A4 + window.print()
│     │  ├─ form-analise · form-produtor · form-talhao
│     │  └─ link-compartilhado.tsx  URL + copiar
│     └─ app/
│        ├─ (auth)/login · cadastro (signUp real)
│        ├─ (consultor)/app/           layout: guarda + garantirEscritorio() + abas
│        │  ├─ page.tsx                painel (pendências químicas via motor)
│        │  ├─ produtores/ nova/ [id]/ [id]/editar   (CRUD; análises por cultura;
│        │  │                                         cadastro de propriedade/talhão; links)
│        │  ├─ analises/ [id]/ [id]/laudo/ nova/
│        │  ├─ talhoes/ [id]/editar
│        │  ├─ produtores/[id]/exportar/route.ts   (JSON, LGPD)
│        │  └─ laudos · monitoramento · tabelas · assinatura
│        ├─ (auth)/produtor/login · aceitar · sair   (fora da guarda)
│        ├─ (produtor)/produtor/       layout guarda role='produtor'
│        │  ├─ page.tsx                painel em linguagem do produtor
│        │  └─ laudos/[id]/            laudo completo (LaudoView)
│        ├─ demo/ + demo/tabelas/      vitrine pública (sem auth/banco)
│        └─ r/[token]/                 link "bruto" de resultados do produtor
│
├─ supabase/
│  ├─ migrations/0001..0015   schema agro; RLS em todas as tabelas;
│  │   0009 trigrama · 0010 compartilhamentos+RPC (anon) · 0011 orgs_criar
│  │   0012 tenancy (colunas denormalizadas + hook de claims + guarda RESTRICTIVE
│  │        + políticas coluna=literal + índices)
│  │   0013 billing (planos/assinaturas/cobrancas + checar_limite)
│  │   0014 painel (vw_talhao_situacao + painel_consultor)
│  │   0015 audit_log insert · 0016 aceitar_convite/convite_resumo · 0017 grants agro
│  │   0018 painel_consultor v2 (central operacional — Fase 2 de PRODUCT_V2.md)
│  ├─ functions/              processar-laudo, gerar-laudo-pdf, convidar-produtor, webhook-asaas
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

### Link público de resultados (`/r/[token]`)

```
consultor abre /app/produtores/[id]
        │  "Gerar link"  (lavoura toda  ou  uma cultura)
        ▼
 agro.compartilhamentos { token, produtor_id, cultura|null, ativo }
        │
produtor abre  APP_URL/r/{token}   (sem login)
        ▼
 anon → RPC agro.resultados_por_token(token)   ← security definer:
        valida ativo + expira_em, incrementa acessos,
        devolve JSON só das análises daquele produtor (e cultura, se houver)
        ▼
 /r/[token] roda gerarRecomendacao por análise e mostra, agrupado por cultura:
 V% · m% · pH/CTC · calcário t/ha · N-P-K · alerta crítico   (layout "bruto")
```

As tabelas continuam fechadas pela RLS; o único caminho anônimo é a função,
escopada ao token.

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

# num projeto Supabase novo/real (não precisa de Docker, só do CLI):
npx supabase db push --db-url "postgresql://..."
```

**Passo manual obrigatório, fora de git/migration, em todo projeto Supabase
novo**: Project Settings → Data API → Exposed schemas → adicionar `agro`
(vem só com `public`/`graphql_public` por padrão). Sem isso a API responde
`PGRST106 — Invalid schema: agro` pra toda chamada do app, mesmo com banco e
RLS perfeitos — foi exatamente o que aconteceu no primeiro deploy em
produção (2026-09-24, ver `PROGRESSO.md`). Confirmar com:
```bash
curl -H "apikey: $ANON_KEY" -H "Accept-Profile: agro" \
  "$SUPABASE_URL/rest/v1/<qualquer_tabela>?limit=1"
# 406 PGRST106 = schema não exposto ainda
# 401 "permission denied" = schema exposto, RLS bloqueando anon (esperado)
```
