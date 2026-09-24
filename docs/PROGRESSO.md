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
      migrations `0019–0023` propostas (não escritas).
- [x] **Fase 4 do pedido — Visão 360º do talhão** (`/app/talhoes/[id]`) —
      maior lacuna estrutural identificada na auditoria, agora existe.
      Header com situação/status; abas: **Visão geral** (métricas + dados de
      cadastro), **Solo & Nutrição** (fundido de propósito — reaproveita
      `InterpretacaoView` inteira, que já cobre as duas coisas juntas),
      **Histórico** (linha do tempo mesclando análises + recomendações +
      visitas, ordenada por data), **Recomendações** (persistidas, com link
      pro laudo), **Monitoramento** (visitas e ocorrências), **Fotos**
      (signed URLs do bucket `visitas`), e **Custos**/**Produção** como
      estado vazio explícito apontando para as migrations `0019`/`0020`
      propostas (ainda não existem). Componente novo reutilizável:
      `components/abas-paineis.tsx` (abas de conteúdo dentro da página,
      client-side, state local — diferente de `nav-abas.tsx`, que navega
      entre rotas). Linkado a partir de `/app/talhoes` e da tabela de
      talhões em `/app/produtores/[id]`.
- [x] **Pré-requisito transversal — validado contra Supabase real (2026-09-23).**
      Gustavo passou a connection string de um projeto Supabase real
      (vazio) e o repositório GitHub `thgustavo62-design/Agrotech`. `npx
      supabase db push --db-url` (não precisa de Docker — só `supabase
      start`/dev local precisa) rodou as 20 migrations e achou 2 bugs reais,
      **nunca antes executados com sucesso em lugar nenhum**, corrigidos nos
      próprios arquivos: `unaccent()` é `STABLE` não `IMMUTABLE`
      (`nome_norm` em `0002` não compilava — corrigido com o envelope
      `agro.unaccent_imutavel()`), e `0012_tenancy.sql` tentava `drop
      function talhao_na_minha_org` antes de derrubar as políticas que
      ainda dependiam dela (`2BP01` — reordenado). As 20 migrations agora
      rodam limpo do zero. `supabase test db` (pgTAP) ainda não rodou —
      depende do runner local via Docker, que este ambiente não tem.
      Repositório conectado como `origin` (estava vazio, sem risco de
      sobrescrever nada). Credenciais só em `supabase/.env`/`.env.local`
      (gitignored), nunca commitadas.
- [x] **Fase 1 do pedido — navegação agrupada** — sidebar (desktop, ≥960px) com
      4 grupos (Visão geral / Gestão técnica / Inteligência / Gestão), colapsável
      (`lateral-consultor.tsx`, estado em `localStorage`); barra inferior no
      mobile com os 5 itens mais usados + "Mais" abrindo gaveta com o resto
      (`barra-mobile.tsx`); breadcrumbs estruturais que pulam segmentos de uuid
      (`breadcrumbs.tsx`); paleta de comandos `Ctrl/Cmd+K` buscando produtores/
      propriedades/talhões por `ilike` (`paleta-comandos.tsx`, sem full-text
      search — ver `UX_ARCHITECTURE.md §8.3`). `nav-abas.tsx` removido (as abas
      horizontais viravam a sidebar). Ícones próprios em `components/icones.tsx`
      (SVG de linha, sem lib nova). Fonte única do menu: `lib/navegacao.ts`.
      Todo item do menu é um link de verdade, mesmo os "em breve" — a página de
      destino explica o que falta, em vez de item de menu morto.
    - Três telas novas viraram reais no processo (dado já existente, sem
      schema novo): `/app/pendencias` (recorte do painel), `/app/propriedades`
      (lista com link pro produtor), `/app/recomendacoes` (lista com link pro laudo)
    - Seis telas novas são placeholder "em breve" com explicação e link pra
      fase certa: `/app/agenda`, `/app/inteligencia`, `/app/relatorios`,
      `/app/financeiro-escritorio`, `/app/equipe`, `/app/config`
    - **Exceção:** `/app/config` ganhou uma função real além do placeholder —
      editar nome/CREA/ART/telefone do próprio consultor (`profiles_atualiza_proprio`
      já cobria isso por RLS, só faltava a tela). Renomear o escritório
      (`orgs.nome`) continua sem UI — não há política de UPDATE em `orgs` hoje.
- [x] **Fase 2 do pedido — Central Operacional** (`0018_painel_v2.sql` + `/app`
      reescrito). `painel_consultor()` ganhou, sem quebrar contrato com quem já
      a chamava (`create or replace`, mesma assinatura): `visitas_atrasadas`
      (lista + total, a partir de `visitas.proxima_visita` — não há
      `agenda_eventos` ainda), `proximas_visitas`, `recomendacoes_pendentes`
      (análises sem recomendação emitida, lista + total),
      `recomendacoes_emitidas_mes`, `produtores_sem_visita_recente` (60 dias),
      `talhoes_sem_analise_atualizada` (180 dias), e **`atividade_recente`**
      lendo `audit_log` — que finalmente ganhou um consumidor de UI (dívida
      técnica #2 de `PRODUCT_AUDIT.md`). A tela virou: 2 fileiras de métricas
      (o que pede atenção / visão geral), **"Precisa da sua atenção"**
      mesclando os 4 tipos de pendência em prioridade (crítico > atrasado >
      recomendação pendente > próxima visita), Área por cultura (mantido) e
      Atividade recente (novo, timeline com rótulos em português + link pra
      cada evento). `analises/nova/acoes.ts` (`criarAnalise`) ganhou uma
      chamada a `registrar()` que faltava — sem isso a timeline não veria
      análises lançadas manualmente.
- [x] **Fase 3 do pedido — Visão 360º do produtor** (`/app/produtores/[id]`
      reescrito em abas, mesmo padrão de `abas-paineis.tsx` da Fase 4). Header
      fora das abas: nome/contato, tag de situação agregada (pior caso entre
      os talhões: precisa de correção > fósforo baixo > em ordem > sem
      análise), métricas (culturas/talhões/área/análises), última/próxima
      visita. Nove abas: **Resumo** (alertas, área por cultura, últimas
      análises com seta de tendência ▲/▼/– comparando com a coleta anterior do
      mesmo talhão — substituto honesto e sem dependência nova para o
      "gráfico de evolução do solo" do pedido, já que Recharts é não-objetivo
      declarado em `PRODUCT_V2.md`), **Propriedades**, **Talhões** (agrupado
      por cultura, com um único `resumos` pré-computado por talhão em vez de
      recalcular `calcular()` por linha), **Análises** (lista achatada de
      todos os talhões do produtor), **Recomendações** (`agro.recomendacoes`
      filtrado por `produtor_id`, denormalizado desde `0012`), **Visitas**
      (`agro.visitas` por `talhao_id`, hoje vazio — não existe formulário de
      registrar visita, achado já registrado em `PRODUCT_AUDIT.md`),
      **Documentos** (`agro.documentos` por `produtor_id`), **Acesso**
      (desvio deliberado da lista de 9 abas do pedido: agrupa links de
      resultados + convite de portal + zona de risco LGPD, que já existiam e
      não mapeiam limpo pra nenhum nome do pedido — preferível a espalhar ou
      forçar dentro de "Resumo"), **Linha do tempo** (novo: junta os ids do
      produtor + talhões + análises + recomendações + documentos + visitas e
      consulta `audit_log` uma vez por todos). **Sem aba Financeiro** — o
      pedido já condiciona essa aba ao opt-in do produtor, e o schema
      `financeiro_*` de `DATABASE_CHANGES.md` ainda não existe; melhor omitir
      que simular. Extraído para reaproveitar entre painel e produtor:
      `lib/atividade.ts` (rótulo + link de `audit_log`) e `lib/documentos.ts`
      (rótulo de status de `agro.documentos`) — `/app` e `/app/laudos`
      passaram a importar dali em vez de duplicar.
- [x] **Fase 6 do pedido — Financeiro do produtor** (`0019_safras.sql` +
      `0020_financeiro.sql`, primeiras migrations novas desde a auditoria além
      de `0018`). Schema: `financeiro_categorias` (16 padrão semeadas via
      `semear_categorias_financeiras()`, mesmo padrão do `garantirEscritorio()`
      do onboarding), `financeiro_centros_custo`, `financeiro_contas`,
      `financeiro_lancamentos` (receita/despesa, status
      pendente/pago/atrasado/cancelado, comprovante opcional), `financeiro_orcamentos`.
      **Isolamento total por decisão de produto** (`PRODUCT_V2.md §2.2`):
      nenhuma tabela `financeiro_*` tem política de consultor — nem leitura —
      só `produtor_id = jwt_produtor()`. Bucket de Storage `financeiro` novo
      (não estava na proposta original, adicionado para o comprovante ter
      algo de verdade por trás — ver divergência anotada em
      `DATABASE_CHANGES.md`). `agro.safras` nasceu junto (pré-requisito de
      `safra_id` em lançamento/orçamento) mas só a tabela — `producao_registros`
      continua proposta, fica para quando a Fase 7 for implementada de fato.
    - Tela nova `/produtor/financeiro` (abas: Resumo, Lançamentos, Contas &
      categorias, Orçamento). Orçamento compara ao gasto pago no ano civil —
      sem seletor de safra ainda (chega com a Fase 7); o valor planejado é
      só por categoria por enquanto.
    - `/produtor` ganhou o card "Resumo financeiro" (saldo + pendências,
      linkando pro financeiro) citado em `UX_ARCHITECTURE.md §7`.
    - Como a Fase 5 (dashboard/menu do produtor) ainda não foi implementada,
      não existe o menu de 7 itens que `UX_ARCHITECTURE.md §1.2` desenha —
      criei só um nav mínimo de 2 itens (Início/Financeiro) no header do
      portal, o suficiente pra não deixar `/produtor/financeiro` orfão.
      Os outros 5 itens do menu (Fazenda, Talhões, Recomendações,
      Atividades, Produção, Documentos) continuam não existindo até que
      suas fases cheguem.
    - Sem feature flag de plano: `planos.features.financeiro` é da Fase 11
      (`0023`, ainda proposta) — por ora todo produtor autenticado vê o
      financeiro, independente do plano do escritório.
    - Novo em `lib/`: `financeiro.ts` (rótulos de status, `statusEfetivo()` —
      calcula "atrasado" na hora da leitura, já que não há job de fundo
      mudando o status gravado — e `resumoFinanceiro()`, reaproveitado pelo
      card do dashboard) e `moeda()` em `formato.ts`. `produtorAtual()` novo
      em `lib/supabase/server.ts` (id de `agro.produtores` do usuário logado).
- [ ] Fases 5, 7–11 — ver `PRODUCT_V2.md §3` para o roadmap completo

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
