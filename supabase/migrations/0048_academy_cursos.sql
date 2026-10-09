-- 0048 — Academy: cursos e trilhas, matrícula, progresso e certificado de participação
--
-- Um CURSO agrupa AULAS em MÓDULOS. Cada aula é um conteúdo da biblioteca (vídeo, artigo, material ou notícia) — o mesmo
-- conteúdo pode ser aula de vários cursos e também ser indicado avulso. O aluno (produtor) se matricula, o banco guarda o
-- progresso por aula e, ao concluir todas, marca a matrícula como concluída e emite o certificado de participação.
--
-- Regras que ficam no banco (o app só mostra):
--   - o produtor só vê curso PUBLICADO e destinado a ele (todos, selecionados, por cultura ou indicado a ele);
--   - as aulas de um curso visível são visíveis, mesmo que o conteúdo avulso fosse "só selecionados";
--   - não se publica curso sem aula, nem com aula que não esteja publicada; não se arquiva/volta a rascunho uma aula de curso publicado;
--   - o produtor só mexe no PRÓPRIO progresso e matrícula, com a hora do servidor, e não "desconclui";
--   - matrícula concluída e certificado só nascem da conta do banco (todas as aulas concluídas) — nunca por escrita do cliente;
--   - o certificado guarda uma FOTO do que valia na emissão (nome do curso, aluno, escritório, responsável técnico, carga horária).
-- Certificado é de PARTICIPAÇÃO do escritório: não equivale a certificação acadêmica ou profissional (o texto da tela diz isso).

-- ===========================================================================
-- 1. cursos, módulos, aulas, públicos
-- ===========================================================================
create table agro.academy_cursos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references agro.orgs(id) on delete cascade,
  autor_id      uuid references auth.users(id) on delete set null,
  titulo        text not null check (char_length(btrim(titulo)) between 3 and 160),
  resumo        text check (char_length(resumo) <= 400),
  descricao     text check (char_length(descricao) <= 5000),
  cultura       text check (char_length(cultura) <= 60),
  cultura_chave text,
  tema          text check (tema in ('solo', 'adubacao', 'calagem', 'pragas', 'doencas', 'irrigacao', 'colheita', 'gestao', 'seguranca', 'outro')),
  nivel         text not null default 'basico' check (nivel in ('basico', 'intermediario', 'avancado')),
  capa_path     text check (char_length(capa_path) <= 400),
  destaque      boolean not null default false,
  certificado   boolean not null default true,
  status        text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  visibilidade  text not null default 'todos' check (visibilidade in ('todos', 'selecionados', 'cultura')),
  revisado_por  uuid references auth.users(id) on delete set null,
  revisado_em   timestamptz,
  publicado_em  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint curso_cultura_obrigatoria check (visibilidade <> 'cultura' or coalesce(btrim(cultura), '') <> '')
);
create index academy_cursos_org_status_idx on agro.academy_cursos(org_id, status);
create index academy_cursos_autor_idx on agro.academy_cursos(autor_id);
create index academy_cursos_revisor_idx on agro.academy_cursos(revisado_por);
create trigger academy_cursos_touch before update on agro.academy_cursos
  for each row execute function agro.touch_atualizado_em();

create table agro.academy_curso_modulos (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references agro.orgs(id) on delete cascade,
  curso_id  uuid not null references agro.academy_cursos(id) on delete cascade,
  titulo    text not null check (char_length(btrim(titulo)) between 1 and 160),
  posicao   int not null default 0,
  criado_em timestamptz not null default now()
);
create index academy_curso_modulos_curso_idx on agro.academy_curso_modulos(curso_id, posicao);
create index academy_curso_modulos_org_idx on agro.academy_curso_modulos(org_id);

create table agro.academy_curso_aulas (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references agro.orgs(id) on delete cascade,
  curso_id    uuid not null references agro.academy_cursos(id) on delete cascade,
  modulo_id   uuid not null references agro.academy_curso_modulos(id) on delete cascade,
  -- restrict: apagar um conteúdo que é aula de curso é erro explícito (arquive em vez de apagar)
  conteudo_id uuid not null references agro.academy_conteudos(id) on delete restrict,
  posicao     int not null default 0,
  criado_em   timestamptz not null default now(),
  unique (curso_id, conteudo_id)
);
create index academy_curso_aulas_modulo_idx on agro.academy_curso_aulas(modulo_id, posicao);
create index academy_curso_aulas_conteudo_idx on agro.academy_curso_aulas(conteudo_id);
create index academy_curso_aulas_org_idx on agro.academy_curso_aulas(org_id);

