# DATABASE_CHANGES.md — schema novo proposto (concluído em 2026-09-24)

Continuação de `supabase/migrations/0001`–`0018` (ver inventário em
`PRODUCT_AUDIT.md §4`). Este documento nasceu como a **proposta** de
migrations `0019`–`0023`, para as Fases 6–11 do pedido. **Todas as 7
migrations que restavam do roteiro (`0019`–`0025`) já foram escritas e
aplicadas** — a última, `0025`, fechou a Fase 11 (a última do roteiro de
11 fases). `0021` foi a única fora da proposta original (fecha um buraco
de RLS achado construindo a Fase 5 — produtor não conseguia ler os
próprios `agro.documentos`). Cada seção abaixo tem sua nota de
divergência entre o que foi proposto e o que de fato foi escrito — nenhuma
migration saiu idêntica à letra ao que este documento sugeriu originalmente,
e isso é o esperado: a proposta é o ponto de partida, o código real é a
verdade. Este documento agora é histórico — próxima migration nova começa
em `0026`, direto num arquivo, sem precisar de uma proposta aqui antes
(esse "propor antes de escrever" fazia sentido pra fechar o roteiro das 11
fases; não é uma regra permanente do projeto).

Convenção mantida do schema existente (não a do pedido original, que sugeria
`created_at`/`updated_at` em inglês): colunas de timestamp continuam
`criado_em`/`atualizado_em`, ids continuam `uuid default gen_random_uuid()`,
tabelas e colunas em português — consistência com as 17 migrations
existentes pesa mais do que a convenção sugerida no pedido.

---

## Decisões que moldam este schema (ver `PRODUCT_V2.md §2` para o raciocínio)

1. **`financeiro_*` é 100% privado ao produtor.** Nenhuma política RLS para
   `consultor`/`admin` em nenhuma tabela financeira. Sem exceção.
2. **`producao_registros` é a exceção deliberada**: os campos agronômicos
   (área, produção prevista/realizada, talhão, safra) ficam visíveis ao
   consultor em modo leitura — é o dado que fecha o ciclo
   esperado-vs-colhido já sinalizado como lacuna em `AUDITORIA-02.md`
   ("Sem produtividade realizada... é a evolução mais valiosa do roadmap").
   Os campos comerciais (preço, receita) continuam só do produtor — ver a
   política dupla na tabela abaixo.
3. **`planos`/`assinaturas`/`cobrancas` já existem — só ganham colunas**, não
   viram tabelas novas (`PRODUCT_V2.md §2.1`).
4. **`agenda_eventos` é nova e separada de `visitas`.** `visitas` continua
   sendo o registro histórico de monitoramento (fenologia, ocorrências,
   fotos — preenchido depois do fato). `agenda_eventos` é a camada de
   agendamento (antes do fato, com tipos além de visita: coleta de solo,
   retorno, aplicação, reunião). Um evento de agenda pode terminar
   referenciando a `visita_id` criada quando ele é cumprido.
5. **`safras` é compartilhada** entre financeiro e produção (um só
   catálogo por produtor), não duas tabelas (`financeiro_safras` +
   `producao_safras` como o pedido sugeria por analogia) — evita ter duas
   fontes da verdade para "o que é a safra 2026" do mesmo produtor.
6. **Papéis novos (`proprietario/tecnico/assistente`) entram no mesmo
   `check` de `profiles.role`**, sem migrar para enum (ver justificativa em
   `PRODUCT_AUDIT.md` item 7 da dívida técnica).

---

## 0019 — Safras e produção

**Divergência (2026-09-23):** só a tabela `agro.safras` (e sua RLS) foi
escrita nesta migration, em `supabase/migrations/0019_safras.sql` — é o
pré-requisito de `financeiro_lancamentos.safra_id`/
`financeiro_orcamentos.safra_id` (0020). `agro.producao_registros` ficou
só proposta até a Fase 7 chegar (2026-09-24) — ganhou sua própria migration,
`0022_producao.sql` (ver seção "0022" abaixo, com a correção de RLS que
faltava aqui: a política de consultor abaixo (`producao_consultor_leitura`)
expõe a linha inteira, inclusive `preco_medio`/`receita_obtida` — RLS não
filtra coluna, só linha. `0022_producao.sql` corrige isso de verdade com
uma function).

