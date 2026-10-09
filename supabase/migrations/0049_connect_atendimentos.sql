-- 0049 — Connect, fatia 1: pedidos do produtor, fila de atendimento, conversa, fotos e histórico
--
-- O produtor abre um PEDIDO (assunto, categoria, urgência, propriedade/talhão, fotos); o escritório atende por uma fila com
-- responsável, prazo e status; conversam no próprio pedido. A equipe também escreve NOTAS INTERNAS que o produtor nunca vê.
--
-- Regras que ficam no banco (o app só mostra):
--   - o produtor só vê e cria pedido dele; nunca mexe em status, responsável, prazo nem prioridade "alta";
--   - nota interna e foto de nota interna: só a equipe (o produtor não lê, mesmo chamando a API direto);
--   - o responsável tem de ser da equipe ativa do mesmo escritório;
--   - o status anda sozinho com a conversa (produtor responde → "em acompanhamento"; técnico responde → idem) e cada
--     mudança vira linha no histórico, com aviso a quem precisa (técnico novo/atribuído, produtor quando falta algo ou resolve);
--   - avaliar o atendimento é uma vez, só pelo produtor, só depois de resolvido;
--   - limite de pedidos abertos por produtor (evita enxurrada).
-- Permissão nova (espelho em apps/web/lib/permissoes.ts): atendimento.gerir → Agronômico e Campo (e Proprietário).