create table agro.academy_curso_publicos (
  curso_id    uuid not null references agro.academy_cursos(id) on delete cascade,
  produtor_id uuid not null references agro.produtores(id) on delete cascade,
  org_id      uuid not null references agro.orgs(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (curso_id, produtor_id)
);
create index academy_curso_publicos_produtor_idx on agro.academy_curso_publicos(produtor_id);
create index academy_curso_publicos_org_idx on agro.academy_curso_publicos(org_id);

-- Regras do curso que o cliente não decide: autoria, escritório, cultura, capa, revisão e "pode publicar?".
create or replace function agro.academy_cursos_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
  v_aulas   int;
  v_fora    int;
begin
  if tg_op = 'INSERT' then
    if v_cliente then new.autor_id := auth.uid(); end if;
  else
    if new.org_id is distinct from old.org_id then
      raise exception 'O escritório de um curso não pode ser alterado.' using errcode = '42501';
    end if;
    if v_cliente then new.autor_id := old.autor_id; end if;
  end if;

  new.cultura_chave := agro.slug_cultura(new.cultura);

  if new.capa_path is not null and new.capa_path not like new.org_id::text || '/%' then
    raise exception 'A capa precisa estar na pasta do escritório.' using errcode = '22023';
  end if;

  if new.status = 'publicado' then
    select count(*), count(*) filter (where c.status <> 'publicado')
      into v_aulas, v_fora
    from agro.academy_curso_aulas a join agro.academy_conteudos c on c.id = a.conteudo_id
    where a.curso_id = new.id;
    if tg_op = 'INSERT' or v_aulas = 0 then
      raise exception 'Adicione pelo menos uma aula antes de publicar o curso.' using errcode = '22023';
    end if;
    if v_fora > 0 then
      raise exception 'Todas as aulas precisam estar publicadas para publicar o curso.' using errcode = '22023';
    end if;
    if v_cliente then new.revisado_por := auth.uid(); end if;
    new.revisado_em := now();
    new.publicado_em := coalesce(case when tg_op = 'UPDATE' then old.publicado_em end, now());
  elsif v_cliente and tg_op = 'UPDATE' then
    new.revisado_por := old.revisado_por;
    new.revisado_em := old.revisado_em;
    new.publicado_em := old.publicado_em;
  end if;
  return new;
end $$;
create trigger academy_cursos_regras before insert or update on agro.academy_cursos
  for each row execute function agro.academy_cursos_regras();

-- Módulos e aulas herdam o escritório do curso e só aceitam o que é do mesmo curso/escritório.
create or replace function agro.academy_curso_modulos_herda() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  select c.org_id into new.org_id from agro.academy_cursos c where c.id = new.curso_id;
  if new.org_id is null then raise exception 'Curso não encontrado.' using errcode = '22023'; end if;
  return new;
end $$;
create trigger academy_curso_modulos_herda before insert on agro.academy_curso_modulos
  for each row execute function agro.academy_curso_modulos_herda();

create or replace function agro.academy_curso_aulas_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org_curso uuid;
  v_status_curso text;
  v_org_cont uuid;
  v_status_cont text;
begin
  select c.org_id, c.status into v_org_curso, v_status_curso from agro.academy_cursos c where c.id = new.curso_id;
  if v_org_curso is null then raise exception 'Curso não encontrado.' using errcode = '22023'; end if;
  new.org_id := v_org_curso;
  if not exists (select 1 from agro.academy_curso_modulos m where m.id = new.modulo_id and m.curso_id = new.curso_id) then
    raise exception 'O módulo não é deste curso.' using errcode = '22023';
  end if;
  select c.org_id, c.status into v_org_cont, v_status_cont from agro.academy_conteudos c where c.id = new.conteudo_id;
  if v_org_cont is distinct from v_org_curso then
    raise exception 'Conteúdo não encontrado neste escritório.' using errcode = '22023';
  end if;
  -- curso no ar só ganha aula que também está no ar
  if v_status_curso = 'publicado' and v_status_cont <> 'publicado' then
    raise exception 'Este curso está publicado: só aceita aulas publicadas.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger academy_curso_aulas_regras before insert or update on agro.academy_curso_aulas
  for each row execute function agro.academy_curso_aulas_regras();

-- Tirar do ar um conteúdo que é aula de curso publicado deixaria o aluno sem a aula: o banco não deixa.
create or replace function agro.academy_conteudos_em_curso() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  if new.status <> 'publicado' and old.status = 'publicado' and exists (
    select 1 from agro.academy_curso_aulas a join agro.academy_cursos c on c.id = a.curso_id
    where a.conteudo_id = new.id and c.status = 'publicado'
  ) then
    raise exception 'Este conteúdo é aula de um curso publicado. Tire a aula do curso (ou o curso do ar) antes.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger academy_conteudos_em_curso before update on agro.academy_conteudos
  for each row execute function agro.academy_conteudos_em_curso();

create or replace function agro.academy_curso_publicos_herda() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  select c.org_id into new.org_id from agro.academy_cursos c where c.id = new.curso_id;
  if new.org_id is null then raise exception 'Curso não encontrado.' using errcode = '22023'; end if;
  if not exists (select 1 from agro.produtores p where p.id = new.produtor_id and p.org_id = new.org_id) then
    raise exception 'Produtor de outro escritório.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger academy_curso_publicos_herda before insert on agro.academy_curso_publicos
  for each row execute function agro.academy_curso_publicos_herda();

-- ===========================================================================
-- 2. indicação passa a valer também para CURSO
-- ===========================================================================
alter table agro.academy_indicacoes alter column conteudo_id drop not null;
alter table agro.academy_indicacoes add column curso_id uuid references agro.academy_cursos(id) on delete cascade;
alter table agro.academy_indicacoes add constraint indicacao_conteudo_ou_curso check ((conteudo_id is not null) <> (curso_id is not null));
alter table agro.academy_indicacoes add constraint academy_indicacoes_curso_produtor_key unique (curso_id, produtor_id);
create index academy_indicacoes_curso_idx on agro.academy_indicacoes(curso_id);

create or replace function agro.academy_indicacoes_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org    uuid;
  v_status text;
begin
  if new.curso_id is not null then
    select c.org_id, c.status into v_org, v_status from agro.academy_cursos c where c.id = new.curso_id;
    if v_org is null then raise exception 'Curso não encontrado.' using errcode = '22023'; end if;
    if v_status <> 'publicado' then raise exception 'Só curso publicado pode ser indicado.' using errcode = '22023'; end if;
  else
    select c.org_id, c.status into v_org, v_status from agro.academy_conteudos c where c.id = new.conteudo_id;
    if v_org is null then raise exception 'Conteúdo não encontrado.' using errcode = '22023'; end if;
    if v_status <> 'publicado' then raise exception 'Só conteúdo publicado pode ser indicado.' using errcode = '22023'; end if;
  end if;
  new.org_id := v_org;
  if not exists (select 1 from agro.produtores p where p.id = new.produtor_id and p.org_id = v_org) then
    raise exception 'Produtor de outro escritório.' using errcode = '42501';
  end if;
  if new.visita_id is not null and not exists (select 1 from agro.visitas v where v.id = new.visita_id and v.produtor_id = new.produtor_id) then
    raise exception 'A visita não é deste produtor.' using errcode = '22023';
  end if;
  if new.analise_id is not null and not exists (select 1 from agro.analises a where a.id = new.analise_id and a.produtor_id = new.produtor_id) then
    raise exception 'A análise não é deste produtor.' using errcode = '22023';
  end if;
  if current_user in ('authenticated', 'anon') then
    new.indicado_por := auth.uid();
    new.aberto_em := null;
    new.concluido_em := null;
  end if;
  return new;
end $$;

-- a proteção das colunas (o produtor só marca abertura/conclusão) passa a incluir o curso
create or replace function agro.academy_indicacoes_protege() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.id, new.org_id, new.conteudo_id, new.curso_id, new.produtor_id, new.indicado_por, new.visita_id, new.analise_id, new.mensagem, new.criado_em)
     is distinct from
     (old.id, old.org_id, old.conteudo_id, old.curso_id, old.produtor_id, old.indicado_por, old.visita_id, old.analise_id, old.mensagem, old.criado_em) then
    raise exception 'Só a abertura e a conclusão podem ser registradas.' using errcode = '42501';
  end if;
  if old.aberto_em is not null then new.aberto_em := old.aberto_em;
  elsif new.aberto_em is not null then new.aberto_em := now();
  end if;
  if old.concluido_em is not null then new.concluido_em := old.concluido_em;
  elsif new.concluido_em is not null then new.concluido_em := now();
  end if;
  if new.concluido_em is not null and new.aberto_em is null then new.aberto_em := new.concluido_em; end if;
  return new;