```sql
-- proposta original — só a parte "agro.safras" foi de fato escrita (ver nota acima)

create table agro.safras (
  id          uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references agro.produtores(id) on delete cascade,
  nome        text not null,              -- ex.: "2025/2026"
  inicio      date,
  fim         date,
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index safras_produtor_idx on agro.safras(produtor_id);

create table agro.producao_registros (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references agro.orgs(id) on delete cascade,
  produtor_id         uuid not null references agro.produtores(id) on delete cascade,
  talhao_id           uuid references agro.talhoes(id) on delete set null,
  safra_id            uuid references agro.safras(id) on delete set null,
  cultura             text,                      -- espelha talhoes.cultura no momento do registro
  area_ha             numeric(10,2),
  producao_prevista   numeric(12,2),
  producao_realizada  numeric(12,2),
  unidade             text default 'sc',         -- sc | t | kg | un — texto livre com sugestão na UI
  preco_medio         numeric(12,2),
  receita_obtida      numeric(14,2),
  observacao          text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index producao_produtor_idx on agro.producao_registros(produtor_id);
create index producao_talhao_idx on agro.producao_registros(talhao_id);
create trigger producao_registros_touch before update on agro.producao_registros
  for each row execute function agro.touch_atualizado_em();  -- função já existe (0001)

-- herda org_id do produtor. A função herdar_de_produtor() de 0012 lê
-- propriedades.produtor_id; aqui a FK já é direta para produtores, então
-- ganha uma função auxiliar mais simples — definida ANTES do trigger que a usa:
create or replace function agro.herdar_de_produtor_direto() returns trigger
language plpgsql as $$
begin
  select org_id into new.org_id from agro.produtores where id = new.produtor_id;
  return new;
end $$;
create trigger producao_registros_herda before insert on agro.producao_registros
  for each row execute function agro.herdar_de_produtor_direto();

alter table agro.safras enable row level security;
create policy safras_dono on agro.safras for all to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));
-- consultor também pode ver/criar safras (é um rótulo de período, não dado sensível;
-- útil para o agrônomo planejar recomendações por safra)
create policy safras_consultor on agro.safras for all to authenticated
  using (exists (select 1 from agro.produtores p where p.id = safras.produtor_id
                 and p.org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor','admin')))
  with check (exists (select 1 from agro.produtores p where p.id = safras.produtor_id
                       and p.org_id = (select agro.jwt_org()) and (select agro.jwt_role()) in ('consultor','admin')));

alter table agro.producao_registros enable row level security;
create policy tenant_guard on agro.producao_registros as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
-- produtor: CRUD completo dos próprios registros
create policy producao_dono on agro.producao_registros for all to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));
-- consultor: SÓ LEITURA (fecha o ciclo esperado x realizado, ver decisão #2 acima)
create policy producao_consultor_leitura on agro.producao_registros for select to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'));
```

**Rollback:**
```sql
drop trigger if exists producao_registros_herda on agro.producao_registros;
drop trigger if exists producao_registros_touch on agro.producao_registros;
drop function if exists agro.herdar_de_produtor_direto();
drop table if exists agro.producao_registros;
drop table if exists agro.safras;
```

---

## 0020 — Financeiro do produtor

**Divergência (2026-09-23):** escrita e aplicada em
`supabase/migrations/0020_financeiro.sql`, igual à proposta abaixo, **mais**
um bucket de Storage (`financeiro`) com 3 políticas (leitura/envio/exclusão,
pasta = `produtor_id`) para o campo `comprovante_path` ter algo de verdade
por trás — a proposta original não incluía Storage. Sem gate de plano: o
feature flag `planos.features.financeiro` citado em `0025` (Fase 11) ainda
não existe no banco, então por ora todo produtor autenticado vê o financeiro,
independente do plano do escritório dele.

