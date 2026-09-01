# AgroTech — Documentação técnica

Módulo de assistência técnica agronômica do ecossistema Campo Forte.
Versão do documento: 1.0 · Agosto de 2026 · Nova7 / Campo Forte Soluções Agrícolas

> **Nota (set/2026):** este documento é a *visão*. Para o que já está
> implementado no repositório, ver [ARQUITETURA.md](ARQUITETURA.md) (as-built),
> [MOTOR.md](MOTOR.md) (fórmulas) e [PROGRESSO.md](PROGRESSO.md). A Fase 1 usa
> **npm workspaces** no lugar de pnpm/turbo — troca mecânica, adiada de propósito.

---

## Sumário

1. [O que é o AgroTech](#1-o-que-é-o-agrotech)
2. [Estado atual: o protótipo HTML](#2-estado-atual-o-protótipo-html)
3. [O motor agronômico](#3-o-motor-agronômico)
4. [Arquitetura alvo](#4-arquitetura-alvo)
5. [Perfis de acesso e autenticação](#5-perfis-de-acesso-e-autenticação)
6. [Modelo de dados no Supabase](#6-modelo-de-dados-no-supabase)
7. [Row Level Security](#7-row-level-security)
8. [Ingestão de laudo em PDF](#8-ingestão-de-laudo-em-pdf)
9. [Cadastro automático a partir do laudo](#9-cadastro-automático-a-partir-do-laudo)
10. [Estrutura do repositório](#10-estrutura-do-repositório)
11. [GitHub: fluxo, CI/CD e migrações](#11-github-fluxo-cicd-e-migrações)
12. [Variáveis de ambiente](#12-variáveis-de-ambiente)
13. [Roadmap por fases](#13-roadmap-por-fases)
14. [Segurança, LGPD e responsabilidade técnica](#14-segurança-lgpd-e-responsabilidade-técnica)
15. [Limitações conhecidas](#15-limitações-conhecidas)

---

## 1. O que é o AgroTech

O AgroTech é o lado do técnico dentro do Campo Forte. Enquanto o Campo Forte monitora preço de commodity para o produtor da região de Colatina, o AgroTech cuida do que acontece antes da venda: o solo, a nutrição e a sanidade da lavoura.

**Para quem:** engenheiro agrônomo e consultor técnico que atende uma carteira de produtores e precisa emitir recomendação de calagem, gessagem e adubação com respaldo, além de manter um caderno de campo por talhão.

**O que ele resolve:**

| Dor | Como o AgroTech ataca |
|---|---|
| Laudo de laboratório em PDF que vira digitação manual em planilha | Upload do PDF, extração automática dos parâmetros, conferência assistida |
| Cálculo de calagem/NPK refeito à mão a cada análise | Motor agronômico versionado, com as tabelas de referência editáveis por escritório |
| Histórico do talhão espalhado em WhatsApp e caderno | Caderno de campo digital ligado ao talhão, com fenologia e nível de controle |
| Produtor sem acesso ao que foi recomendado | Login separado do produtor, vendo apenas os próprios talhões e laudos |
| Recomendação sem rastreabilidade | Cada recomendação guarda a versão do motor e o snapshot da tabela usada |

**O que ele explicitamente não é:** não substitui o julgamento do agrônomo. O app calcula a partir das tabelas cadastradas e devolve uma proposta. Quem assina, decide.

---

## 2. Estado atual: o protótipo HTML

O arquivo `agrotech.html` é um protótipo funcional, single-file, sem build, que roda offline e grava tudo no dispositivo. Ele existe para validar o motor agronômico e a interface antes de migrar para Next.js. Todo o cálculo dele já está escrito de forma isolada e portátil.

### Módulos do protótipo

**Painel** — contagem da carteira, pendências químicas (talhões com V% abaixo da meta, m% acima do tolerado ou fósforo baixo) e últimas visitas.

**Produtores** — nome, propriedade, município, contato, área total. É a raiz da hierarquia: excluir um produtor cascateia para talhões, análises e visitas.

**Talhões** — vinculados ao produtor. Cultura, variedade, área em hectares, produtividade esperada, espaçamento, ano de implantação. A produtividade esperada é o que escala a recomendação de adubação.

**Análises de solo** — lançamento dos parâmetros e, na sequência, a tela de interpretação: réguas de classificação, perfil da CTC, diagnóstico em texto, calagem pelos dois métodos, gessagem, NPK, conversão em fertilizante comercial e parcelamento.

**Monitoramento** — visita com data, estádio fenológico da cultura, amostragem fitossanitária comparada ao nível de controle, observações e recomendação deixada ao produtor.

**Tabelas** — todas as referências técnicas editáveis: doses por cultura, faixas de interpretação de fósforo por classe de argila, níveis de controle e teores de garantia dos fertilizantes.

**Consultor** — nome, CREA, contato e empresa, que assinam o laudo impresso.

### Culturas cobertas

Café conilon, café arábica, pimenta-do-reino, mamão, banana, tomate, milho, feijão, cana, pastagem e eucalipto. A cobertura foi puxada para as culturas do Espírito Santo, coerente com o Campo Forte.

### Persistência

Camada de abstração que tenta `window.storage` (ambiente de artifact) e cai para `localStorage` quando o app é hospedado por conta própria. Exportação e importação em JSON para backup e transporte entre dispositivos.

> **Aviso importante sobre os números.** As doses de N-P-K, as faixas de interpretação e os níveis de controle carregados por padrão são valores de referência de literatura (5ª Aproximação/MG como base de interpretação, com ajustes para as culturas capixabas). São ponto de partida, não base calibrada. Antes de emitir laudo para cliente, revise cada linha da aba Tabelas contra o material do Incaper e o seu histórico regional.

---

## 3. O motor agronômico

Toda a matemática vive isolada em um pacote próprio (`packages/agro-core`), sem dependência de DOM ou banco. O mesmo código roda no navegador, na Edge Function e nos testes.

### 3.1 Complexo sortivo

```
K (cmolc/dm³)  = K (mg/dm³) / 391
Na (cmolc/dm³) = Na (mg/dm³) / 230
SB = Ca + Mg + K + Na
t  = SB + Al                      (CTC efetiva)
T  = SB + (H+Al)                  (CTC a pH 7)
V% = 100 × SB / T                 (saturação por bases)
m% = 100 × Al / t                 (saturação por alumínio)
```

Relações derivadas: Ca/Mg (ideal 2 a 5), Ca/K (ideal 9 a 25), Mg/K (ideal 3 a 8) e a participação percentual de cada base na CTC (Ca 50–60%, Mg 15–20%, K 3–5%).

### 3.2 Interpretação

Cinco classes por parâmetro — muito baixo, baixo, médio, bom, muito bom — definidas por quatro pontos de quebra. Parâmetros em que valor alto é problema (Al, H+Al, m%) usam a escala invertida: muito baixo, baixo, médio, alto, muito alto.

O fósforo é o caso especial: a interpretação depende do teor de argila, porque o poder tampão do solo muda a disponibilidade.

| Argila | Muito baixo até | Baixo até | Médio até | Bom até |
|---|---|---|---|---|
| 60–100% | 2,7 | 5,4 | 8,0 | 12,0 |
| 35–60% | 4,0 | 8,0 | 12,0 | 18,0 |
| 15–35% | 6,6 | 12,0 | 20,0 | 30,0 |
| 0–15% | 10,0 | 20,0 | 30,0 | 45,0 |

Valores em mg/dm³, extrator Mehlich-1.

### 3.3 Calagem

Dois métodos, sempre calculados em paralelo. O sistema adota o maior.

**Saturação por bases:**
```
NC (t/ha) = (V₂ − V₁) × T / 100
```
V₂ é a meta da cultura (café 60%, banana e mamão 70%, pastagem 50%, eucalipto 50%).

**Neutralização do alumínio com elevação de Ca e Mg:**
```
NC (t/ha) = Y × [Al − (m_máx × t / 100)] + [2 − (Ca + Mg)]
```
Y varia com a textura: argila ≥60% → 4; 35–60% → 3; 15–35% → 2; <15% → 1. O `m_máx` é a tolerância da cultura ao alumínio.

**Correção para o produto real:**
```
Dose aplicada = NC × (100 / PRNT) × fator_profundidade
```
Fator de profundidade: 1,0 para 0–20 cm; 1,5 para 0–30 cm; 2,0 para 0–40 cm.

A escolha entre calcário calcítico e dolomítico sai da relação Ca/Mg: abaixo de 3:1 o sistema recomenda dolomítico.

### 3.4 Gessagem

Critério de indicação: Al > 0,5 cmolc/dm³, ou Ca < 0,5 cmolc/dm³, ou m% > 20.

```
Dose (kg/ha) = 50 × % argila
```

O sistema sempre avisa que a decisão de gesso exige análise da camada de 20–40 cm — a de 0–20 não responde a pergunta certa.

### 3.5 Adubação

```
fator     = produtividade_esperada / produtividade_referência
N (kg/ha) = N_referência × fator
P₂O₅      = P_tabela[classe_de_P_do_solo] × fator
K₂O       = K_tabela[classe_de_K_do_solo] × fator
```

O modelo é deliberadamente transparente: a dose de N escala com a expectativa de produtividade, e as de P e K partem da classe de fertilidade e escalam junto. Cada cultura tem sua tabela de cinco valores (muito baixo → muito bom) e seu texto de parcelamento.

### 3.6 Conversão em fertilizante comercial

```
kg de produto/ha = kg do nutriente/ha ÷ (% de garantia / 100)
```

A escolha da fonte é condicional: se o enxofre está baixo, o motor prefere superfosfato simples e sulfato de amônio; se não, superfosfato triplo e ureia. Boro e zinco entram automaticamente quando o teor está na faixa baixa.

### 3.7 Diagnóstico

Regras encadeadas que produzem texto corrido classificado em crítico, atenção ou ok: pH fora de faixa, m% acima do limite, V% abaixo da meta, P ou K nas duas classes inferiores, matéria orgânica baixa, relações Ca/Mg e Mg/K desequilibradas, micronutrientes limitantes.

### 3.8 Versionamento do motor

Cada recomendação gravada carrega:

- `motor_versao` — o semver do pacote `agro-core` que a produziu
- `tabelas_snapshot` — cópia JSON das tabelas de referência no momento do cálculo

Isso significa que uma recomendação emitida em 2026 continua reproduzível em 2029, mesmo que as tabelas do escritório tenham mudado no meio do caminho. É o que dá defensabilidade técnica ao laudo.

---

## 4. Arquitetura alvo

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router) · Vercel                          │
│                                                            │
│  /login  /cadastro       → Supabase Auth                   │
│  /app/*                  → área do consultor (agrônomo)    │
│  /produtor/*             → área do produtor                │
│  /api/*                  → Route Handlers                  │
│                                                            │
│  packages/agro-core      → motor agronômico (TS puro)      │
└──────────────┬─────────────────────────────────────────────┘
               │ supabase-js (RLS aplicada)
               ▼
┌────────────────────────────────────────────────────────────┐
│  Supabase                                                   │
│                                                            │
│  Auth        · e-mail/senha, magic link, convite           │
│  Postgres    · schema agro, RLS por org e por perfil       │
│                pg_trgm para casamento de nomes             │
│  Storage     · bucket laudos/ (PDF), recomendacoes/ (PDF)  │
│  Edge Funcs  · processar-laudo, gerar-laudo-pdf, convidar  │
│  Realtime    · status do processamento do PDF             │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│  GitHub                                                     │
│  main / dev · PR com preview na Vercel                     │
│  Actions: lint, typecheck, testes do motor,               │
│           supabase db push, backup diário                 │
└────────────────────────────────────────────────────────────┘
```

Stack idêntico ao do Campo Forte — Next.js 15, Supabase, Vercel, GitHub Actions — de propósito: o AgroTech pode viver como área do mesmo projeto ou como app irmão compartilhando o banco.

---

## 5. Perfis de acesso e autenticação

### 5.1 Os três perfis

| Perfil | Quem é | Vê o quê |
|---|---|---|
| `consultor` | Agrônomo, responsável técnico | Toda a carteira da organização dele |
| `produtor` | Cliente do consultor | Só as próprias propriedades, talhões, análises e laudos |
| `admin` | Operação Nova7/Campo Forte | Gestão de organizações e planos |

O perfil fica em `profiles.role`, criado por trigger no momento em que o usuário nasce em `auth.users`.

### 5.2 Telas separadas

São duas portas de entrada distintas, e isso é decisão de produto, não detalhe visual:

- `/login` — entrada do consultor, com opção de criar escritório
- `/produtor/login` — entrada do produtor, sem opção de auto-cadastro

O produtor **não se cadastra sozinho**. Ele só entra por convite do consultor. Isso evita que qualquer pessoa crie conta e fique órfã no sistema, e mantém a relação técnico–cliente como origem do vínculo.

### 5.3 Fluxo de cadastro do consultor

```
1. /cadastro → e-mail, senha, nome, CREA, nome do escritório
2. Supabase Auth cria auth.users
3. Trigger handle_new_user() cria profiles (role='consultor')
4. Route handler cria orgs e vincula profiles.org_id
5. Seed: tabelas de referência padrão copiadas para a org
6. Confirmação de e-mail obrigatória
```

O passo 5 importa: cada escritório recebe sua própria cópia das tabelas de referência. O consultor de Colatina calibra as dele sem afetar ninguém.

### 5.4 Fluxo de convite do produtor

```
1. Consultor abre um produtor já cadastrado e clica em "Dar acesso"
2. Edge Function convidar-produtor:
   - gera token (uuid) com validade de 7 dias
   - grava em convites
   - dispara e-mail com o link /produtor/aceitar?token=...
3. Produtor abre o link, define senha
4. Auth cria o usuário; trigger cria profiles (role='produtor')
5. O handler valida o token, grava produtores.user_id e marca o convite como usado
```

A partir daí, a RLS faz o resto: o produtor enxerga exclusivamente as linhas cujo `produtor_id` aponta para o registro dele.

### 5.5 Sessão e rotas

Middleware do Next.js lê a sessão do Supabase e roteia por perfil:

```ts
// middleware.ts — comportamento esperado
// /app/*      exige role = 'consultor' ou 'admin'
// /produtor/* exige role = 'produtor'
// consultor tentando /produtor/* → redirect /app
// produtor tentando /app/*       → redirect /produtor
// sem sessão                     → redirect para o login correspondente
```

Nunca confie só no middleware. Ele é conveniência de navegação; a barreira real é a RLS no banco.

---

## 6. Modelo de dados no Supabase

Schema `agro`. As migrações ficam em `supabase/migrations/`, versionadas no Git.

### 6.1 Organização e perfis

```sql
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create table agro.orgs (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  cnpj         text,
  municipio    text,
  plano        text not null default 'free',
  criado_em    timestamptz not null default now()
);

create table agro.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  org_id       uuid references agro.orgs(id) on delete set null,
  role         text not null check (role in ('admin','consultor','produtor')),
  nome         text,
  crea         text,
  fone         text,
  criado_em    timestamptz not null default now()
);

create or replace function agro.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into agro.profiles (id, role, nome)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'role', 'consultor'),
          new.raw_user_meta_data->>'nome');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function agro.handle_new_user();
```

### 6.2 Carteira

```sql
create table agro.produtores (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,  -- preenchido no convite
  nome         text not null,
  nome_norm    text generated always as (upper(unaccent(nome))) stored,
  cpf_cnpj     text,
  fone         text,
  email        text,
  criado_em    timestamptz not null default now()
);
create index on agro.produtores using gin (nome_norm gin_trgm_ops);

create table agro.propriedades (
  id           uuid primary key default gen_random_uuid(),
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  nome         text not null,
  nome_norm    text generated always as (upper(unaccent(nome))) stored,
  municipio    text,
  uf           text default 'ES',
  car          text,
  area_total   numeric(10,2),
  lat          numeric(10,6),
  lng          numeric(10,6)
);
create index on agro.propriedades using gin (nome_norm gin_trgm_ops);

create table agro.talhoes (
  id              uuid primary key default gen_random_uuid(),
  propriedade_id  uuid not null references agro.propriedades(id) on delete cascade,
  nome            text not null,
  nome_norm       text generated always as (upper(unaccent(nome))) stored,
  cultura         text not null,
  variedade       text,
  area_ha         numeric(10,2),
  prod_esperada   numeric(10,2),
  espacamento     text,
  ano_implantacao int,
  geom            jsonb,          -- GeoJSON do contorno, quando houver
  obs             text
);
create index on agro.talhoes using gin (nome_norm gin_trgm_ops);
```

### 6.3 Documentos e análises

```sql
create type agro.doc_status as enum
  ('recebido','extraindo','extraido','revisao','confirmado','erro');

create table agro.documentos (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references agro.orgs(id) on delete cascade,
  enviado_por       uuid references auth.users(id),
  storage_path      text not null,          -- laudos/{org_id}/{uuid}.pdf
  nome_arquivo      text,
  hash_sha256       text,                   -- evita reprocessar o mesmo PDF
  paginas           int,
  laboratorio       text,                   -- detectado
  texto_extraido    text,
  payload           jsonb,                  -- campos extraídos + confiança
  confianca_media   numeric(4,3),
  status            agro.doc_status not null default 'recebido',
  erro              text,
  criado_em         timestamptz not null default now(),
  processado_em     timestamptz,
  unique (org_id, hash_sha256)
);

create table agro.analises (
  id             uuid primary key default gen_random_uuid(),
  talhao_id      uuid not null references agro.talhoes(id) on delete cascade,
  documento_id   uuid references agro.documentos(id) on delete set null,
  origem         text not null default 'manual' check (origem in ('manual','pdf')),
  data_coleta    date not null,
  profundidade   text not null default '0-20',
  laboratorio    text,
  protocolo      text,
  -- parâmetros
  argila numeric(6,2), ph numeric(4,2), mo numeric(6,2),
  p numeric(8,2), k numeric(8,2), na numeric(8,2),
  ca numeric(6,3), mg numeric(6,3), al numeric(6,3), h_al numeric(6,3),
  s numeric(8,2), b numeric(8,3), zn numeric(8,2),
  cu numeric(8,2), mn numeric(8,2), fe numeric(8,2),
  prnt numeric(5,2) default 85,
  incorporacao int default 20,
  criado_em      timestamptz not null default now()
);

create table agro.recomendacoes (
  id                uuid primary key default gen_random_uuid(),
  analise_id        uuid not null references agro.analises(id) on delete cascade,
  motor_versao      text not null,
  tabelas_snapshot  jsonb not null,
  resultado         jsonb not null,   -- calagem, gessagem, npk, fontes, diagnóstico
  observacoes       text,
  emitida_por       uuid references auth.users(id),
  emitida_em        timestamptz not null default now(),
  pdf_path          text
);
```

### 6.4 Caderno de campo

```sql
create table agro.visitas (
  id             uuid primary key default gen_random_uuid(),
  talhao_id      uuid not null references agro.talhoes(id) on delete cascade,
  consultor_id   uuid references auth.users(id),
  data           date not null,
  fenologia      text,
  condicao       text,
  observacoes    text,
  recomendacao   text,
  proxima_visita date,
  criado_em      timestamptz not null default now()
);

create table agro.visita_ocorrencias (
  id          uuid primary key default gen_random_uuid(),
  visita_id   uuid not null references agro.visitas(id) on delete cascade,
  alvo        text not null,
  valor       text,
  acima_nivel boolean not null default false
);

create table agro.visita_fotos (
  id           uuid primary key default gen_random_uuid(),
  visita_id    uuid not null references agro.visitas(id) on delete cascade,
  storage_path text not null,
  legenda      text
);
```

### 6.5 Tabelas de referência e convites

```sql
create table agro.tabelas_referencia (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references agro.orgs(id) on delete cascade,
  tipo       text not null,   -- culturas | faixas | fosforo | pragas | fertilizantes
  conteudo   jsonb not null,
  versao     int not null default 1,
  atualizado_em timestamptz not null default now(),
  unique (org_id, tipo)
);

create table agro.convites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  email        text not null,
  token        uuid not null default gen_random_uuid(),
  expira_em    timestamptz not null default (now() + interval '7 days'),
  usado_em     timestamptz,
  criado_por   uuid references auth.users(id)
);
create unique index on agro.convites(token);

create table agro.audit_log (
  id         bigserial primary key,
  org_id     uuid,
  user_id    uuid,
  acao       text not null,
  entidade   text,
  entidade_id uuid,
  dados      jsonb,
  criado_em  timestamptz not null default now()
);
```

---

## 7. Row Level Security

A regra de ouro: **nenhuma tabela sem RLS ligada.** O `service_role` só é usado dentro de Edge Functions, nunca exposto ao browser.

### 7.1 Funções auxiliares

```sql
create or replace function agro.meu_org_id() returns uuid
language sql stable security definer as $$
  select org_id from agro.profiles where id = auth.uid()
$$;

create or replace function agro.meu_role() returns text
language sql stable security definer as $$
  select role from agro.profiles where id = auth.uid()
$$;

create or replace function agro.meu_produtor_id() returns uuid
language sql stable security definer as $$
  select id from agro.produtores where user_id = auth.uid()
$$;
```

### 7.2 Políticas

```sql
alter table agro.produtores enable row level security;

-- consultor enxerga a carteira da organização dele
create policy produtores_consultor on agro.produtores
for all to authenticated
using (org_id = agro.meu_org_id() and agro.meu_role() in ('consultor','admin'))
with check (org_id = agro.meu_org_id() and agro.meu_role() in ('consultor','admin'));

-- produtor enxerga apenas o próprio registro, somente leitura
create policy produtores_dono on agro.produtores
for select to authenticated
using (user_id = auth.uid());
```

```sql
alter table agro.talhoes enable row level security;

create policy talhoes_consultor on agro.talhoes
for all to authenticated
using (exists (
  select 1 from agro.propriedades pr
  join agro.produtores p on p.id = pr.produtor_id
  where pr.id = talhoes.propriedade_id
    and p.org_id = agro.meu_org_id()
    and agro.meu_role() in ('consultor','admin')))
with check (exists (
  select 1 from agro.propriedades pr
  join agro.produtores p on p.id = pr.produtor_id
  where pr.id = talhoes.propriedade_id
    and p.org_id = agro.meu_org_id()));

create policy talhoes_produtor on agro.talhoes
for select to authenticated
using (exists (
  select 1 from agro.propriedades pr
  where pr.id = talhoes.propriedade_id
    and pr.produtor_id = agro.meu_produtor_id()));
```

O mesmo par de políticas — acesso total para o consultor da org, leitura para o produtor dono — se repete em `analises`, `recomendacoes`, `visitas` e `documentos`, sempre subindo pela cadeia de chaves estrangeiras até `produtores.org_id`.

### 7.3 Storage

```sql
-- bucket privado 'laudos'; caminho: {org_id}/{produtor_id}/{uuid}.pdf
create policy laudos_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'laudos'
  and (
    (storage.foldername(name))[1] = agro.meu_org_id()::text
    or (storage.foldername(name))[2] = agro.meu_produtor_id()::text
  )
);

create policy laudos_envio on storage.objects
for insert to authenticated
with check (
  bucket_id = 'laudos'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and agro.meu_role() in ('consultor','admin')
);
```

### 7.4 Testes de política

Cada política ganha um teste em `supabase/tests/` rodado no CI com pgTAP. O caso obrigatório: autenticar como produtor A e tentar ler o talhão do produtor B → precisa retornar zero linhas.

---

## 8. Ingestão de laudo em PDF

O agrônomo joga o PDF do laboratório na tela e o sistema devolve a análise pronta para conferência. Este é o coração do que muda em relação ao protótipo.

### 8.1 Pipeline

```
Upload (browser)
   → supabase.storage.from('laudos').upload(...)
   ▼
insert em documentos (status='recebido', hash_sha256)
   → se o hash já existe na org → devolve o documento anterior, não reprocessa
   ▼
Edge Function processar-laudo (disparada por webhook do insert)
   │
   ├─ 1. baixa o PDF do Storage
   ├─ 2. extrai texto (unpdf / pdfjs-dist)
   ├─ 3. se texto < 200 caracteres → PDF é imagem → rota de OCR
   ├─ 4. detecta o laboratório pela assinatura do cabeçalho
   ├─ 5. aplica o perfil de parsing do laboratório
   ├─ 6. campos faltando ou confiança baixa → normalização por LLM
   ├─ 7. valida faixas fisicamente plausíveis
   └─ 8. grava payload + confianca_media, status='revisao'
   ▼
Realtime avisa o browser → tela de conferência
   ▼
Agrônomo confirma → insert em analises → motor roda → recomendação
```

### 8.2 Extração de texto

Primeira tentativa sempre é texto nativo. A maioria dos laudos de laboratório sai de sistema, não de scanner.

```ts
import { extractText, getDocumentProxy } from 'unpdf';

const pdf = await getDocumentProxy(new Uint8Array(buffer));
const { text, totalPages } = await extractText(pdf, { mergePages: true });
```

Se o texto vier vazio ou muito curto, o documento é imagem. Aí a rota é OCR, e ela é opcional por questão de custo: o padrão é marcar `status='revisao'` com aviso de que o PDF é digitalizado e pedir lançamento manual. Quem quiser OCR configura uma chave de serviço de visão e o pipeline passa a chamar essa etapa antes do passo 4.

### 8.3 Perfis de laboratório

Cada laboratório imprime o laudo do seu jeito. Em vez de um parser genérico frágil, mantemos perfis declarativos por laboratório:

```ts
// packages/agro-core/src/parsers/perfis.ts
export const PERFIS: PerfilLab[] = [
  {
    id: 'generico-mehlich',
    assinatura: [/mehlich/i, /cmolc/i],
    campos: {
      ph:     { rotulos: ['pH em água', 'pH H2O', 'pH (H₂O)', 'pH CaCl2'], unidade: '-' },
      mo:     { rotulos: ['M.O.', 'MO', 'Matéria orgânica', 'Carbono orgânico'], unidade: 'dag/kg',
                transform: (v, rot) => /carbono/i.test(rot) ? v * 1.724 : v },
      p:      { rotulos: ['P', 'Fósforo', 'P (Mehlich)', 'P disponível'], unidade: 'mg/dm3' },
      k:      { rotulos: ['K', 'Potássio'], unidade: 'mg/dm3',
                transform: (v, _r, un) => /cmolc/i.test(un) ? v * 391 : v },
      ca:     { rotulos: ['Ca', 'Cálcio', 'Ca²⁺'], unidade: 'cmolc/dm3' },
      mg:     { rotulos: ['Mg', 'Magnésio'], unidade: 'cmolc/dm3' },
      al:     { rotulos: ['Al', 'Al³⁺', 'Alumínio'], unidade: 'cmolc/dm3' },
      h_al:   { rotulos: ['H+Al', 'H + Al', 'Acidez potencial'], unidade: 'cmolc/dm3' },
      argila: { rotulos: ['Argila', 'Teor de argila'], unidade: '%' },
      // ... s, b, zn, cu, mn, fe
    },
    identificacao: {
      produtor:    ['Cliente', 'Produtor', 'Interessado', 'Requerente'],
      propriedade: ['Propriedade', 'Fazenda', 'Sítio', 'Local'],
      amostra:     ['Amostra', 'Identificação', 'Talhão', 'Gleba'],
      protocolo:   ['Protocolo', 'Nº', 'Laudo', 'Registro'],
      data:        ['Data de coleta', 'Coleta', 'Recebimento', 'Emissão'],
      profundidade:['Profundidade', 'Camada']
    }
  }
];
```

Três armadilhas que o parser precisa tratar sempre:

1. **Vírgula decimal.** `4,52` vira `4.52`. Ponto como separador de milhar em `1.250` vira `1250`.
2. **Unidade divergente.** K sai em mg/dm³ ou cmolc/dm³ dependendo do laboratório. A conversão só acontece quando a unidade impressa é detectada; na dúvida, o campo cai para revisão.
3. **Carbono no lugar de matéria orgânica.** MO = C.O. × 1,724.

### 8.4 Confiança por campo

Cada campo sai da extração com um score:

| Situação | Confiança |
|---|---|
| Rótulo exato + unidade explícita na mesma linha | 0,98 |
| Rótulo exato, unidade inferida do perfil | 0,90 |
| Rótulo por sinônimo, valor na coluna esperada | 0,80 |
| Valor recuperado por LLM a partir do texto bruto | 0,65 |
| Fora da faixa fisicamente plausível | 0,00 (rejeitado) |

Faixas de sanidade: pH entre 3 e 9; argila 0 a 100; Ca, Mg, Al, H+Al não negativos e abaixo de 30; P abaixo de 500; K abaixo de 2000. Valor fora disso nunca é aceito automaticamente, mesmo com rótulo perfeito.

Qualquer campo abaixo de 0,90 aparece destacado na tela de conferência com o trecho do PDF que o originou ao lado.

### 8.5 Normalização por LLM

Quando o parser declarativo não resolve — laudo de layout novo, tabela quebrada em colunas estranhas — o pipeline manda o texto bruto para a API do Claude com instrução de devolver **apenas JSON**, sem preâmbulo:

```ts
const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: 'Você extrai dados de laudos de análise de solo brasileiros. ' +
            'Responda SOMENTE com JSON válido, sem markdown, sem explicação. ' +
            'Use null para campo ausente. Converta vírgula decimal em ponto. ' +
            'Nunca invente valor que não esteja no texto.',
    messages: [{ role: 'user', content: `Esquema: ${JSON.stringify(ESQUEMA)}\n\nLaudo:\n${texto}` }]
  })
});
```

Duas travas obrigatórias: o resultado do LLM **nunca** entra com confiança acima de 0,65, e **nunca** pula a tela de conferência. O modelo ajuda a preencher, o agrônomo valida.

### 8.6 Tela de conferência

Layout de duas colunas: PDF renderizado à esquerda, formulário à direita, campos coloridos por confiança. Botões: *Confirmar e interpretar*, *Corrigir e confirmar*, *Descartar*.

Toda correção manual é gravada em `audit_log` com o valor extraído e o valor corrigido. Depois de algumas dezenas de laudos, esse log mostra exatamente quais rótulos o parser erra e vira insumo para ajustar o perfil do laboratório.

---

## 9. Cadastro automático a partir do laudo

O laudo geralmente já traz o nome do cliente, a propriedade e a identificação da amostra. O sistema usa isso para propor o cadastro, em vez de obrigar a digitar antes.

### 9.1 Casamento de nomes

Normalização e comparação por trigrama, aproveitando a mesma lógica que o Sincronizador usa para casar produto de farmácia:

```sql
create or replace function agro.casar_produtor(p_org uuid, p_nome text)
returns table (id uuid, nome text, score real)
language sql stable as $$
  select p.id, p.nome, similarity(p.nome_norm, upper(unaccent(p_nome))) as score
  from agro.produtores p
  where p.org_id = p_org
    and p.nome_norm % upper(unaccent(p_nome))
  order by score desc
  limit 5
$$;
```

Antes de comparar, o normalizador remove prefixos que só atrapalham: `FAZENDA`, `SÍTIO`, `CHÁCARA`, `PROP.`, `SR.`, `SRA.`, além de pontuação e espaços duplicados.

### 9.2 Regras de decisão

| Score | Comportamento |
|---|---|
| ≥ 0,90 | Vincula automaticamente, mostrando qual registro foi usado |
| 0,60 a 0,89 | Mostra os candidatos e pergunta: "É este produtor ou é novo?" |
| < 0,60 | Propõe criar cadastro novo, com os campos pré-preenchidos |

O mesmo procedimento roda em cascata: primeiro o produtor, depois a propriedade dentro daquele produtor, depois o talhão dentro daquela propriedade. Um laudo pode, num único aceite, criar três registros encadeados.

### 9.3 Confirmação

O cadastro criado a partir de PDF nasce com `origem='pdf'` e um aviso na interface até que o agrônomo complete o que o laudo não informa: cultura, área em hectares e produtividade esperada. Sem cultura e área, o motor não roda — e o sistema diz isso explicitamente em vez de calcular com valor padrão silencioso.

### 9.4 Lote

Laboratório costuma mandar várias amostras no mesmo PDF. O parser detecta múltiplas colunas ou múltiplas seções de amostra e gera uma linha por amostra na tela de conferência, todas apontando para o mesmo `documento_id`. O agrônomo casa cada amostra com o talhão correspondente numa tela só.

---

## 10. Estrutura do repositório

```
agrotech/
├─ apps/
│  └─ web/
│     ├─ app/
│     │  ├─ (auth)/
│     │  │  ├─ login/page.tsx
│     │  │  └─ cadastro/page.tsx
│     │  │  └─ recuperar/page.tsx
│     │  ├─ (consultor)/app/
│     │  │  ├─ layout.tsx              # guarda de rota
│     │  │  ├─ page.tsx                # painel
│     │  │  ├─ produtores/
│     │  │  ├─ talhoes/
│     │  │  ├─ laudos/
│     │  │  │  ├─ page.tsx             # fila de PDFs
│     │  │  │  └─ [id]/conferencia/    # tela de duas colunas
│     │  │  ├─ analises/[id]/
│     │  │  ├─ monitoramento/
│     │  │  └─ tabelas/
│     │  ├─ (produtor)/produtor/
│     │  │  ├─ login/page.tsx
│     │  │  ├─ aceitar/page.tsx        # convite
│     │  │  ├─ page.tsx                # meus talhões
│     │  │  └─ laudos/[id]/
│     │  └─ api/
│     │     ├─ laudos/upload/route.ts
│     │     ├─ convites/route.ts
│     │     └─ recomendacoes/[id]/pdf/route.ts
│     ├─ components/
│     │  ├─ regua-interpretacao.tsx    # elemento-assinatura da UI
│     │  ├─ perfil-ctc.tsx
│     │  └─ conferencia-campo.tsx
│     ├─ lib/supabase/{client,server,middleware}.ts
│     └─ middleware.ts
├─ packages/
│  └─ agro-core/
│     ├─ src/
│     │  ├─ calculos.ts        # SB, t, T, V, m, relações
│     │  ├─ interpretacao.ts   # classes e faixas
│     │  ├─ calagem.ts
│     │  ├─ adubacao.ts
│     │  ├─ diagnostico.ts
│     │  ├─ tabelas/padrao.ts  # referências iniciais
│     │  └─ parsers/
│     │     ├─ perfis.ts
│     │     ├─ extrair.ts
│     │     └─ normalizar.ts
│     └─ test/                 # vitest, casos reais anonimizados
├─ supabase/
│  ├─ migrations/
│  ├─ functions/
│  │  ├─ processar-laudo/
│  │  ├─ gerar-laudo-pdf/
│  │  └─ convidar-produtor/
│  ├─ seed.sql
│  └─ tests/                   # pgTAP das políticas RLS
├─ .github/workflows/
│  ├─ ci.yml
│  ├─ deploy-supabase.yml
│  └─ backup.yml
└─ docs/
   ├─ AGROTECH.md              # este arquivo
   ├─ MOTOR.md                 # fórmulas e referências bibliográficas
   └─ LABORATORIOS.md          # perfis de parsing e amostras
└─ turbo.json
```

O `packages/agro-core` é o ativo mais valioso do projeto. Ele não importa nada de Next, de Supabase ou de DOM — é função pura recebendo números e devolvendo números. Isso permite testá-lo com casos reais e reaproveitá-lo em qualquer superfície, inclusive num app nativo depois.

---

## 11. GitHub: fluxo, CI/CD e migrações

### 11.1 Branches

- `main` — produção, deploy automático na Vercel, protegida
- `dev` — integração, aponta para o projeto Supabase de staging
- `feat/*`, `fix/*` — PR para `dev`, preview automático por PR

Regras em `main`: PR obrigatório, CI verde obrigatório, sem push direto.

### 11.2 CI

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main, dev]

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --filter agro-core     # testes do motor agronômico
      - run: pnpm build

  rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase test db                 # pgTAP das políticas
```

Os testes do `agro-core` são o portão. Cada laudo real que passar pelo sistema e gerar divergência vira um caso de teste com os números esperados — a suíte cresce junto com a base.

### 11.3 Migrações

```yaml
# .github/workflows/deploy-supabase.yml
name: Migrações Supabase
on:
  push:
    branches: [main]
    paths: ['supabase/**']

jobs:
  migrar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref $PROJECT_REF
        env:
          PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      - run: supabase functions deploy processar-laudo gerar-laudo-pdf convidar-produtor
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Migração nunca é escrita direto no painel do Supabase. Sempre `supabase migration new nome_da_mudanca`, editar o SQL, commitar. O banco de produção só muda pelo que está no Git.

### 11.4 Backup

```yaml
# .github/workflows/backup.yml
name: Backup diário
on:
  schedule: [{ cron: '0 6 * * *' }]   # 03h em Brasília
  workflow_dispatch:

jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - uses: supabase/setup-cli@v1
      - run: supabase db dump --db-url "$DB_URL" -f backup.sql
        env: { DB_URL: ${{ secrets.SUPABASE_DB_URL }} }
      - uses: actions/upload-artifact@v4
        with: { name: backup-${{ github.run_id }}, path: backup.sql, retention-days: 30 }
```

### 11.5 Secrets necessários

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `ANTHROPIC_API_KEY`, `VERCEL_TOKEN`.

---

## 12. Variáveis de ambiente

```bash
# .env.local — nunca commitar
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # só no servidor e nas Edge Functions
ANTHROPIC_API_KEY=sk-ant-...              # normalização de laudo
NEXT_PUBLIC_APP_URL=https://agrotech.campoforte.com.br
RESEND_API_KEY=re_...                     # e-mail de convite
```

A `SUPABASE_SERVICE_ROLE_KEY` ignora RLS por definição. Ela nunca aparece em componente client, nunca vai para variável com prefixo `NEXT_PUBLIC_` e nunca é enviada ao browser. Se vazar, todo o isolamento entre produtores cai junto.

---

## 13. Roadmap por fases

**Fase 1 — Fundação (2 a 3 semanas)**
Projeto Next.js, schema completo, RLS com testes, autenticação do consultor, CRUD de produtores, propriedades e talhões, migração do motor do protótipo para `agro-core` com suíte de testes.

**Fase 2 — Análise e recomendação (2 semanas)**
Lançamento manual da análise, tela de interpretação (réguas, perfil da CTC, diagnóstico), calagem, gessagem, adubação, geração do laudo em PDF pela Edge Function, tabelas de referência editáveis por organização.

**Fase 3 — Ingestão de PDF (3 a 4 semanas)**
Upload e Storage, `processar-laudo`, perfis dos laboratórios que você mais recebe, tela de conferência lado a lado, casamento por trigrama e cadastro assistido, processamento em lote.

**Fase 4 — Portal do produtor (2 semanas)**
Convite por e-mail, `/produtor/login`, painel com talhões e histórico, download dos laudos, notificação quando sai recomendação nova.

**Fase 5 — Campo (2 a 3 semanas)**
Caderno de campo com foto e geolocalização, PWA com fila offline para sincronizar quando voltar o sinal, agenda de visitas.

**Fase 6 — Integração com o Campo Forte**
Preço da commodity da cultura do talhão dentro do painel do produtor; estimativa de receita cruzando produtividade esperada com a cotação; custo da recomendação de adubo calculado com preço real de insumo.

A fase 6 é onde os dois produtos deixam de ser vizinhos e viram um só: o produtor abre o app e vê, na mesma tela, o que a lavoura precisa e quanto ela vale hoje.

---

## 14. Segurança, LGPD e responsabilidade técnica

**Dados pessoais.** Nome, CPF/CNPJ, telefone e localização de propriedade são dados pessoais sob a LGPD. Base legal: execução de contrato de prestação de serviço técnico. O produtor precisa conseguir exportar e pedir exclusão dos próprios dados — implemente isso desde a Fase 4, não depois.

**Isolamento.** A separação entre organizações e entre produtores mora na RLS, testada no CI. Falha de política aqui é vazamento de carteira de cliente para concorrente.

**Retenção.** Laudo e recomendação são documentos técnicos com valor probatório. Não apague por padrão: use exclusão lógica (`arquivado_em`) para análises e recomendações, mantendo o histórico íntegro.

**Auditoria.** `audit_log` registra emissão de recomendação, correção de campo extraído, convite e alteração de tabela de referência. Quem mudou a dose de referência, quando, e de que valor para qual.

**ART e assinatura.** O laudo sai com nome e CREA do responsável técnico. Deixe claro na interface e no rodapé do PDF que a recomendação é gerada a partir das tabelas cadastradas pelo próprio profissional e que a responsabilidade técnica é de quem assina. Considere campo para número da ART quando houver.

**Rate limit.** Upload de PDF e chamadas ao LLM precisam de limite por organização. Sem isso, um loop acidental de reprocessamento vira conta de API.

---

## 15. Limitações conhecidas

**Tabelas não calibradas.** As referências que acompanham o sistema são de literatura. Enquanto o escritório não revisar, toda recomendação carrega essa incerteza. A interface avisa; a documentação avisa; não deixe isso virar rodapé ignorado.

**Camada única.** O motor interpreta 0–20 cm. Decisão de gesso exige 20–40 cm, e o sistema hoje só sabe dizer que ela é necessária, sem calcular. Suporte a múltiplas camadas por talhão é evolução prevista.

**Sem análise foliar.** Diagnóstico nutricional completo em perene combina solo e folha. A análise foliar não está modelada, e para café isso é uma lacuna real.

**Sem histórico de adubação.** A recomendação não desconta o que já foi aplicado na safra nem considera o efeito residual de fosfatagem anterior. O agrônomo precisa fazer esse ajuste de cabeça.

**Sem produtividade realizada.** O sistema usa produtividade esperada, informada. Fechar o ciclo — comparar o esperado com o colhido e retroalimentar a recomendação — é o que transformaria o AgroTech de calculadora em ferramenta de aprendizado. É a evolução mais valiosa do roadmap e a menos trivial.

**PDF digitalizado.** Sem OCR configurado, laudo escaneado cai direto para lançamento manual.

---

*Documento mantido em `docs/AGROTECH.md`. Mudança no motor agronômico exige atualização das seções 3 e 15 no mesmo PR.*
