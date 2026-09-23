# PRODUCT_AUDIT.md — Auditoria completa do repositório

Auditoria feita em 2026-09-23, antes de iniciar a transformação descrita em
`PRODUCT_V2.md`. Metodologia: leitura direta do código-fonte (schema SQL,
rotas do Next, componentes, `agro-core`), não da documentação anterior — onde
a documentação (`AGROTECH.md`, `ARQUITETURA.md`, `PROGRESSO.md`) diverge do
código real, este documento segue o código e sinaliza a divergência.

Commit auditado: `8389753`.

---

## 1. O que existe (visão de 30.000 pés)

Monorepo `npm workspaces` com três partes:

```
packages/agro-core/     motor agronômico — TS puro, 45 testes, sem DOM/DB/rede
apps/web/               Next.js 15 (App Router) — o produto
supabase/                17 migrations, 4 Edge Functions, 1 arquivo pgTAP
prototipo/agrotech.html  protótipo single-file (não é mais "congelado": recebeu
                         correções e recursos que ainda não voltaram para o Next)
```

Não existe projeto Supabase real conectado — tudo roda contra `.env.local`
com placeholders. `next build` e `tsc --noEmit` passam; nenhuma migration foi
executada contra um Postgres de verdade (sem Docker/CLI neste ambiente). Ou
seja: **o schema é código revisado, não schema validado em runtime.**

---

## 2. O que funciona (verificado nesta auditoria)

| Camada | Evidência |
|---|---|
| Motor agronômico (`agro-core`) | 45 testes vitest passando, `tsc --noEmit` limpo, cobre o caso da auditoria A1 (escolha do corretivo) |
| Build do app web | `next build` verde nas 30 rotas atuais (ver §5) |
| Tipagem do app web | `tsc --noEmit` limpo |
| Multi-tenancy no banco | Políticas RLS reescritas em `0012_tenancy.sql` (coluna = literal + guarda `RESTRICTIVE`), não testadas contra Postgres real nesta sessão — só revisadas linha a linha |
| Ingestão de laudo PDF | Fluxo completo escrito (upload → hash → extração via `unpdf` → conferência → confirmação → análise), nunca executado ponta a ponta contra Storage/Postgres reais |
| Portal do produtor | Rotas e guarda de perfil escritas; nunca autenticado de verdade (sem Supabase real) |

**Conclusão prática:** o código é sólido e consistente, mas **nada foi testado com um banco de verdade**. O primeiro risco de qualquer fase nova não é design, é "será que essas 17 migrations aplicam limpo na ordem certa". Isso deveria ser o passo zero antes de qualquer coisa em `PRODUCT_V2.md`.

---

## 3. Telas existentes (rota → o que faz → estado)

### Área do consultor (`app/(consultor)/app/*`, guarda: `role in (consultor, admin)`)