```sql
-- 0020_financeiro.sql (escrita como proposto; ver nota de divergência acima
-- para o que foi adicionado além deste bloco)

create table agro.financeiro_categorias (
  id          uuid primary key default gen_random_uuid(),
  produtor_id uuid not null references agro.produtores(id) on delete cascade,
  nome        text not null,
  tipo        text not null check (tipo in ('receita','despesa')),
  padrao      boolean not null default false,  -- semeada automaticamente, não apagável pela UI
  criado_em   timestamptz not null default now()
);

create table agro.financeiro_centros_custo (
  id             uuid primary key default gen_random_uuid(),
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  nome           text not null,
  propriedade_id uuid references agro.propriedades(id) on delete set null,
  talhao_id      uuid references agro.talhoes(id) on delete set null,
  criado_em      timestamptz not null default now()
);

create table agro.financeiro_contas (
  id             uuid primary key default gen_random_uuid(),
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  nome           text not null,                 -- "Caixa", "Banco do Brasil"
  tipo           text not null default 'corrente' check (tipo in ('corrente','poupanca','caixa','outro')),
  saldo_inicial  numeric(14,2) not null default 0,
  criado_em      timestamptz not null default now()
);

create table agro.financeiro_lancamentos (
  id              uuid primary key default gen_random_uuid(),
  produtor_id     uuid not null references agro.produtores(id) on delete cascade,
  conta_id        uuid references agro.financeiro_contas(id) on delete set null,
  categoria_id    uuid references agro.financeiro_categorias(id) on delete set null,
  centro_custo_id uuid references agro.financeiro_centros_custo(id) on delete set null,
  propriedade_id  uuid references agro.propriedades(id) on delete set null,
  talhao_id       uuid references agro.talhoes(id) on delete set null,
  safra_id        uuid references agro.safras(id) on delete set null,
  tipo            text not null check (tipo in ('receita','despesa')),
  descricao       text not null,
  valor           numeric(14,2) not null check (valor >= 0),
  data            date not null,
  vencimento      date,
  status          text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  comprovante_path text,          -- storage: financeiro/{produtor_id}/{uuid}.ext
  observacao      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index financeiro_lanc_produtor_idx on agro.financeiro_lancamentos(produtor_id, data desc);
create index financeiro_lanc_status_idx on agro.financeiro_lancamentos(produtor_id, status) where status in ('pendente','atrasado');
create trigger financeiro_lancamentos_touch before update on agro.financeiro_lancamentos
  for each row execute function agro.touch_atualizado_em();

create table agro.financeiro_orcamentos (
  id               uuid primary key default gen_random_uuid(),
  produtor_id      uuid not null references agro.produtores(id) on delete cascade,
  categoria_id     uuid references agro.financeiro_categorias(id) on delete cascade,
  safra_id         uuid references agro.safras(id) on delete set null,
  valor_planejado  numeric(14,2) not null,
  criado_em        timestamptz not null default now()
);

-- RLS: isolamento total — NENHUMA política de consultor em nenhuma tabela abaixo
alter table agro.financeiro_categorias enable row level security;
alter table agro.financeiro_centros_custo enable row level security;
alter table agro.financeiro_contas enable row level security;
alter table agro.financeiro_lancamentos enable row level security;
alter table agro.financeiro_orcamentos enable row level security;

create policy dono on agro.financeiro_categorias for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_centros_custo for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_contas for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_lancamentos for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));
create policy dono on agro.financeiro_orcamentos for all to authenticated
  using (produtor_id = (select agro.jwt_produtor())) with check (produtor_id = (select agro.jwt_produtor()));

-- categorias padrão, semeadas quando o produtor acessa o financeiro pela 1ª vez
-- (chamado pela aplicação, não por trigger — mesmo padrão de garantirEscritorio())
create or replace function agro.semear_categorias_financeiras(p_produtor uuid)
returns void language plpgsql security definer set search_path = agro, public as $$
begin
  if exists (select 1 from agro.financeiro_categorias where produtor_id = p_produtor) then
    return;
  end if;
  insert into agro.financeiro_categorias (produtor_id, nome, tipo, padrao)
  select p_produtor, nome, tipo, true from (values
    ('Venda de produção','receita'), ('Outras receitas','receita'),
    ('Adubo','despesa'), ('Fertilizantes','despesa'), ('Defensivos','despesa'),
    ('Calcário','despesa'), ('Mão de obra','despesa'), ('Combustível','despesa'),
    ('Energia','despesa'), ('Irrigação','despesa'), ('Máquinas','despesa'),
    ('Manutenção','despesa'), ('Transporte','despesa'), ('Colheita','despesa'),
    ('Beneficiamento','despesa'), ('Outros','despesa')
  ) as padrao(nome, tipo);
end $$;
grant execute on function agro.semear_categorias_financeiras(uuid) to authenticated;
```

**Nota de segurança:** `financeiro_categorias`/`_contas`/`_centros_custo` não
levam `org_id` nem guarda `RESTRICTIVE` — a política `dono` já é suficiente
(só o `produtor_id` do próprio usuário) e essas tabelas não têm caminho de
acesso por organização. Adicionar `org_id` aqui seria coluna morta.

