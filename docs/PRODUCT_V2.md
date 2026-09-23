# PRODUCT_V2.md — AgroTech como dois produtos, uma infraestrutura

Plano de transformação do AgroTech em produto comercial completo (Central do
Agrônomo + Portal do Produtor), a partir do pedido do usuário de 2026-09-23 e
das constatações de `PRODUCT_AUDIT.md`. Este documento decide as ambiguidades
do pedido original contra o estado real do código — não repete o pedido, o
resume e o ancora em decisões concretas.

Companheiros deste documento: `UX_ARCHITECTURE.md` (navegação e telas),
`DATABASE_CHANGES.md` (schema novo).

---

## 1. Princípio central (confirmado, sem mudança)

Duas experiências sobre a mesma infraestrutura, isoladas por RLS — nunca por
esconder botão no frontend. Isso já é a filosofia do projeto desde a Fase 1
(ver `0012_tenancy.sql`) e continua sendo o critério de aceite de toda
feature nova: **se uma tabela nova não tem RLS no mesmo PR que a cria, o PR
não está pronto.**

A auditoria confirma que os dois perfis (`consultor`/`admin` e `produtor`) já
não compartilham layout, navegação nem dados — a separação existe. O que
falta é *conteúdo*: o produtor hoje só tem uma tela de leitura; a central do
agrônomo hoje é uma lista de abas, não uma central operacional.

---

## 2. Decisões de arquitetura (resolvendo as ambiguidades do pedido)

O pedido original descreve funcionalidades; aqui estão as decisões que elas
exigem e que o pedido não especificou.

### 2.1 Billing — reaproveitar, não recriar

O pedido (§25) pede tabelas `plans`, `subscriptions`, `usage_limits`.
**Isso já existe** como `agro.planos`, `agro.assinaturas`, `agro.cobrancas` +
o trigger `checar_limite()` (limite de produtores/talhões/laudos por mês,
recusado no próprio banco). Decisão: **estender essas três tabelas**, não
criar um segundo sistema paralelo. O que falta nelas para atender o pedido:

