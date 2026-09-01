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
- [x] `apps/web` — esqueleto Next 15: middleware por perfil, clientes Supabase, `login`, layout+painel do consultor, componentes `regua-interpretacao` e `perfil-ctc` portados
- [ ] `apps/web` — instalar deps e rodar `next build` (precisa de rede + `.env.local`)
- [ ] Projeto Supabase real (staging) + `supabase link` + primeira `db push`
- [ ] CRUD completo de produtores / propriedades / talhões no Next
- [ ] Rota `/cadastro` que semeia `tabelas_referencia` da org a partir de `clonarPadrao()`

## Fase 2 — Análise e recomendação

- [ ] Tela de lançamento manual da análise (form do protótipo → React)
- [ ] Tela de interpretação (réguas, perfil da CTC, diagnóstico, calagem, adubação)
- [ ] `gerar-laudo-pdf` de verdade (layout `.folha-a4`)
- [ ] Editor das tabelas de referência por organização

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