end $$;

-- o aviso no portal leva ao site da Academy (e serve para curso e para aula)
create or replace function agro.notificar_conteudo_indicado() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user   uuid;
  v_titulo text;
  v_link   text;
  v_o_que  text;
begin
  select p.user_id into v_user from agro.produtores p where p.id = new.produtor_id;
  if new.curso_id is not null then
    select c.titulo into v_titulo from agro.academy_cursos c where c.id = new.curso_id;
    v_link := '/academy/cursos/' || new.curso_id;
    v_o_que := 'um curso';
  else
    select c.titulo into v_titulo from agro.academy_conteudos c where c.id = new.conteudo_id;
    v_link := '/academy/aula/' || new.conteudo_id;
    v_o_que := 'um conteúdo';
  end if;
  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, corpo, link)
    values (new.org_id, v_user, 'conteudo_indicado',
            'Seu agrônomo indicou ' || v_o_que || ': ' || coalesce(v_titulo, 'novidade na Academy'),
            new.mensagem, v_link);
  end if;
  return new;
end $$;
-- avisos já enviados apontavam para a primeira versão do portal
update agro.notificacoes set link = '/academy/aula/' || substring(link from '[^/]+$')
  where tipo = 'conteudo_indicado' and link like '/produtor/universidade/%';