- `planos` já tem os limites numéricos; falta um campo `features` (jsonb ou
  colunas booleanas) para feature flags por plano (§25, "criar feature
  flags") — ex.: `financeiro_habilitado`, `relatorios_avancados`,
  `usuarios_max`.
- `assinaturas` está 1:1 com `orgs`; multiusuário (§26) não muda isso — o
  plano continua sendo da organização, não do usuário.

### 2.2 Financeiro do produtor — isolamento total, não "consultor com acesso de leitura"

O pedido é explícito: "o agrônomo NÃO poderá editar" e trata financeiro como
pertencente ao produtor. Decisão, para não deixar isso em aberto: **o
consultor não tem NENHUM acesso — nem leitura — às tabelas financeiras do
produtor.** RLS das tabelas `financeiro_*` só concede linhas onde
`produtor_id = agro.jwt_produtor()`; não existe política `consultor`. Isso é
mais simples de raciocinar e mais defensável do ponto de vista de LGPD do que
"consultor lê, não edita" (que exigiria uma política extra e uma decisão de
produto sobre até onde vai a curiosidade do agrônomo sobre a vida financeira
do cliente). Se um dia o produtor quiser compartilhar isso com o consultor,
vira uma feature explícita de compartilhamento (mesmo padrão de
`compartilhamentos` que já existe para resultados agronômicos), não um
acesso implícito.

A ligação agronomia → financeiro (§13, "Simular custo") é **só de leitura
para o lado agronômico**: o app lê `recomendacoes.resultado` (dose, área) e
o preço vem do produtor digitando na hora. O botão "Adicionar ao
planejamento" grava em `financeiro_lancamentos` com `produtor_id` do usuário
logado — nunca em nome do consultor.

### 2.3 Multiusuário — extensão aditiva do `role`, sem quebrar o que existe

`profiles.role` hoje é `text check (in admin, consultor, produtor)`. O
pedido (§26) quer `proprietario, agronomo, tecnico, assistente` no lado do
escritório, "mantendo compatibilidade". Decisão:

- Tratar `admin`/`consultor` atuais como o papel `proprietario` implícito
  (primeiro usuário do escritório = dono).
- Adicionar os novos valores ao mesmo `check` (não migrar para enum agora —
  o audit já observou que enum dificulta reverter; texto com `check` é
  reversível com uma migration simples).
- **Não implementar permissões granulares por papel na Fase 1 deste plano.**
  Nas Fases 1–10, todo papel do lado "escritório" (`proprietario`,
  `consultor`/`agronomo`, `tecnico`, `assistente`) tem o mesmo acesso de
  hoje (tudo da própria org). A tabela `agro.profiles` ganha uma coluna
  `titulo` (rótulo livre, cosmético) enquanto a permissão granular real
  fica para depois de existir mais de um usuário por org na prática — é
  fácil errar RLS "no escuro", sem um caso de uso real para calibrar.

### 2.4 Cultura — mantém texto livre, sem migrar para catálogo relacional agora

`talhoes.cultura` é `text` livre hoje, validado contra o dicionário
`PADRAO.culturas` (ou o calibrado da org) só na camada de aplicação. Migrar
para uma tabela `agro.culturas` com FK resolveria a integridade que
`/app/inteligencia` (Fase 8) precisa, mas é uma migração de dado arriscada
(toda linha de `talhoes` precisa ser revalidada). Decisão: **Fase 8
(Inteligência) lê `talhoes.cultura` como está e trata inconsistências na
consulta (normalização por `lower(trim(cultura))`), sem mudar o schema.**
Reavaliar depois que houver uso real com dados reais — hoje o app não tem
nenhum tenant de produção, então não há ainda urgência para essa migração.

### 2.5 Nome dos papéis de UI ("Início" vs "Painel", etc.)

O pedido usa "INÍCIO" para a home do agrônomo; o app usa "Painel" hoje. Como
os dois nomeiam a mesma coisa, mantemos **"Painel"** (já é a rota `/app` e
aparece em documentação anterior) e usamos "Início" só como sinônimo em
prosa. Evita renomear rota e quebrar link/bookmark por causa de rótulo.

### 2.6 Notificações — tabela + polling, sem realtime na primeira fase

O pedido pede central de notificações. Decisão: começar com uma tabela
`agro.notificacoes` lida por `select` normal (RLS por destinatário) e um
badge que revalida no carregamento de página — **não** WebSocket/Realtime do
Supabase na primeira fase (mais infraestrutura, mais uma coisa para validar
contra Postgres real antes de existir, e o app já é majoritariamente
navegado por página, não SPA). Realtime fica como melhoria de Fase 9+.

---

## 3. O que a auditoria muda no roteiro pedido

O pedido pede uma ordem de 11 fases. Mantemos a ordem, mas cada fase agora
sabe o que **já existe** (reaproveitar) e o que é **novo de verdade**:

| Fase do pedido | Já existe (reaproveitar) | Novo |
|---|---|---|
| 1 — Arquitetura UX/navegação | `nav-abas.tsx`, layouts com guarda | Agrupamento de menu, breadcrumbs, command palette |
| 2 — Dashboard Agrônomo | `painel_consultor()` RPC, painel atual | Cards adicionais, seção "Precisa da sua atenção", timeline |
| 3 — Visão 360º produtor | `/app/produtores/[id]` (rico, mas 1 página) | Abas, mapa, gráfico de evolução |
| 4 — Visão 360º talhão | Nada dedicado — hoje o talhão só aparece dentro da página do produtor e em `/app/analises/[id]` | Página nova inteira |
| 5 — Dashboard Produtor | `/produtor` (painel simples) | Cards de atenção, atividades, resumo financeiro |
| 6 — Financeiro Produtor | Nada | Schema completo + telas (ver `DATABASE_CHANGES.md`) |
| 7 — Produção e safra | Nada | Schema completo + telas |
| 8 — Inteligência e relatórios | `painel_consultor()` mostra um recorte pequeno | `/app/inteligencia`, `/app/relatorios`, export PDF/CSV |
| 9 — Agenda/notificações | `visitas.proxima_visita` (um campo de data) | Agenda de verdade + notificações + **formulário de visita, que hoje nem existe** |
| 10 — Polimento mobile/PWA | Layout já responsivo (grid quebra em telas estreitas) | `manifest.json`, service worker, modo offline de campo |
| 11 — Planos SaaS | **Já existe quase tudo** (`planos/assinaturas/cobrancas/checar_limite`) | Feature flags por plano, tela de upgrade, checkout Asaas real |

**Consequência prática:** a Fase 9 do pedido ("Agenda/notificações") na
verdade também precisa carregar o débito técnico #4 do audit (formulário de
visita que não existe) — sem isso, "agenda" não tem o que agendar de
verdade além de "próxima visita".