-- ===========================================================================
-- 1. permissão
-- ===========================================================================
create or replace function agro.pode(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = agro, public
as $$
  select coalesce((
    select 'proprietario' = any(pr.perfis)
           or case p_permissao
                when 'carteira.editar'     then pr.perfis && array['agronomico', 'campo']
                when 'recomendacao.emitir' then pr.perfis && array['agronomico']
                when 'tabelas.editar'      then pr.perfis && array['agronomico']
                when 'dados.exportar'      then pr.perfis && array['agronomico']
                when 'relatorios.ver'      then pr.perfis && array['agronomico', 'financeiro', 'leitura']
                when 'financeiro'          then pr.perfis && array['financeiro']
                when 'academy.gerenciar'   then pr.perfis && array['agronomico']
                when 'academy.indicar'     then pr.perfis && array['agronomico', 'campo']
                when 'atendimento.gerir'   then pr.perfis && array['agronomico', 'campo']
                else false
              end
    from agro.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('consultor', 'admin')
      and pr.org_id is not null
      and pr.desativado_em is null
      and (not pr.mfa_ativo or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  ), false)
$$;

-- ===========================================================================
-- 2. tabelas
-- ===========================================================================
create table agro.atendimentos (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references agro.orgs(id) on delete cascade,
  produtor_id           uuid not null references agro.produtores(id) on delete cascade,
  propriedade_id        uuid references agro.propriedades(id) on delete set null,
  talhao_id             uuid references agro.talhoes(id) on delete set null,
  responsavel_id        uuid references auth.users(id) on delete set null,
  criado_por            uuid references auth.users(id) on delete set null,
  assunto               text not null check (char_length(btrim(assunto)) between 3 and 160),
  descricao             text check (char_length(descricao) <= 4000),
  categoria             text not null default 'duvida' check (categoria in ('duvida', 'problema_lavoura', 'pedido_visita', 'documento', 'outro')),
  prioridade            text not null default 'normal' check (prioridade in ('normal', 'alta', 'urgente')),
  status                text not null default 'novo' check (status in ('novo', 'em_triagem', 'aguardando_produtor', 'em_acompanhamento', 'resolvido', 'arquivado')),
  origem                text not null default 'portal' check (origem in ('portal', 'equipe', 'atlas')),
  vencimento            date,
  resolvido_em          timestamptz,
  avaliacao             int check (avaliacao between 1 and 5),
  avaliacao_comentario  text check (char_length(avaliacao_comentario) <= 600),
  avaliado_em           timestamptz,
  ultima_interacao_em   timestamptz not null default now(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
create index atendimentos_org_status_idx on agro.atendimentos(org_id, status);
create index atendimentos_produtor_idx on agro.atendimentos(produtor_id, status);
create index atendimentos_responsavel_idx on agro.atendimentos(responsavel_id);
create index atendimentos_propriedade_idx on agro.atendimentos(propriedade_id);
create index atendimentos_talhao_idx on agro.atendimentos(talhao_id);
create index atendimentos_criado_por_idx on agro.atendimentos(criado_por);
create index atendimentos_vencimento_idx on agro.atendimentos(org_id, vencimento) where vencimento is not null;
create trigger atendimentos_touch before update on agro.atendimentos
  for each row execute function agro.touch_atualizado_em();

create table agro.atendimento_mensagens (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references agro.orgs(id) on delete cascade,
  atendimento_id uuid not null references agro.atendimentos(id) on delete cascade,
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  autor_id       uuid references auth.users(id) on delete set null,
  autor_tipo     text not null check (autor_tipo in ('produtor', 'equipe')),
  corpo          text not null check (char_length(btrim(corpo)) between 1 and 4000),
  interna        boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index atendimento_mensagens_atendimento_idx on agro.atendimento_mensagens(atendimento_id, criado_em);
create index atendimento_mensagens_org_idx on agro.atendimento_mensagens(org_id);
create index atendimento_mensagens_produtor_idx on agro.atendimento_mensagens(produtor_id);
create index atendimento_mensagens_autor_idx on agro.atendimento_mensagens(autor_id);

create table agro.atendimento_arquivos (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references agro.orgs(id) on delete cascade,
  atendimento_id uuid not null references agro.atendimentos(id) on delete cascade,
  mensagem_id    uuid references agro.atendimento_mensagens(id) on delete cascade,
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  autor_id       uuid references auth.users(id) on delete set null,
  storage_path   text not null check (char_length(storage_path) <= 400),
  nome           text not null check (char_length(nome) between 1 and 200),
  mime           text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  bytes          int check (bytes between 1 and 10485760),
  interna        boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index atendimento_arquivos_atendimento_idx on agro.atendimento_arquivos(atendimento_id);
create index atendimento_arquivos_mensagem_idx on agro.atendimento_arquivos(mensagem_id);
create index atendimento_arquivos_org_idx on agro.atendimento_arquivos(org_id);
create index atendimento_arquivos_produtor_idx on agro.atendimento_arquivos(produtor_id);
create index atendimento_arquivos_autor_idx on agro.atendimento_arquivos(autor_id);
create unique index atendimento_arquivos_caminho_uk on agro.atendimento_arquivos(storage_path);

create table agro.atendimento_eventos (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references agro.orgs(id) on delete cascade,
  atendimento_id uuid not null references agro.atendimentos(id) on delete cascade,
  produtor_id    uuid not null references agro.produtores(id) on delete cascade,
  tipo           text not null check (tipo in ('criado', 'status', 'responsavel', 'prazo', 'prioridade', 'mensagem')),
  de             text,
  para           text,
  autor_id       uuid references auth.users(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index atendimento_eventos_atendimento_idx on agro.atendimento_eventos(atendimento_id, criado_em);
create index atendimento_eventos_org_idx on agro.atendimento_eventos(org_id);
create index atendimento_eventos_produtor_idx on agro.atendimento_eventos(produtor_id);
create index atendimento_eventos_autor_idx on agro.atendimento_eventos(autor_id);

-- notificações: tipos novos (equipe e produtor)
alter table agro.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table agro.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'nova_recomendacao', 'nova_analise', 'visita_agendada', 'visita_realizada', 'documento_disponivel',
  'atividade_vencendo', 'conta_vencendo', 'conteudo_indicado',
  'atendimento_novo', 'atendimento_atribuido', 'atendimento_resposta', 'atendimento_status'
));

-- ===========================================================================
-- 3. ajudantes (só rodam por gatilho/RLS: ninguém os chama pela API)
-- ===========================================================================
-- "essa pessoa é da equipe ativa deste escritório?" — security definer: quem escreve o pedido pode não ler a lista da equipe
create or replace function agro.eh_equipe_ativa(p_user uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = agro, public as $$
  select exists (
    select 1 from agro.profiles p
    where p.id = p_user and p.org_id = p_org and p.role in ('consultor', 'admin') and p.desativado_em is null
  )
$$;

-- avisa a equipe: o responsável, se há; senão proprietário e agronômico ativos
create or replace function agro.atendimento_avisar_equipe(p_org uuid, p_responsavel uuid, p_tipo text, p_titulo text, p_corpo text, p_link text) returns void
language plpgsql security definer set search_path = agro, public as $$
begin
  if p_responsavel is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, corpo, link) values (p_org, p_responsavel, p_tipo, p_titulo, p_corpo, p_link);
  else
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, corpo, link)
    select p_org, p.id, p_tipo, p_titulo, p_corpo, p_link
    from agro.profiles p
    where p.org_id = p_org and p.role in ('consultor', 'admin') and p.desativado_em is null
      and p.perfis && array['proprietario', 'agronomico'];
  end if;
end $$;

create or replace function agro.atendimento_avisar_produtor(p_produtor uuid, p_org uuid, p_tipo text, p_titulo text, p_corpo text, p_link text) returns void
language plpgsql security definer set search_path = agro, public as $$
declare
  v_user uuid;
begin
  select user_id into v_user from agro.produtores where id = p_produtor;
  if v_user is not null then
    insert into agro.notificacoes (org_id, destinatario_user_id, tipo, titulo, corpo, link) values (p_org, v_user, p_tipo, p_titulo, p_corpo, p_link);
  end if;
end $$;

-- ===========================================================================
-- 4. pedido: regras antes de gravar
-- ===========================================================================
create or replace function agro.atendimentos_antes() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
  v_role    text;
  v_abertos int;
begin
  if tg_op = 'INSERT' then
    select p.org_id into new.org_id from agro.produtores p where p.id = new.produtor_id;
    if new.org_id is null then raise exception 'Produtor não encontrado.' using errcode = '22023'; end if;
    if new.propriedade_id is not null and not exists (select 1 from agro.propriedades x where x.id = new.propriedade_id and x.produtor_id = new.produtor_id) then
      raise exception 'A propriedade não é deste produtor.' using errcode = '22023';
    end if;
    if new.talhao_id is not null and not exists (select 1 from agro.talhoes x where x.id = new.talhao_id and x.produtor_id = new.produtor_id) then
      raise exception 'O talhão não é deste produtor.' using errcode = '22023';
    end if;
    if v_cliente then
      new.criado_por := auth.uid();
      select p.role into v_role from agro.profiles p where p.id = auth.uid();
      if v_role = 'produtor' then
        -- o produtor pede; quem decide fila, responsável e prazo é a equipe
        new.status := 'novo';
        new.responsavel_id := null;
        new.vencimento := null;
        new.origem := case when new.origem = 'atlas' then 'atlas' else 'portal' end;
        if new.prioridade not in ('normal', 'urgente') then new.prioridade := 'normal'; end if;
        select count(*) into v_abertos from agro.atendimentos a where a.produtor_id = new.produtor_id and a.status not in ('resolvido', 'arquivado');
        if v_abertos >= 10 then
          raise exception 'Você já tem 10 pedidos em aberto. Aguarde o atendimento ou resolva algum antes de abrir outro.' using errcode = '22023';
        end if;
      else
        new.origem := 'equipe';
      end if;
      new.avaliacao := null; new.avaliacao_comentario := null; new.avaliado_em := null; new.resolvido_em := null;
    end if;
    if new.status = 'resolvido' and new.resolvido_em is null then new.resolvido_em := now(); end if;
    new.ultima_interacao_em := now();
  else
    if v_cliente then
      if (new.org_id, new.produtor_id, new.criado_por, new.origem, new.criado_em) is distinct from (old.org_id, old.produtor_id, old.criado_por, old.origem, old.criado_em) then
        raise exception 'Estes dados do pedido não podem ser alterados.' using errcode = '42501';
      end if;
      -- avaliação e interação só pelo banco
      new.avaliacao := old.avaliacao; new.avaliacao_comentario := old.avaliacao_comentario; new.avaliado_em := old.avaliado_em;
      new.ultima_interacao_em := old.ultima_interacao_em;
    end if;
    if new.propriedade_id is distinct from old.propriedade_id and new.propriedade_id is not null
       and not exists (select 1 from agro.propriedades x where x.id = new.propriedade_id and x.produtor_id = new.produtor_id) then
      raise exception 'A propriedade não é deste produtor.' using errcode = '22023';
    end if;
    if new.talhao_id is distinct from old.talhao_id and new.talhao_id is not null
       and not exists (select 1 from agro.talhoes x where x.id = new.talhao_id and x.produtor_id = new.produtor_id) then
      raise exception 'O talhão não é deste produtor.' using errcode = '22023';
    end if;
    if new.status = 'resolvido' and old.status <> 'resolvido' then new.resolvido_em := now();
    elsif new.status <> 'resolvido' and old.status = 'resolvido' then new.resolvido_em := null;
    else new.resolvido_em := old.resolvido_em;
    end if;
  end if;

  if new.responsavel_id is not null and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and not agro.eh_equipe_ativa(new.responsavel_id, new.org_id) then
    raise exception 'O responsável precisa ser da equipe ativa do escritório.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger atendimentos_antes before insert or update on agro.atendimentos
  for each row execute function agro.atendimentos_antes();

-- histórico e avisos (roda como dono: o produtor não escreve em eventos nem em notificações de ninguém)
create or replace function agro.atendimentos_depois() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_nome text;
  v_quem uuid := auth.uid();
  v_rotulo text;
begin
  select nome into v_nome from agro.produtores where id = new.produtor_id;

  if tg_op = 'INSERT' then
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, para, autor_id) values (new.org_id, new.id, new.produtor_id, 'criado', new.status, v_quem);
    if new.origem <> 'equipe' then
      perform agro.atendimento_avisar_equipe(new.org_id, new.responsavel_id, 'atendimento_novo',
        'Novo pedido de ' || coalesce(v_nome, 'produtor') || ': ' || new.assunto, null, '/connect/atendimentos/' || new.id);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, de, para, autor_id) values (new.org_id, new.id, new.produtor_id, 'status', old.status, new.status, v_quem);
    if new.status = 'aguardando_produtor' then
      perform agro.atendimento_avisar_produtor(new.produtor_id, new.org_id, 'atendimento_status', 'O técnico precisa de uma informação sua: ' || new.assunto, null, '/connect/pedidos/' || new.id);
    elsif new.status = 'resolvido' then
      perform agro.atendimento_avisar_produtor(new.produtor_id, new.org_id, 'atendimento_status', 'Seu pedido foi resolvido: ' || new.assunto, 'Conte como foi o atendimento.', '/connect/pedidos/' || new.id);
    end if;
  end if;
  if new.responsavel_id is distinct from old.responsavel_id then
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, de, para, autor_id) values (new.org_id, new.id, new.produtor_id, 'responsavel', old.responsavel_id::text, new.responsavel_id::text, v_quem);
    if new.responsavel_id is not null and new.responsavel_id is distinct from v_quem then
      perform agro.atendimento_avisar_equipe(new.org_id, new.responsavel_id, 'atendimento_atribuido', 'Pedido atribuído a você: ' || new.assunto, 'Produtor: ' || coalesce(v_nome, '—'), '/connect/atendimentos/' || new.id);
    end if;
  end if;
  if new.vencimento is distinct from old.vencimento then
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, de, para, autor_id) values (new.org_id, new.id, new.produtor_id, 'prazo', old.vencimento::text, new.vencimento::text, v_quem);
  end if;
  if new.prioridade is distinct from old.prioridade then
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, de, para, autor_id) values (new.org_id, new.id, new.produtor_id, 'prioridade', old.prioridade, new.prioridade, v_quem);
  end if;
  v_rotulo := null;
  return null;