| Rota | Função | Estado |
|---|---|---|
| `/app` | Painel — chama `painel_consultor()` (RPC agregada), lista pendências químicas, área por cultura, últimas visitas | Completo, mas é uma lista plana — não tem os agrupamentos/cards que `PRODUCT_V2.md` pede |
| `/app/produtores` | Lista de produtores | Completo (leitura) |
| `/app/produtores/nova` | Criar produtor | Completo |
| `/app/produtores/[id]` | **Página mais rica do app hoje**: talhões agrupados por cultura, cadastro inline de propriedade/talhão, gestão de convite do portal, gestão de links públicos (`compartilhamentos`), exportar dados (LGPD), excluir (LGPD) | Completo, mas é uma página só — não é a "Visão 360º" com abas que `PRODUCT_V2.md` pede |
| `/app/produtores/[id]/editar` | Editar dados do produtor | Completo |
| `/app/produtores/[id]/exportar` | Download JSON de tudo do produtor (LGPD) | Completo |
| `/app/talhoes` | Lista de talhões (todos, de todos os produtores) | **Só leitura** — link "editar", sem "novo" nem "excluir" nesta tela (criar é só pela página do produtor) |
| `/app/talhoes/[id]/editar` | Editar talhão | Completo |
| `/app/analises` | Lista de análises, com filtro por cultura | **Só leitura** — sem editar, sem excluir/arquivar (a coluna `arquivado_em` existe no banco e não é usada em lugar nenhum do app) |
| `/app/analises/nova` | Lançamento manual de análise | Completo |
| `/app/analises/[id]` | Tela de interpretação (o motor aparece inteiro): réguas, perfil da CTC, diagnóstico, calagem, adubação | Completo — é a melhor tela do produto hoje |
| `/app/analises/[id]/laudo` | Laudo A4 imprimível, lido a partir de `agro.recomendacoes` (não recalculado) | Completo, com botão "Emitir laudo" que persiste a recomendação |
| `/app/laudos` | Lista de documentos PDF enviados | Completo (leitura + link para conferência) |
| `/app/laudos/novo` | **Novo nesta sessão** — upload de PDF | Escrito, não testado com banco real |
| `/app/laudos/[id]` | **Novo nesta sessão** — conferência lado a lado (PDF + formulário por confiança), casamento de produtor por trigrama | Escrito, não testado com banco real; UX ainda crua (formulário longo, sem colunas responsivas dedicadas) |
| `/app/monitoramento` | Lista de visitas | **Só leitura.** Botão "Registrar visita" está `disabled` com rótulo "(Fase 5)" — **não existe nenhum formulário de visita no Next**, embora o protótipo HTML tenha um completo e o banco tenha as 3 tabelas (`visitas`, `visita_ocorrencias`, `visita_fotos`) |
| `/app/tabelas` | Tabelas de referência (culturas, fósforo por argila) | **Só leitura.** `tabelasDaOrg()` já lê a calibração da organização quando existe, mas não há tela para editar — a única forma de calibrar hoje é escrever direto no banco |
| `/app/assinatura` | Plano atual, uso vs. limite, histórico de cobranças | Completo (leitura); a mudança de plano é manual/futura (sem checkout) |

### Área do produtor (`app/(produtor)/produtor/*`, guarda: `role = produtor`)

| Rota | Função | Estado |
|---|---|---|
| `/produtor` | Painel: talhões com situação em linguagem simples ("precisa de correção" / "solo em ordem"), última recomendação | Completo, mas é uma tela só — sem os módulos (Financeiro, Produção, Documentos) que `PRODUCT_V2.md` pede |
| `/produtor/laudos/[id]` | Laudo completo, mesma renderização do consultor | Completo |

### Auth / público

| Rota | Função | Estado |
|---|---|---|
| `/login`, `/cadastro` | Login e cadastro do consultor | Completo. `/cadastro` cria conta via `signUp`; `garantirEscritorio()` cria a org + semeia tabelas + assinatura trial no primeiro acesso ao `/app` |
| `/produtor/login`, `/produtor/aceitar` | Login do produtor e aceite de convite | Completo (RPC `aceitar_convite` faz o vínculo) |
| `/r/[token]` | Link público "bruto" de resultados (sem login), por produtor ou por cultura | Completo |
| `/demo`, `/demo/tabelas` | Vitrine pública sem banco (dados fixos) | Completo |

**Faltam por completo:** agenda, notificações, busca global / command palette, relatórios (`/app/relatorios`), inteligência da carteira (`/app/inteligencia`), qualquer coisa financeira, qualquer coisa de produção/safra. Nenhuma dessas existe em nenhuma forma, nem como rota vazia.

---

## 4. Banco de dados (schema `agro`, 17 migrations)

### Tabelas existentes

