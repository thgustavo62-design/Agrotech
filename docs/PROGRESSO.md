# Progresso — passo a passo

Acompanha o roadmap de `AGROTECH.md` §13. Marca o que saiu do protótipo.

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
- [x] `supabase/migrations/0001–0009` — schema `agro`, RLS em 14 tabelas, trigrama
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
- [ ] Projeto Supabase real (staging) + `supabase link` + primeira `db push`
- [ ] CRUD de escrita de produtores / propriedades / talhões (hoje só leitura)
- [ ] Rota `/cadastro` real que semeia `tabelas_referencia` da org a partir de `clonarPadrao()`

## Fase 2 — Análise e recomendação

- [x] Tela de lançamento manual da análise (form → server action → interpretação)
- [x] Tela de interpretação (réguas, perfil da CTC, diagnóstico, calagem, adubação)
- [ ] `gerar-laudo-pdf` de verdade (layout `.folha-a4`)
- [ ] Editor das tabelas de referência por organização
- [ ] Tela de conferência do laudo (Fase 3) reaproveitando `interpretacao-view`

## Fase 3 — Ingestão de PDF

- [ ] Upload + Storage + insert em `documentos` com hash
- [ ] `processar-laudo`: `unpdf` + `extrairDeTexto` + (LLM opcional) → `revisao`
- [ ] Tela de conferência lado a lado (PDF | formulário), campos por confiança
- [ ] `casar_produtor` na UI (score ≥0,90 / 0,60–0,89 / <0,60)
- [ ] Lote (várias amostras por PDF)
- [ ] **5–10 laudos reais anonimizados → casos de teste + perfis**

## Fase 4 — Portal do produtor

- [ ] `convidar-produtor` + e-mail (Resend) + `/produtor/aceitar`
- [ ] `/produtor/login`, painel com talhões e histórico, download de laudos

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