end $$;
create trigger atendimentos_depois after insert or update on agro.atendimentos
  for each row execute function agro.atendimentos_depois();

-- ===========================================================================
-- 5. conversa
-- ===========================================================================
create or replace function agro.atendimento_mensagens_antes() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
  v_at      agro.atendimentos%rowtype;
  v_role    text;
begin
  select * into v_at from agro.atendimentos a where a.id = new.atendimento_id;
  if not found then raise exception 'Pedido não encontrado.' using errcode = '22023'; end if;
  new.org_id := v_at.org_id;
  new.produtor_id := v_at.produtor_id;
  if v_cliente then
    new.autor_id := auth.uid();
    select p.role into v_role from agro.profiles p where p.id = auth.uid();
    new.autor_tipo := case when v_role = 'produtor' then 'produtor' else 'equipe' end;
    if new.autor_tipo = 'produtor' then new.interna := false; end if; -- nota interna é só da equipe
    new.criado_em := now();
  end if;
  if v_at.status = 'arquivado' then raise exception 'Este pedido foi arquivado: abra um novo.' using errcode = '22023'; end if;
  return new;
end $$;
create trigger atendimento_mensagens_antes before insert on agro.atendimento_mensagens
  for each row execute function agro.atendimento_mensagens_antes();

-- a conversa mexe no status e avisa a outra ponta (como dono: o produtor não pode alterar o pedido)
create or replace function agro.atendimento_mensagens_depois() returns trigger
language plpgsql security definer set search_path = agro, public as $$
declare
  v_at   agro.atendimentos%rowtype;
  v_nome text;