| Tabela | Papel | Observação |
|---|---|---|
| `orgs` | Organização/escritório | — |
| `profiles` | 1:1 com `auth.users`; `role` é `text check (in admin, consultor, produtor)` | **Não é enum, é `check` em texto** — importa para §26 do pedido (multiusuário) |
| `produtores` | Cliente do consultor | `origem` distingue `manual`/`pdf` |
| `propriedades` | Sob produtor | — |
| `talhoes` | Sob propriedade | `cultura` é `text not null` livre (chave do dicionário `PADRAO.culturas`), não FK — calibração por organização vive em `tabelas_referencia`, não numa tabela de culturas relacional |
| `documentos` | Laudo em PDF | enum `doc_status` (`recebido/extraindo/extraido/revisao/confirmado/erro`) |
| `analises` | Análise de solo | `origem` `manual`/`pdf`; `arquivado_em` existe mas **nenhuma tela usa** |
| `recomendacoes` | Recomendação persistida (`motor_versao` + `tabelas_snapshot` + `resultado` jsonb) | `arquivada_em` existe, também não usada em UI |
| `visitas`, `visita_ocorrencias`, `visita_fotos` | Caderno de campo | Ver §3 — sem tela de escrita no Next |
| `tabelas_referencia` | Calibração por org (5 linhas: `faixas/fosforo/culturas/fertilizantes/pragas`) | Sem editor visual |
| `convites` | Convite do produtor para o portal | — |
| `compartilhamentos` | Link público `/r/[token]` | — |
| `audit_log` | Trilha de auditoria (LGPD) | Só `insert`/`select`, sem UI de consulta (nenhuma tela lista o log) |
| `planos`, `assinaturas`, `cobrancas` | **Isto já é o "plans / subscriptions / usage_limits" pedido no §25** | `checar_limite()` (trigger) recusa insert em `produtores`/`talhoes`/`documentos` quando o plano estoura. **Ver PRODUCT_V2.md — não recriar isso do zero.** |

### O que NÃO existe no banco hoje

- Nenhuma tabela financeira (`financeiro_*`)
- Nenhuma tabela de produção/safra (`producao`, `safras`)
- Nenhuma tabela de agenda/evento (só `visitas.proxima_visita`, um único campo de data)
- Nenhuma tabela de notificações
- Nenhum papel além dos 3 atuais (`admin/consultor/produtor`) — sem `tecnico`/`assistente`/`proprietario`
- Nenhuma tabela de cultura relacional (cultura é uma chave de texto livre + um dicionário JSON por organização)

### RLS — modelo atual (já reescrito uma vez nesta sessão)

`0012_tenancy.sql` é a segunda geração do modelo de isolamento:

1. `org_id`/`produtor_id` **desnormalizados** em toda tabela de dados, preenchidos por trigger `BEFORE INSERT` que herda do pai (`talhoes` herda de `propriedades`, que herda de `produtores`)
2. Um `custom_access_token_hook` injeta `org_id`/`user_role`/`produtor_id` no JWT a cada emissão de token
3. `agro.jwt_org()` / `jwt_role()` / `jwt_produtor()` leem o claim, com **fallback a uma consulta em `profiles`/`produtores`** quando o claim ainda não existe (token velho) — isso é o que torna o rollout seguro, mas também significa que **hoje toda política ainda pode cair no fallback lento** se o hook não estiver ligado no projeto real (`config.toml` já pede para ligar, mas isso é um passo manual no painel do Supabase, não é código)
4. Política `RESTRICTIVE` de tenant em cada tabela de dados (`org_id = jwt_org()`), mais políticas `PERMISSIVE` por papel (`consultor` = tudo da org; `produtor` = só as próprias linhas, via `produtor_id`)

**Isto nunca rodou `supabase test db` de verdade.** O arquivo `supabase/tests/rls.test.sql` existe e cobre o caso obrigatório (produtor A não lê talhão de B), mas não há evidência de execução real — é o item de maior risco técnico do projeto inteiro, porque é exatamente o tipo de bug que só aparece em runtime (erro de sintaxe numa policy, referência circular, trigger que não dispara na ordem esperada).

---

## 5. Autenticação

- Supabase Auth padrão (e-mail/senha), sem OAuth social
- `config.toml` já pede senha mínima 10 + variedade de caracteres, MFA TOTP disponível, rate limit apertado no token — **tudo isso é configuração declarada, não testada; e itens como CAPTCHA/checagem de senha vazada exigem ligar manualmente no painel do projeto real (secret do Turnstile), não são só código**
- Perfis: `consultor`/`admin` entram por `/login`; `produtor` só entra por convite (`/produtor/aceitar`), nunca se autocadastra
- Middleware (`apps/web/lib/supabase/middleware.ts`) faz o roteamento por perfil como conveniência de navegação; a barreira real é a RLS