-- ===========================================================================
-- 3. matrícula, progresso, certificado
-- ===========================================================================
create table agro.academy_matriculas (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  curso_id     uuid not null references agro.academy_cursos(id) on delete cascade,
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  criado_em    timestamptz not null default now(),
  concluido_em timestamptz,
  unique (curso_id, produtor_id)
);
create index academy_matriculas_org_idx on agro.academy_matriculas(org_id);
create index academy_matriculas_produtor_idx on agro.academy_matriculas(produtor_id);

create table agro.academy_progresso (
  produtor_id  uuid not null references agro.produtores(id) on delete cascade,
  conteudo_id  uuid not null references agro.academy_conteudos(id) on delete cascade,
  org_id       uuid not null references agro.orgs(id) on delete cascade,
  iniciado_em  timestamptz not null default now(),
  concluido_em timestamptz,
  primary key (produtor_id, conteudo_id)
);
create index academy_progresso_conteudo_idx on agro.academy_progresso(conteudo_id);
create index academy_progresso_org_idx on agro.academy_progresso(org_id);

create table agro.academy_certificados (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references agro.orgs(id) on delete cascade,
  curso_id          uuid not null references agro.academy_cursos(id) on delete cascade,
  produtor_id       uuid not null references agro.produtores(id) on delete cascade,
  codigo            text not null unique,
  emitido_em        timestamptz not null default now(),
  -- foto do que valia na emissão: o certificado não muda se o curso for renomeado ou o escritório mudar de nome
  titulo_curso      text not null,
  aluno_nome        text not null,
  escritorio_nome   text not null,
  responsavel_nome  text,
  responsavel_crea  text,
  carga_min         int not null default 0,
  aulas             int not null default 0,
  unique (curso_id, produtor_id)
);
create index academy_certificados_org_idx on agro.academy_certificados(org_id);
create index academy_certificados_produtor_idx on agro.academy_certificados(produtor_id);

create or replace function agro.academy_matriculas_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org uuid;
  v_status text;
begin
  select c.org_id, c.status into v_org, v_status from agro.academy_cursos c where c.id = new.curso_id;
  if v_org is null then raise exception 'Curso não encontrado.' using errcode = '22023'; end if;
  if v_status <> 'publicado' then raise exception 'Este curso não está disponível.' using errcode = '22023'; end if;
  new.org_id := v_org;
  if not exists (select 1 from agro.produtores p where p.id = new.produtor_id and p.org_id = v_org) then
    raise exception 'Produtor de outro escritório.' using errcode = '42501';
  end if;
  new.concluido_em := null; -- quem conclui é a conta do banco
  if current_user in ('authenticated', 'anon') then new.criado_em := now(); end if;
  return new;
end $$;
create trigger academy_matriculas_regras before insert on agro.academy_matriculas
  for each row execute function agro.academy_matriculas_regras();