begin
  select * into v_at from agro.atendimentos where id = new.atendimento_id;
  select nome into v_nome from agro.produtores where id = new.produtor_id;
  update agro.atendimentos set ultima_interacao_em = now() where id = new.atendimento_id;

  if new.autor_tipo = 'produtor' then
    if v_at.status in ('aguardando_produtor', 'resolvido') then
      update agro.atendimentos set status = 'em_acompanhamento' where id = new.atendimento_id;
    end if;
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, autor_id) values (new.org_id, new.atendimento_id, new.produtor_id, 'mensagem', new.autor_id);
    perform agro.atendimento_avisar_equipe(new.org_id, v_at.responsavel_id, 'atendimento_resposta',
      coalesce(v_nome, 'O produtor') || ' respondeu: ' || v_at.assunto, left(new.corpo, 140), '/connect/atendimentos/' || new.atendimento_id);
  elsif not new.interna then
    if v_at.status in ('novo', 'em_triagem') then
      update agro.atendimentos set status = 'em_acompanhamento' where id = new.atendimento_id;
    end if;
    insert into agro.atendimento_eventos (org_id, atendimento_id, produtor_id, tipo, autor_id) values (new.org_id, new.atendimento_id, new.produtor_id, 'mensagem', new.autor_id);
    perform agro.atendimento_avisar_produtor(new.produtor_id, new.org_id, 'atendimento_resposta',
      'O técnico respondeu: ' || v_at.assunto, left(new.corpo, 140), '/connect/pedidos/' || new.atendimento_id);
  end if;
  return null;