**Rollback:**
```sql
drop function if exists agro.semear_categorias_financeiras(uuid);
drop table if exists agro.financeiro_orcamentos;
drop table if exists agro.financeiro_lancamentos;
drop table if exists agro.financeiro_contas;
drop table if exists agro.financeiro_centros_custo;
drop table if exists agro.financeiro_categorias;
```

---

## 0022 — Produção e safra (Fase 7)

**Escrita e aplicada em 2026-09-24** (`supabase/migrations/0022_producao.sql`),
completando o que `0019` deixou pra trás. Divergência em relação à proposta
original: a política `producao_consultor_leitura` (SELECT de linha inteira
pra consultor) **não foi implementada** — ela contradizia a própria decisão
#2 deste documento ("campos comerciais continuam só do produtor"), porque
RLS filtra linha, não coluna; um `select *` do consultor veria
`preco_medio`/`receita_obtida` também. No lugar dela:

```sql
-- tabela base: SEM política de consultor
create policy producao_dono on agro.producao_registros for all to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));

-- consultor só enxerga produção por aqui — nunca seleciona as colunas comerciais
create or replace function agro.producao_visivel_consultor()
returns table (
  id uuid, produtor_id uuid, talhao_id uuid, safra_id uuid,
  cultura text, area_ha numeric, producao_prevista numeric, producao_realizada numeric,
  unidade text, criado_em timestamptz
)
language sql stable security definer set search_path = agro, public as $$
  select r.id, r.produtor_id, r.talhao_id, r.safra_id, r.cultura, r.area_ha,
         r.producao_prevista, r.producao_realizada, r.unidade, r.criado_em
  from agro.producao_registros r
  where r.org_id = (select agro.jwt_org())
    and (select agro.jwt_role()) in ('consultor','admin')
$$;
grant execute on function agro.producao_visivel_consultor() to authenticated;
```

Mesmo padrão já usado no projeto pra exposição controlada (`painel_consultor()`,
`casar_produtor()`, `resultados_por_token()`): function `security definer`
com filtro e lista de colunas explícitos, em vez de confiar em RLS pra
esconder coluna — RLS não faz isso.

**Telas:** `/produtor/producao` (CRUD do produtor, todas as colunas) e a aba
"Produção" de `/app/talhoes/[id]` (consultor, só leitura, via a function
acima). A aba "Custos" do mesmo talhão permanece **intencionalmente**
inacessível ao consultor — `financeiro_*` é 100% isolado por decisão #1,
sem exceção; a mensagem da aba deixa isso explícito em vez de sugerir que é
"em breve".

**Rollback:**
```sql
drop function if exists agro.producao_visivel_consultor();
drop trigger if exists producao_registros_herda on agro.producao_registros;
drop trigger if exists producao_registros_touch on agro.producao_registros;
drop function if exists agro.herdar_de_produtor_direto();
drop table if exists agro.producao_registros;
```

---

## 0023 — Agenda do agrônomo

**Escrita e aplicada em 2026-09-24** (`supabase/migrations/0023_agenda.sql`),
idêntica à proposta abaixo. Fase 9 também carregou o débito técnico #4 do
audit (formulário de registrar visita, que não existia) — ver
`PROGRESSO.md`. Simplificação assumida na UI: "concluir" um evento de
agenda tipo `visita` **não** preenche `visita_id` automaticamente ligando a
uma linha de `agro.visitas` — o consultor registra a visita separadamente
em `/app/talhoes/[id]`, aba Monitoramento. Ligar as duas telas fica pra
quando fizer falta de verdade.

