# Progresso — passo a passo

Acompanha o roadmap de `AGROTECH.md` §13. Marca o que saiu do protótipo.
Decisões de virar produto vendável: `PRODUTO-VENDAVEL.md`.
Transformação em dois produtos (agrônomo + produtor): `PRODUCT_AUDIT.md` /
`PRODUCT_V2.md` / `UX_ARCHITECTURE.md` / `DATABASE_CHANGES.md` — as "fases"
dessa leva têm numeração própria (1–11 do pedido), diferente das fases
abaixo (que seguem o roadmap original de `AGROTECH.md`).

---

## AgroTech v2 — dois produtos, uma infra

- [x] **Auditoria + plano** (`PRODUCT_AUDIT.md`, `PRODUCT_V2.md`,
      `UX_ARCHITECTURE.md`, `DATABASE_CHANGES.md`) — inventário verificado do
      código real, decisões de arquitetura, roadmap nas 11 fases pedidas,
      migrations `0018–0022` propostas (não escritas).
- [x] **Fase 4 do pedido — Visão 360º do talhão** (`/app/talhoes/[id]`) —
      maior lacuna estrutural identificada na auditoria, agora existe.
      Header com situação/status; abas: **Visão geral** (métricas + dados de
      cadastro), **Solo & Nutrição** (fundido de propósito — reaproveita
      `InterpretacaoView` inteira, que já cobre as duas coisas juntas),
      **Histórico** (linha do tempo mesclando análises + recomendações +
      visitas, ordenada por data), **Recomendações** (persistidas, com link
      pro laudo), **Monitoramento** (visitas e ocorrências), **Fotos**
      (signed URLs do bucket `visitas`), e **Custos**/**Produção** como
      estado vazio explícito apontando para as migrations `0018`/`0019`
      propostas (ainda não existem). Componente novo reutilizável:
      `components/abas-paineis.tsx` (abas de conteúdo dentro da página,
      client-side, state local — diferente de `nav-abas.tsx`, que navega
      entre rotas). Linkado a partir de `/app/talhoes` e da tabela de
      talhões em `/app/produtores/[id]`.
- [ ] Pré-requisito transversal: validar as 17 migrations existentes contra
      um Supabase real + `supabase test db` (sem Docker/CLI neste ambiente —
      precisa rodar num ambiente com Docker ou contra um projeto hospedado)
- [ ] Fase 1 do pedido — navegação agrupada (sidebar) para o agrônomo
- [ ] Fase 2 — dashboard do agrônomo expandido (cards de atenção, timeline)
- [ ] Fase 3 — Visão 360º do produtor (abas sobre a página já rica que existe)
- [ ] Fases 5–11 — ver `PRODUCT_V2.md §3` para o roadmap completo

---

## Produto vendável (multi-tenant + billing)

- [x] **Tenancy à prova de descuido** (`0012_tenancy.sql`) — `org_id`/`produtor_id`
      desnormalizados por trigger, `custom_access_token_hook` (claims no JWT),
      helpers `jwt_org/jwt_role/jwt_produtor` com fallback, políticas `coluna = literal`,
      **guarda `RESTRICTIVE` de tenant em toda tabela**, índices. `config.toml` liga o hook.
- [x] **Auth endurecido** (`config.toml`) — senha mínima 10 + variedade, MFA TOTP,
      rate limits no token. CAPTCHA/leaked-password ficam no painel + secret.
- [x] **Billing Asaas** (`0013_billing.sql`) — `planos` (teste/técnico/escritório),
      `assinaturas`, `cobrancas` (`unique(gateway_id)`), trigger `checar_limite()`.
      Edge Function `webhook-asaas` (confere token, upsert idempotente, 200 após gravar).
      Tela `/app/assinatura` (plano, uso vs limite, cobranças).
- [x] **Painel agregado no banco** (`0014_painel.sql`) — `vw_talhao_situacao` (LATERAL) +
      `painel_consultor()` (JSON, SECURITY INVOKER); painel do consultor rewireado, virou fila de trabalho.
- [x] **LGPD** — `lib/audit.ts` gravando em `audit_log` (produtor/talhão/laudo/link/convite);
      `0015` libera o insert do consultor. Export dos dados do produtor em JSON:
      `/app/produtores/[id]/exportar`. **Exclusão sob solicitação**: `excluirProdutor`
      (confirmação por texto, cascata, audit) na "Zona de risco" da página do produtor.
- [ ] Ligar hook, senha vazada, CAPTCHA e rate limit no painel do projeto real
- [ ] Conta sandbox Asaas + ciclo completo de webhook
- [ ] Contrato + política de privacidade com cláusula de operador
- [ ] Exclusão de dados sob solicitação (hoje só exportação)

---

## Fase 1 — Fundação · em andamento

- [x] Monorepo (npm workspaces) — `packages/*`, `apps/*`, tsconfig strict
- [x] `packages/agro-core` — motor extraído em módulos puros
  - [x] `calculos` · `interpretacao` · `calagem` · `gessagem` · `adubacao` · `fontes` · `diagnostico`
  - [x] `recomendacao` — orquestrador com `motor_versao` + `tabelas_snapshot`
  - [x] `tabelas/padrao` — PADRAO tipado
  - [x] `parsers/` — `numero`, `sanidade`, `perfis`, `extrair`, `normalizar`
  - [x] **45 testes (vitest) passando** · typecheck strict limpo
  - [x] **Auditoria A1 corrigida no código** (escolha do corretivo) + 5 testes
- [x] `supabase/migrations/0001–0009` — schema `agro`, RLS em todas as tabelas, trigrama
  - [x] constraints de sanidade no banco (A7)
  - [x] `supabase/tests/rls.test.sql` (pgTAP) — isolamento produtor/organização
- [x] `supabase/functions/` — esqueletos de `processar-laudo`, `gerar-laudo-pdf`, `convidar-produtor`
- [x] `.github/workflows/` — `ci.yml`, `deploy-supabase.yml`, `backup.yml`
- [x] `apps/web` — Next 15 **buildando** (`next build` verde) e servindo
  - [x] sistema visual completo em `globals.css` (tokens do protótipo, refinados) + fontes via `next/font`
  - [x] topo + abas com estado ativo (`nav-abas`), primitivas em `components/ui.tsx`
  - [x] `login` / `cadastro` (stub) estilizados
  - [x] painel do consultor com pendências químicas reais (motor sobre as análises)
  - [x] **tela de interpretação** completa (`interpretacao-view`): métricas, perfil da CTC, réguas macro+micro, diagnóstico, calagem/gessagem, adubação + fontes + parcelamento
  - [x] `/app/analises` (lista + filtro por cultura), `/app/analises/[id]`, `/app/analises/nova` (form + server action)
  - [x] `/app/produtores` + `/app/produtores/[id]` — **talhões e análises agrupados por cultura**, resumo V%/m% por talhão
  - [x] listas de talhões, laudos, monitoramento, tabelas (read-only)
  - [x] **`/demo`** — vitrine pública da interpretação (sem auth, sem banco, motor real)
- [x] **Link público de resultados** (`/r/[token]`) — produtor abre sem login e vê V%, m%, calagem e NPK por cultura/talhão, layout "bruto" para o campo
  - [x] migration `0010_compartilhamentos` + RPC `resultados_por_token` (security definer, `grant … to anon`)
  - [x] gestão dos links na página do produtor (gerar por cultura ou lavoura toda, ativar/desativar, contador de acessos)
- [x] **CRUD de escrita** de produtores (`/produtores/nova`, `/[id]/editar`),
      propriedades e talhões (`<details>` na página do produtor, `/talhoes/[id]/editar`) — server actions em `produtores/acoes.ts`
- [x] **`/cadastro` real** (signUp com metadata) + `garantirEscritorio()` no guard:
      cria a org e semeia as 5 `tabelas_referencia` com `clonarPadrao()` no 1º acesso
      (migration `0011` — policy `orgs_criar` para consultor sem org)
- [x] **`tabelasDaOrg(sb)`** — todas as telas usam as tabelas calibradas da organização
      (fallback para PADRAO por tipo); painel, análises, produtor e laudo já threadados
- [ ] Projeto Supabase real (staging) + `supabase link` + primeira `db push`
- [ ] Editor visual das `tabelas_referencia` por organização (hoje só semeadas)

## Fase 2 — Análise e recomendação

- [x] Tela de lançamento manual da análise (form → server action → interpretação)
- [x] Tela de interpretação (réguas, perfil da CTC, diagnóstico, calagem, adubação)
- [x] **Laudo A4 imprimível** — `/app/analises/[id]/laudo` (`LaudoView` + `window.print()`,
      `@page` A4 + `.nao-imprime` já no `globals.css`). Conteúdo vem da recomendação
      (motor_versao), nada recalculado.
- [ ] `gerar-laudo-pdf` na Edge Function (PDF server-side, hoje é impressão do navegador)
- [ ] Editor visual das tabelas de referência por organização
- [ ] Tela de conferência do laudo (Fase 3) reaproveitando `interpretacao-view`

## Fase 3 — Ingestão de PDF

- [ ] Upload + Storage + insert em `documentos` com hash
- [ ] `processar-laudo`: `unpdf` + `extrairDeTexto` + (LLM opcional) → `revisao`
- [ ] Tela de conferência lado a lado (PDF | formulário), campos por confiança
- [ ] `casar_produtor` na UI (score ≥0,90 / 0,60–0,89 / <0,60)
- [ ] Lote (várias amostras por PDF)
- [ ] **5–10 laudos reais anonimizados → casos de teste + perfis**

## Fase 4 — Portal do produtor

- [x] **Convite** — server action `convidarProdutor` grava em `agro.convites` +
      e-mail (Resend, se configurado) ou link direto. Botão "Enviar convite" na página do produtor.
- [x] **`/produtor/aceitar?token=`** — RPC `convite_resumo` (anon) mostra "de qual
      organização"; cria senha (signUp) → RPC `aceitar_convite` (SECURITY DEFINER)
      liga `produtores.user_id` + `profiles.org_id`/`role` → `refreshSession()` (`0016`)
- [x] **`/produtor/login`** + `/produtor/sair`; layout `(produtor)` com guarda `role='produtor'`
- [x] **`/produtor`** — painel em linguagem do produtor ("precisa de correção" /
      "solo em ordem" via `vw_talhao_situacao`), última recomendação em destaque
- [x] **`/produtor/laudos/[id]`** — laudo completo (mesmo `LaudoView`), imprimível
- [x] **Emissão persistida** — `emitirRecomendacao` grava `agro.recomendacoes`
      (`motor_versao` + `tabelas_snapshot` + `resultado` com contexto). `LaudoView`
      renderiza da recomendação persistida, não recalcula. `0017` — GRANTs do schema `agro`.
- [ ] Notificação ao produtor quando sai recomendação nova
- [ ] Exclusão da conta de auth do produtor no fluxo LGPD (hoje remove só os dados de negócio)

## Fase 5 — Campo

- [ ] Caderno de campo com foto + geolocalização
- [ ] PWA com fila offline

## Fase 6 — Integração Campo Forte

- [ ] Preço da commodity no painel do produtor
- [ ] Estimativa de receita e custo da recomendação com preço real de insumo

---

## Como retomar

```bash
cd C:/Nova7/agrotech
npm install
npm run test:core      # deve dar 45 passando
```

Próximo passo natural: criar o projeto Supabase de staging, rodar
`supabase db push`, e migrar a **tela de Análises** do protótipo para o Next
(é onde o `agro-core` aparece inteiro).