end $$;
create trigger atendimento_mensagens_depois after insert on agro.atendimento_mensagens
  for each row execute function agro.atendimento_mensagens_depois();

-- arquivo: herda o pedido, a nota interna e confere o caminho
create or replace function agro.atendimento_arquivos_antes() returns trigger
language plpgsql set search_path = agro, public as $$
declare
  v_cliente boolean := current_user in ('authenticated', 'anon');
  v_at      agro.atendimentos%rowtype;
  v_interna boolean := false;
  v_n       int;
begin
  select * into v_at from agro.atendimentos a where a.id = new.atendimento_id;
  if not found then raise exception 'Pedido não encontrado.' using errcode = '22023'; end if;
  new.org_id := v_at.org_id;
  new.produtor_id := v_at.produtor_id;
  if new.storage_path not like new.org_id::text || '/' || new.atendimento_id::text || '/%' then
    raise exception 'O arquivo precisa estar na pasta deste pedido.' using errcode = '22023';
  end if;
  if new.mensagem_id is not null then
    select m.interna into v_interna from agro.atendimento_mensagens m where m.id = new.mensagem_id and m.atendimento_id = new.atendimento_id;
    if not found then raise exception 'Mensagem não encontrada neste pedido.' using errcode = '22023'; end if;
  end if;
  new.interna := coalesce(v_interna, false);
  if v_cliente then new.autor_id := auth.uid(); new.criado_em := now(); end if;
  select count(*) into v_n from agro.atendimento_arquivos x where x.atendimento_id = new.atendimento_id;
  if v_n >= 30 then raise exception 'Este pedido já tem arquivos demais (limite de 30).' using errcode = '22023'; end if;
  return new;