```sql
-- 0023_agenda.sql

create table agro.agenda_eventos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  consultor_id  uuid references auth.users(id) on delete set null,
  produtor_id   uuid references agro.produtores(id) on delete set null,
  talhao_id     uuid references agro.talhoes(id) on delete set null,
  tipo          text not null check (tipo in ('visita','coleta_solo','retorno','aplicacao','reuniao','outro')),
  titulo        text not null,
  data          date not null,
  hora          time,
  status        text not null default 'planejado' check (status in ('planejado','concluido','cancelado')),
  visita_id     uuid references agro.visitas(id) on delete set null,  -- preenchido ao concluir como visita
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index agenda_org_data_idx on agro.agenda_eventos(org_id, data);
create index agenda_produtor_idx on agro.agenda_eventos(produtor_id) where produtor_id is not null;
create trigger agenda_eventos_touch before update on agro.agenda_eventos
  for each row execute function agro.touch_atualizado_em();

alter table agro.agenda_eventos enable row level security;
create policy tenant_guard on agro.agenda_eventos as restrictive for all to authenticated
  using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()));
create policy agenda_consultor on agro.agenda_eventos for all to authenticated
  using ((select agro.jwt_role()) in ('consultor','admin'))
  with check ((select agro.jwt_role()) in ('consultor','admin'));
-- produtor vê (não edita) os próprios eventos agendados — alimenta o card
-- "Visita técnica marcada para 27/09" no dashboard dele
create policy agenda_produtor_leitura on agro.agenda_eventos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
```

O "roteiro do dia" e as views de dia/semana/mês são consultas (`where org_id
= ... and data between ...`), não schema adicional. "Arrastar para
reagendar" é só um `update agenda_eventos set data = $novaData where id =
$id` — a UI de calendário é o trabalho novo, não o banco.

**Rollback:**
```sql
drop trigger if exists agenda_eventos_touch on agro.agenda_eventos;
drop table if exists agro.agenda_eventos;
```

---

## 0024 — Notificações

**Escrita e aplicada em 2026-09-24** (`supabase/migrations/0024_notificacoes.sql`).
Só 2 dos gatilhos possíveis foram implementados de verdade —
`notificar_nova_recomendacao()` (igual à proposta) e
`notificar_visita_agendada()` (novo, dispara em `agenda_eventos`, tipo
`visita`, quando tem `produtor_id`). `nova_analise`/`documento_disponivel`/
`atividade_vencendo`/`conta_vencendo` continuam só valores válidos no
`check` do `tipo` — sem gatilho ainda, ficam pra quando fizer falta.

```sql
-- 0024_notificacoes.sql

create table agro.notificacoes (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references agro.orgs(id) on delete cascade,
  destinatario_user_id  uuid not null references auth.users(id) on delete cascade,
  tipo                  text not null check (tipo in (
                          'nova_recomendacao','nova_analise','visita_agendada',
                          'visita_realizada','documento_disponivel',
                          'atividade_vencendo','conta_vencendo'
                        )),
  titulo    text not null,
  corpo     text,
  link      text,                 -- rota relativa, ex.: /produtor/laudos/{id}
  lida_em   timestamptz,
  criado_em timestamptz not null default now()
);
create index notificacoes_destinatario_idx on agro.notificacoes(destinatario_user_id, lida_em);

alter table agro.notificacoes enable row level security;
create policy notificacoes_dono on agro.notificacoes for select to authenticated
  using (destinatario_user_id = (select auth.uid()));
create policy notificacoes_marcar_lida on agro.notificacoes for update to authenticated
  using (destinatario_user_id = (select auth.uid()))
  with check (destinatario_user_id = (select auth.uid()));
-- inserção só via função security definer (abaixo) ou service_role — nunca client direto

-- exemplo de gatilho: recomendação emitida -> notifica o produtor, se ele tiver portal
create or replace function agro.notificar_nova_recomendacao() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user uuid;
  v_org  uuid;
begin
  select p.user_id, p.org_id into v_user, v_org
  from agro.analises a join agro.produtores p on p.id = a.produtor_id
  where a.id = new.analise_id;

  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, link)
    values (v_org, v_user, 'nova_recomendacao', 'Seu agrônomo publicou uma nova recomendação.',
            '/produtor/laudos/' || new.id);
  end if;
  return new;
end $$;

create trigger recomendacoes_notifica after insert on agro.recomendacoes
  for each row execute function agro.notificar_nova_recomendacao();