-- o cliente não muda a matrícula (nem "conclui" por conta própria)
create or replace function agro.academy_matriculas_protege() returns trigger
language plpgsql set search_path = agro, public as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'A matrícula só muda pelo progresso das aulas.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger academy_matriculas_protege before update on agro.academy_matriculas
  for each row execute function agro.academy_matriculas_protege();

create or replace function agro.academy_progresso_regras() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_org uuid;
begin
  if tg_op = 'INSERT' then
    select p.org_id into v_org from agro.produtores p where p.id = new.produtor_id;
    if v_org is null then raise exception 'Produtor não encontrado.' using errcode = '22023'; end if;
    -- só registra progresso de conteúdo que este produtor pode ver (a RLS de quem escreve decide)
    if not exists (select 1 from agro.academy_conteudos c where c.id = new.conteudo_id and c.org_id = v_org) then
      raise exception 'Conteúdo não encontrado.' using errcode = '22023';
    end if;
    new.org_id := v_org;
    if current_user in ('authenticated', 'anon') then
      new.iniciado_em := now();
      new.concluido_em := case when new.concluido_em is not null then now() end;
    end if;
  elsif current_user in ('authenticated', 'anon') then
    if (new.produtor_id, new.conteudo_id, new.org_id) is distinct from (old.produtor_id, old.conteudo_id, old.org_id) then
      raise exception 'Só a conclusão pode ser registrada.' using errcode = '42501';
    end if;
    new.iniciado_em := old.iniciado_em;
    -- concluir vale uma vez e não se desfaz
    new.concluido_em := coalesce(old.concluido_em, case when new.concluido_em is not null then now() end);
  end if;
  return new;
end $$;
create trigger academy_progresso_regras before insert or update on agro.academy_progresso
  for each row execute function agro.academy_progresso_regras();

-- A conta do banco: curso concluído = todas as aulas concluídas pelo aluno. Roda como dono (security definer): é a única
-- porta para marcar matrícula concluída e emitir certificado.
create or replace function agro.academy_sincronizar_curso(p_curso uuid, p_produtor uuid) returns void
language plpgsql security definer set search_path = agro, public as $$
declare
  v_curso  agro.academy_cursos%rowtype;
  v_total  int;
  v_feitas int;
  v_carga  int;
  v_aluno  text;
  v_org    text;
  v_resp_nome text;
  v_resp_crea text;
begin
  select * into v_curso from agro.academy_cursos where id = p_curso;
  if not found then return; end if;
  if not exists (select 1 from agro.academy_matriculas m where m.curso_id = p_curso and m.produtor_id = p_produtor) then return; end if;

  select count(*),
         count(*) filter (where pr.concluido_em is not null),
         coalesce(sum(c.duracao_min), 0)
    into v_total, v_feitas, v_carga
  from agro.academy_curso_aulas a
  join agro.academy_conteudos c on c.id = a.conteudo_id
  left join agro.academy_progresso pr on pr.conteudo_id = a.conteudo_id and pr.produtor_id = p_produtor
  where a.curso_id = p_curso;

  if v_total = 0 or v_feitas < v_total then return; end if;

  update agro.academy_matriculas set concluido_em = coalesce(concluido_em, now())
    where curso_id = p_curso and produtor_id = p_produtor;

  if v_curso.certificado and not exists (select 1 from agro.academy_certificados x where x.curso_id = p_curso and x.produtor_id = p_produtor) then
    select p.nome into v_aluno from agro.produtores p where p.id = p_produtor;
    select o.nome into v_org from agro.orgs o where o.id = v_curso.org_id;
    select pf.nome, pf.crea into v_resp_nome, v_resp_crea from agro.profiles pf where pf.id = v_curso.revisado_por;
    insert into agro.academy_certificados (org_id, curso_id, produtor_id, codigo, titulo_curso, aluno_nome, escritorio_nome,
                                           responsavel_nome, responsavel_crea, carga_min, aulas)
    values (v_curso.org_id, p_curso, p_produtor,
            'AT-' || upper(substr(md5(random()::text || clock_timestamp()::text || p_produtor::text), 1, 5)) || '-' ||
                     upper(substr(md5(clock_timestamp()::text || random()::text || p_curso::text), 1, 5)),
            v_curso.titulo, coalesce(v_aluno, 'Aluno'), coalesce(v_org, 'Escritório'),
            nullif(btrim(v_resp_nome), ''), nullif(btrim(v_resp_crea), ''), v_carga, v_total);
  end if;