---

## 6. Componentes de UI existentes

Tudo em `apps/web/components/`, sem biblioteca externa (nada de shadcn/ui, Radix, Tailwind — CSS próprio em `app/globals.css` com custom properties). Isso é uma decisão consciente de estágio anterior do projeto, não um acidente.

| Componente | Papel |
|---|---|
| `ui.tsx` | Primitivas: `Cartao`, `CabecalhoVista`, `Grade`, `Metrica`, `Tag`, `Vazio`, `Olho` |
| `nav-abas.tsx` | Navegação em abas horizontais, uma única fileira, sem agrupamento |
| `regua-interpretacao.tsx` | Régua de classificação (o elemento-assinatura da marca) |
| `perfil-ctc.tsx` | Barra de ocupação da CTC |
| `interpretacao-view.tsx` | A tela de interpretação inteira, componentizada e reusada em 3 lugares (`/app/analises/[id]`, `/demo`, potencialmente laudo) |
| `laudo-view.tsx` | O laudo A4, renderiza de uma `Recomendacao` já calculada |
| `botao-imprimir.tsx` | `window.print()` |
| `form-produtor.tsx`, `form-talhao.tsx`, `form-analise.tsx` | Formulários server-component (exceto `form-analise`, que é client para o estado de pending) |
| `link-compartilhado.tsx` | Campo de URL com botão copiar |

**Não existem ainda:** `PageHeader` genérico (existe `CabecalhoVista`, que cobre parte disso), `MetricCard` (existe `Metrica`, mais simples que o pedido), `StatusBadge` (existe `Tag`, sem semântica de "crítico/atenção/ok" formalizada em variantes), `EmptyState` (existe `Vazio`), `DataTable`, `FilterBar`, `SearchInput`, `Timeline`, `ActivityItem`, `ChartCard`, `SectionCard`, `ProducerSelector`, `FarmSelector`, `PlotSelector`, `DateRangeFilter`, `NotificationCenter`, `QuickCreate`. Ou seja: **a base existe e é reaproveitável, mas o design system do pedido (§23) é, em grande parte, novo trabalho — não renomeação do que já existe.**

Não há gráficos (nenhuma lib de chart instalada) e não há tabela de dados genérica (cada lista é HTML `<table>` escrita à mão).

---

## 7. Problemas e dívida técnica (por ordem de risco)