end $$;
create trigger atendimento_arquivos_antes before insert on agro.atendimento_arquivos
  for each row execute function agro.atendimento_arquivos_antes();

-- avaliar o atendimento: uma vez, só o produtor do pedido, só depois de resolvido
create or replace function agro.avaliar_atendimento(p_id uuid, p_nota int, p_comentario text default null) returns void
language plpgsql security definer set search_path = agro, public as $$
declare
  v_at agro.atendimentos%rowtype;
begin
  if auth.uid() is null then raise exception 'Entre para avaliar.' using errcode = '42501'; end if;
  select a.* into v_at from agro.atendimentos a join agro.produtores p on p.id = a.produtor_id where a.id = p_id and p.user_id = auth.uid();
  if not found then raise exception 'Pedido não encontrado.' using errcode = '42501'; end if;
  if v_at.status <> 'resolvido' then raise exception 'Só dá para avaliar depois que o pedido for resolvido.' using errcode = '22023'; end if;
  if v_at.avaliado_em is not null then raise exception 'Este atendimento já foi avaliado.' using errcode = '22023'; end if;
  if p_nota is null or p_nota < 1 or p_nota > 5 then raise exception 'A nota vai de 1 a 5.' using errcode = '22023'; end if;
  if char_length(coalesce(p_comentario, '')) > 600 then raise exception 'O comentário passa de 600 letras.' using errcode = '22023'; end if;
  update agro.atendimentos set avaliacao = p_nota, avaliacao_comentario = nullif(btrim(p_comentario), ''), avaliado_em = now() where id = p_id;
end $$;

-- ===========================================================================
-- 6. RLS
-- ===========================================================================
alter table agro.atendimentos enable row level security;
alter table agro.atendimento_mensagens enable row level security;
alter table agro.atendimento_arquivos enable row level security;
alter table agro.atendimento_eventos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['atendimentos', 'atendimento_mensagens', 'atendimento_arquivos', 'atendimento_eventos'] loop
    execute format('create policy tenant_guard on agro.%I as restrictive for all to authenticated using (org_id = (select agro.jwt_org())) with check (org_id = (select agro.jwt_org()))', t);
    -- equipe lê tudo do escritório
    execute format('create policy %I on agro.%I for select to authenticated using ((select agro.jwt_role()) in (''consultor'', ''admin''))', t || '_equipe_le', t);
  end loop;
  -- equipe escreve (pedido, conversa, arquivo) só com atendimento.gerir; eventos nunca pelo cliente
  foreach t in array array['atendimentos', 'atendimento_mensagens', 'atendimento_arquivos'] loop
    execute format('create policy %I on agro.%I for insert to authenticated with check ((select agro.jwt_role()) in (''consultor'', ''admin'') and (select agro.pode(''atendimento.gerir'')))', t || '_equipe_cria', t);
  end loop;
  foreach t in array array['atendimentos', 'atendimento_arquivos'] loop
    execute format('create policy %I on agro.%I for update to authenticated using ((select agro.jwt_role()) in (''consultor'', ''admin'') and (select agro.pode(''atendimento.gerir''))) with check ((select agro.jwt_role()) in (''consultor'', ''admin'') and (select agro.pode(''atendimento.gerir'')))', t || '_equipe_muda', t);
    execute format('create policy %I on agro.%I for delete to authenticated using ((select agro.jwt_role()) in (''consultor'', ''admin'') and (select agro.pode(''atendimento.gerir'')))', t || '_equipe_apaga', t);
  end loop;