end $$;

-- depois de cada progresso: marca a indicação da aula e confere todo curso em que o aluno está matriculado e que tem a aula
create or replace function agro.academy_progresso_depois() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_curso uuid;
begin
  update agro.academy_indicacoes
     set aberto_em = coalesce(aberto_em, now()),
         concluido_em = case when new.concluido_em is not null then coalesce(concluido_em, now()) else concluido_em end
   where conteudo_id = new.conteudo_id and produtor_id = new.produtor_id;
  for v_curso in
    select distinct a.curso_id from agro.academy_curso_aulas a
    join agro.academy_matriculas m on m.curso_id = a.curso_id and m.produtor_id = new.produtor_id
    where a.conteudo_id = new.conteudo_id
  loop
    perform agro.academy_sincronizar_curso(v_curso, new.produtor_id);
  end loop;
  return null;
end $$;
create trigger academy_progresso_depois after insert or update on agro.academy_progresso
  for each row execute function agro.academy_progresso_depois();

-- matrícula nova em curso cujas aulas o aluno já fez (por outro caminho) conclui na hora
create or replace function agro.academy_matriculas_depois() returns trigger
language plpgsql security definer set search_path = agro, public as $$
begin
  perform agro.academy_sincronizar_curso(new.curso_id, new.produtor_id);
  update agro.academy_indicacoes set aberto_em = coalesce(aberto_em, now())
   where curso_id = new.curso_id and produtor_id = new.produtor_id;
  return null;
end $$;
create trigger academy_matriculas_depois after insert on agro.academy_matriculas
  for each row execute function agro.academy_matriculas_depois();

-- curso indicado e concluído: a indicação do curso também fecha
create or replace function agro.academy_matriculas_fecha_indicacao() returns trigger
language plpgsql security definer set search_path = agro, public as $$
begin
  if new.concluido_em is not null and old.concluido_em is null then
    update agro.academy_indicacoes set concluido_em = coalesce(concluido_em, now()), aberto_em = coalesce(aberto_em, now())
     where curso_id = new.curso_id and produtor_id = new.produtor_id;
  end if;
  return null;
end $$;
create trigger academy_matriculas_fecha_indicacao after update on agro.academy_matriculas
  for each row execute function agro.academy_matriculas_fecha_indicacao();

-- ===========================================================================
-- 4. RLS
-- ===========================================================================
alter table agro.academy_cursos enable row level security;
alter table agro.academy_curso_modulos enable row level security;
alter table agro.academy_curso_aulas enable row level security;
alter table agro.academy_curso_publicos enable row level security;
alter table agro.academy_matriculas enable row level security;
alter table agro.academy_progresso enable row level security;
alter table agro.academy_certificados enable row level security;

do $$
declare
  t text;
begin
  -- escritório (tenant) vale para tudo
  foreach t in array array['academy_cursos', 'academy_curso_modulos', 'academy_curso_aulas', 'academy_curso_publicos',
                           'academy_matriculas', 'academy_progresso', 'academy_certificados'] loop
    execute format('create policy tenant_guard on agro.%I as restrictive for all to authenticated using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()))', t);
  end loop;
  -- montar o curso: equipe lê tudo; escrever exige academy.gerenciar (restritiva)
  foreach t in array array['academy_cursos', 'academy_curso_modulos', 'academy_curso_aulas', 'academy_curso_publicos'] loop
    execute format('create policy %I on agro.%I for all to authenticated using ((select agro.jwt_role()) in (''consultor'', ''admin'')) with check ((select agro.jwt_role()) in (''consultor'', ''admin''))', t || '_consultor', t);
    execute format('create policy perfil_insert on agro.%I as restrictive for insert to authenticated with check ((select agro.pode(''academy.gerenciar'')))', t);
    execute format('create policy perfil_update on agro.%I as restrictive for update to authenticated using ((select agro.pode(''academy.gerenciar''))) with check ((select agro.pode(''academy.gerenciar'')))', t);
    execute format('create policy perfil_delete on agro.%I as restrictive for delete to authenticated using ((select agro.pode(''academy.gerenciar'')))', t);
  end loop;
end $$;

-- equipe só lê o acompanhamento (matrícula, progresso, certificado); nada de escrever
create policy matriculas_consultor on agro.academy_matriculas for select to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy progresso_consultor on agro.academy_progresso for select to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));
create policy certificados_consultor on agro.academy_certificados for select to authenticated
  using ((select agro.jwt_role()) in ('consultor', 'admin'));