---

## 4. Pré-requisito que corre em paralelo a tudo: validar a infraestrutura

Antes ou durante a Fase 1, e independente dela: **rodar as 17 migrations
existentes contra um projeto Supabase real** (`supabase link` + `supabase db
push`) e `supabase test db`. Nenhuma migration nova de `DATABASE_CHANGES.md`
deveria empilhar em cima de um schema nunca executado. Isto não é uma fase
do produto, é a base de confiança de todas as fases — está sinalizado aqui
para não ser esquecido entre os itens "visíveis" do roteiro.

---

## 5. Critérios de pronto (por fase, gerais)

Aplicam-se a toda fase deste plano, não só às primeiras:

1. RLS nova (se houver tabela nova) testada em `supabase/tests/*.sql`.
2. `npm run typecheck` e `next build` verdes.
3. `npm run test:core` continua 45/45 (ou mais, se a fase mexer no motor).
4. Nenhuma tela nova quebra o critério "produtor nunca vê dado de outro
   produtor nem menu do consultor" — verificado manualmente navegando como
   cada papel.
5. Toda tabela nova tem `criado_em`; `atualizado_em` quando a linha muda de
   estado ao longo do tempo (ex.: `financeiro_lancamentos.status`).
6. Nenhuma feature nova depende de rede externa que não esteja documentada
   em `.env.example`.

---

## 6. Não-objetivos explícitos desta etapa

Para não deixar escopo implícito:

- **Não** implementar cobrança real (checkout Asaas) nesta leva — o webhook
  já existe (`webhook-asaas`), falta só a conta sandbox e o botão de
  assinar, que é trabalho de integração, não de arquitetura.
- **Não** migrar CSS para Tailwind/shadcn — o pedido cita essas libs na
  lista de especialidade, mas o app já tem um sistema visual funcionando
  (`globals.css` com tokens); trocar de framework de CSS é custo alto sem
  benefício de produto claro. Se popularmos `DataTable`/`ChartCard`/etc.,
  fazemos como componentes próprios sobre o CSS existente, mantendo a
  identidade visual já validada.
- **Não** adicionar dark mode nesta leva, a menos que vire pedido explícito
  — é uma mudança transversal grande (todo token de cor precisa de par) e
  não está nos critérios de aceite do pedido original.
- **Não** implementar OCR de PDF digitalizado — já é uma lacuna conhecida e
  documentada (`AUDITORIA-02.md`), fora do escopo deste pedido.

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| RLS nunca validada em runtime (ver audit §4) | Rodar migrations + `supabase test db` antes/durante a Fase 1 |
| Financeiro mal isolado do consultor por erro de RLS | Nenhuma política `consultor` nas tabelas `financeiro_*`, por decisão de design (§2.2) — mais fácil de auditar que "leitura sim, escrita não" |
| `cultura` como texto livre quebrando agregações da Fase 8 | Normalização na consulta (§2.4); não é bloqueante, é aceitável para o volume de dados atual |
| Escopo do pedido é maior que uma sessão de trabalho | Este documento fasea; cada fase é entregável e revisável isoladamente — não faz sentido tentar tudo de uma vez, e o próprio pedido pede isso na seção 30 |