end $$;

-- produtor: só o que é dele; nota interna e arquivo de nota interna nunca
create policy atendimentos_produtor_le on agro.atendimentos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
create policy atendimentos_produtor_cria on agro.atendimentos for insert to authenticated
  with check (produtor_id = (select agro.jwt_produtor()) and (select agro.jwt_role()) = 'produtor');
create policy mensagens_produtor_le on agro.atendimento_mensagens for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()) and not interna);
create policy mensagens_produtor_cria on agro.atendimento_mensagens for insert to authenticated
  with check (produtor_id = (select agro.jwt_produtor()) and (select agro.jwt_role()) = 'produtor' and not interna);
create policy arquivos_produtor_le on agro.atendimento_arquivos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()) and not interna);
create policy arquivos_produtor_cria on agro.atendimento_arquivos for insert to authenticated
  with check (produtor_id = (select agro.jwt_produtor()) and (select agro.jwt_role()) = 'produtor' and not interna);
create policy eventos_produtor_le on agro.atendimento_eventos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()) and tipo in ('criado', 'status', 'mensagem', 'prazo'));

-- ===========================================================================
-- 7. arquivos (bucket privado "atendimentos": {org}/{pedido}/{arquivo})
-- ===========================================================================
insert into storage.buckets (id, name, public) values ('atendimentos', 'atendimentos', false)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets
               set file_size_limit = 10485760,
                   allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
               where id = 'atendimentos'$q$;
  end if;
end $$;

-- lê: a equipe a pasta do escritório; o produtor só o arquivo que a RLS dele deixa ver (nunca de nota interna)
create policy atendimentos_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'atendimentos'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    agro.sou_consultor()
    or exists (select 1 from agro.atendimento_arquivos a where a.storage_path = storage.objects.name)
  )
);
-- envia: o produtor só na pasta de um pedido DELE; a equipe com atendimento.gerir, na pasta do escritório
create policy atendimentos_envio on storage.objects for insert to authenticated
with check (
  bucket_id = 'atendimentos'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    (agro.sou_consultor() and (select agro.pode('atendimento.gerir')))
    or exists (select 1 from agro.atendimentos x where x.id::text = (storage.foldername(name))[2] and x.produtor_id = agro.meu_produtor_id())
  )
);
create policy atendimentos_troca on storage.objects for update to authenticated
using (bucket_id = 'atendimentos' and (storage.foldername(name))[1] = agro.meu_org_id()::text and agro.sou_consultor() and (select agro.pode('atendimento.gerir')));
create policy atendimentos_remocao on storage.objects for delete to authenticated
using (bucket_id = 'atendimentos' and (storage.foldername(name))[1] = agro.meu_org_id()::text and agro.sou_consultor() and (select agro.pode('atendimento.gerir')));

-- funções novas nascem executáveis por PUBLIC: mesma varredura de 0037/0044
revoke execute on all functions in schema agro from public, anon;
grant execute on function agro.convite_resumo(uuid) to anon, authenticated;
grant execute on function agro.convite_equipe_resumo(uuid) to anon, authenticated;
grant execute on function agro.resultados_por_token(uuid) to anon, authenticated;
grant execute on all functions in schema agro to authenticated, service_role;
revoke execute on function agro.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function agro.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- ajudantes internos: só por gatilho
revoke execute on function agro.academy_sincronizar_curso(uuid, uuid) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_equipe(uuid, uuid, text, text, text, text) from authenticated, service_role;
revoke execute on function agro.atendimento_avisar_produtor(uuid, uuid, text, text, text, text) from authenticated, service_role;