```

Gatilhos equivalentes para `nova_analise`, `visita_agendada` (em
`agenda_eventos`), `documento_disponivel` seguem o mesmo padrão — omitidos
aqui por repetição; cada um vira uma função `notificar_*()` + trigger
próprio no momento da implementação, para poder testar cada evento
isoladamente no pgTAP.

**Rollback:**
```sql
drop trigger if exists recomendacoes_notifica on agro.recomendacoes;
drop function if exists agro.notificar_nova_recomendacao();
drop table if exists agro.notificacoes;
```

---

## 0025 — Planos com feature flags e papéis novos

**Escrita e aplicada em 2026-09-24** (`supabase/migrations/0025_planos_features_e_papeis.sql`).
Duas divergências: (1) todos os planos nasceram com `financeiro`/
`relatorios_avancados` em `true` — a org em uso hoje já testa as duas
telas ativamente, e decidir o que vira premium é decisão comercial de
quem vende o software, não algo pra travar sozinho numa migration.
Mudar isso é um `update agro.planos set features = ...`, sem tocar em
código. (2) function nova que a proposta original não previa,
`agro.tenho_feature(text)` — necessária porque `agro.assinaturas` só
tem política de leitura pra `consultor`/`admin` (0013); sem essa function,
não haveria como o **produtor** checar se o financeiro do escritório dele
está habilitado, e o gating em `/produtor/financeiro` não teria como
funcionar. Mesmo padrão de exposição controlada já usado no projeto.

```sql
-- 0025_planos_features_e_papeis.sql

alter table agro.planos add column if not exists features jsonb not null default '{}'::jsonb;
alter table agro.planos add column if not exists usuarios_max int not null default 1;

comment on column agro.planos.features is
  'feature flags do plano, ex.: {"financeiro": true, "relatorios_avancados": false}';

update agro.planos set features = '{"financeiro": false, "relatorios_avancados": false}'::jsonb
  where id = 'teste';
update agro.planos set features = '{"financeiro": true, "relatorios_avancados": false}'::jsonb, usuarios_max = 3
  where id = 'tecnico';
update agro.planos set features = '{"financeiro": true, "relatorios_avancados": true}'::jsonb, usuarios_max = 10
  where id = 'escritorio';

-- papéis novos no mesmo check existente (nome do constraint a confirmar
-- contra o banco real — foi criado inline em 0001_extensoes_e_orgs.sql;
-- Postgres nomeia automaticamente como <tabela>_<coluna>_check quando não
-- há nome explícito)
alter table agro.profiles drop constraint if exists profiles_role_check;
alter table agro.profiles add constraint profiles_role_check
  check (role in ('admin','consultor','produtor','proprietario','tecnico','assistente'));

alter table agro.profiles add column if not exists titulo text;  -- rótulo livre, cosmético (ver PRODUCT_V2.md §2.3)
```

**Rollback:**
```sql
alter table agro.profiles drop column if exists titulo;
alter table agro.profiles drop constraint if exists profiles_role_check;
alter table agro.profiles add constraint profiles_role_check
  check (role in ('admin','consultor','produtor'));  -- restaura o check original
alter table agro.planos drop column if exists usuarios_max;
alter table agro.planos drop column if exists features;
```

---

## O que este documento não propõe (e por quê)

- **Tabela `culturas` relacional** — adiada, ver `PRODUCT_V2.md §2.4`.
- **`financeiro_escritorio_*`** (financeiro do próprio consultor, item de
  menu no pedido) — sem especificação suficiente ainda; rota reservada, sem
  schema (`UX_ARCHITECTURE.md §1.1`).
- **Permissões granulares por papel** (RLS diferente para `tecnico` vs
  `assistente`) — os papéis novos entram no `check` para existir no
  cadastro, mas continuam com o mesmo acesso de `consultor` nesta leva
  (`PRODUCT_V2.md §2.3`). Adicionar RLS diferenciada por papel é trabalho
  futuro, deliberadamente fora desta proposta.
- **`agro.culturas`, mapa interativo, full-text search, realtime** — todos
  adiados com justificativa em `UX_ARCHITECTURE.md`.

## Antes de aplicar qualquer migration desta lista

1. ~~Confirmar que `0001`–`0018` aplicam limpo num projeto novo~~ **feito em
   2026-09-23** — `0001`–`0021` rodaram do zero contra um Supabase real
   (`npx supabase db push --db-url`), 2 bugs achados e corrigidos (ver
   `PRODUCT_V2.md §7`).
2. `supabase test db` (pgTAP, `rls.test.sql`) ainda não rodou — depende do
   runner local via Docker, que nenhum ambiente usado até agora tem.
3. Aplicar `0022`–`0024` uma de cada vez, cada uma com seu próprio teste
   pgTAP cobrindo pelo menos: dono acessa, terceiro não acessa, consultor
   acessa (ou não, conforme a tabela).
4. Só então começar a Fase correspondente em `PRODUCT_V2.md`.