1. **RLS nunca validada contra Postgres real.** Maior risco do projeto. Antes de qualquer fase nova, rodar as 17 migrations num projeto Supabase de fato e `supabase test db`.
2. **`agro.audit_log` sem consumidor.** Grava, ninguém lê. Qualquer alegação de "conformidade LGPD" fica capenga sem uma tela `/app/auditoria`.
3. **`analises.arquivado_em` e `recomendacoes.arquivada_em` existem e não são usados.** Não há como "excluir" uma análise da UI hoje — só existe o hard delete de produtor inteiro (LGPD).
4. **Monitoramento (visitas) é só leitura no Next.** Uma feature inteira (caderno de campo) documentada como pronta no `PROGRESSO.md` na verdade não tem formulário no produto atual — só no protótipo HTML. Isso é a maior divergência entre documentação e código real encontrada nesta auditoria.
5. **Tabelas de referência sem editor.** A promessa central do produto ("cada escritório calibra a própria tabela") não tem UI — só existe programaticamente.
6. **Talhões e análises sem delete/archive na UI.** Cadastro errado hoje não tem correção fácil pelo app (fora editar campo a campo).
7. **`role` é `text check`, não enum, e só tem 3 valores.** Extensão para `tecnico`/`assistente`/`proprietario` (§26 do pedido) exige decidir entre manter `text check` (fácil de estender, fraco em integridade) ou migrar para `enum` (mais seguro, migração mais cuidadosa porque enums do Postgres não removem valores fácil).
8. **`talhoes.cultura` é texto livre, sem FK.** Bom para flexibilidade (cada org calibra `PADRAO.culturas`), ruim para agregações confiáveis em `/app/inteligencia` (basta um typo para quebrar um `group by`).
9. **Sem paginação em lugar nenhum.** Toda lista (`/app/analises`, `/app/produtores`, `/app/talhoes`) faz `select *` sem `limit`/`range`. Funciona com dezenas de linhas, não com milhares.
10. **Sem testes de UI/E2E.** Só há testes unitários do motor (`agro-core`). Nenhum teste cobre uma rota do Next ou um fluxo completo.
11. **Sem CI rodando de fato.** `.github/workflows/ci.yml` existe e está correto, mas não há evidência de execução (não há Actions history neste ambiente local).
12. **Design sem dark mode.** `globals.css` define só um tema (`color-scheme: light`, sem bloco `prefers-color-scheme: dark`). Decisão consciente documentada em sessões anteriores (metáfora de "papel"), mas vale confirmar se ainda é a decisão certa para um produto B2B que vai concorrer com Linear/Stripe/Vercel (que têm dark mode).
13. **Sem biblioteca de gráficos.** Qualquer coisa em §6 (radar de fertilidade, evolução histórica, comparador) e em §7/§12 (inteligência da carteira, financeiro) precisa de uma decisão de lib (Recharts é o que o pedido do usuário já assume).

---

## 8. Funcionalidades incompletas (resumo executivo)

| Módulo | Status |
|---|---|
| Motor agronômico | ✅ Completo e testado |
| CRUD de produtores/propriedades/talhões | 🟡 Completo, mas sem delete/archive |
| Análises manuais | 🟡 Completo, sem editar/arquivar |
| Ingestão de PDF | 🟡 Escrita nesta sessão, não testada com infra real |
| Laudo e recomendação persistida | ✅ Completo |
| Portal do produtor (leitura) | ✅ Completo |
| Portal do produtor (financeiro/produção/documentos) | ⛔ Não existe |
| Monitoramento/visitas | ⛔ Só leitura, sem formulário |
| Tabelas de referência (editor) | ⛔ Só leitura |
| Billing/planos | 🟡 Schema completo, sem checkout, sem UI de upgrade |
| Agenda | ⛔ Não existe |
| Notificações | ⛔ Não existe |
| Relatórios | ⛔ Não existe |
| Inteligência da carteira | ⛔ Não existe |
| Busca global / command palette | ⛔ Não existe |
| Multiusuário (papéis granulares) | ⛔ Não existe (só 3 papéis fixos) |
| Financeiro (produtor) | ⛔ Não existe — nenhuma tabela, nenhuma rota |
| Produção/safra | ⛔ Não existe |

---

## 9. Conclusão da auditoria

O projeto tem uma fundação tecnicamente correta e incomum para este estágio:
motor agronômico isolado e testado, RLS desenhada com cuidado (embora não
validada em runtime), rastreabilidade de recomendação, LGPD parcialmente
implementada. O que falta para o pedido do usuário não é "consertar o que
está quebrado" — é, na maior parte, **construir módulos que simplesmente
ainda não existem** (financeiro, agenda, notificações, inteligência,
relatórios, portal do produtor rico) sobre uma base que já aceita bem essa
extensão, mais **terminar módulos que pararam na metade** (monitoramento sem
form, tabelas sem editor, sem delete/archive).

A base de billing (`planos/assinaturas/cobrancas` + `checar_limite()`) já
satisfaz boa parte do §25 do pedido — a recomendação em `PRODUCT_V2.md` é
estendê-la, não recriar `plans/subscriptions/usage_limits` do zero.

Antes de qualquer fase de implementação: **validar as 17 migrations contra um
Supabase real e rodar `supabase test db`.** Sem isso, cada nova migration
proposta em `DATABASE_CHANGES.md` empilha risco não observável sobre risco
não observável.