-- produtor: curso publicado e destinado a ele (todos, cultura, selecionados ou indicado)
create policy cursos_produtor on agro.academy_cursos for select to authenticated
  using (
    status = 'publicado'
    and (
      visibilidade = 'todos'
      or (visibilidade = 'cultura' and exists (
            select 1 from agro.talhoes t
            where t.produtor_id = (select agro.jwt_produtor())
              and (agro.slug_cultura(t.cultura) = academy_cursos.cultura_chave
                   or agro.slug_cultura(t.cultura) like academy_cursos.cultura_chave || '-%')
          ))
      or exists (select 1 from agro.academy_curso_publicos p
                 where p.curso_id = academy_cursos.id and p.produtor_id = (select agro.jwt_produtor()))
      or exists (select 1 from agro.academy_indicacoes i
                 where i.curso_id = academy_cursos.id and i.produtor_id = (select agro.jwt_produtor()))
    )
  );
create policy curso_publicos_produtor on agro.academy_curso_publicos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
-- módulos e aulas: visíveis quando o CURSO é (a subconsulta passa pela RLS do curso, que já decide tudo)
create policy modulos_produtor on agro.academy_curso_modulos for select to authenticated
  using (exists (select 1 from agro.academy_cursos c where c.id = academy_curso_modulos.curso_id));
create policy aulas_produtor on agro.academy_curso_aulas for select to authenticated
  using (exists (select 1 from agro.academy_cursos c where c.id = academy_curso_aulas.curso_id));

-- matrícula: o produtor se matricula (em curso que ele vê) e lê as próprias
create policy matriculas_produtor_le on agro.academy_matriculas for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
create policy matriculas_produtor_cria on agro.academy_matriculas for insert to authenticated
  with check (
    produtor_id = (select agro.jwt_produtor())
    and exists (select 1 from agro.academy_cursos c where c.id = academy_matriculas.curso_id)
  );

-- progresso: só o próprio, e só de conteúdo que ele vê
create policy progresso_produtor_le on agro.academy_progresso for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
create policy progresso_produtor_cria on agro.academy_progresso for insert to authenticated
  with check (
    produtor_id = (select agro.jwt_produtor())
    and exists (select 1 from agro.academy_conteudos c where c.id = academy_progresso.conteudo_id)
  );
create policy progresso_produtor_atualiza on agro.academy_progresso for update to authenticated
  using (produtor_id = (select agro.jwt_produtor()))
  with check (produtor_id = (select agro.jwt_produtor()));

create policy certificados_produtor on agro.academy_certificados for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));

-- o conteúdo de uma aula é visível a quem vê o curso (mesmo que, avulso, fosse "só selecionados")
drop policy if exists conteudos_produtor on agro.academy_conteudos;
create policy conteudos_produtor on agro.academy_conteudos for select to authenticated
  using (
    status = 'publicado'
    and (
      visibilidade = 'todos'
      or (visibilidade = 'cultura' and exists (
            select 1 from agro.talhoes t
            where t.produtor_id = (select agro.jwt_produtor())
              and (agro.slug_cultura(t.cultura) = academy_conteudos.cultura_chave
                   or agro.slug_cultura(t.cultura) like academy_conteudos.cultura_chave || '-%')
          ))
      or exists (select 1 from agro.academy_publicos p
                 where p.conteudo_id = academy_conteudos.id and p.produtor_id = (select agro.jwt_produtor()))
      or exists (select 1 from agro.academy_indicacoes i
                 where i.conteudo_id = academy_conteudos.id and i.produtor_id = (select agro.jwt_produtor()))
      or exists (select 1 from agro.academy_curso_aulas a where a.conteudo_id = academy_conteudos.id)
    )
  );

-- arquivos: + capas de curso (a equipe lê tudo; o produtor lê a capa de um curso que ele vê)
drop policy if exists academy_leitura on storage.objects;
create policy academy_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'academy'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    agro.sou_consultor()
    or exists (select 1 from agro.academy_conteudos c where c.arquivo_path = storage.objects.name)
    or exists (select 1 from agro.academy_cursos k where k.capa_path = storage.objects.name)
  )
);

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- a conta do banco só roda por gatilho: ninguém a chama pela API
revoke execute on function agro.academy_sincronizar_curso(uuid, uuid) from authenticated, service_role;
