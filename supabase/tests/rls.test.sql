-- pgTAP — isolamento entre produtores e entre organizações.
-- Roda no CI com `supabase test db`. Caso obrigatório (doc §7.4):
-- produtor A tentando ler o talhão do produtor B deve retornar zero linhas.

begin;
select plan(7);

-- ---------------------------------------------------------------------------
-- massa de teste: 2 orgs, 1 consultor e 1 produtor em cada, 1 talhão cada
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'consultor.a@teste.dev'),
  ('22222222-2222-2222-2222-222222222222', 'produtor.a@teste.dev'),
  ('33333333-3333-3333-3333-333333333333', 'consultor.b@teste.dev'),
  ('44444444-4444-4444-4444-444444444444', 'produtor.b@teste.dev');

insert into agro.orgs (id, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Org A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Org B');

update agro.profiles set org_id = 'aaaaaaaa-0000-0000-0000-000000000000', role = 'consultor'
  where id = '11111111-1111-1111-1111-111111111111';
update agro.profiles set org_id = 'aaaaaaaa-0000-0000-0000-000000000000', role = 'produtor'
  where id = '22222222-2222-2222-2222-222222222222';
update agro.profiles set org_id = 'bbbbbbbb-0000-0000-0000-000000000000', role = 'consultor'
  where id = '33333333-3333-3333-3333-333333333333';
update agro.profiles set org_id = 'bbbbbbbb-0000-0000-0000-000000000000', role = 'produtor'
  where id = '44444444-4444-4444-4444-444444444444';

insert into agro.produtores (id, org_id, user_id, nome) values
  ('a0000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'Produtor A'),
  ('b0000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'Produtor B');

insert into agro.propriedades (id, produtor_id, nome) values
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Prop A'),
  ('b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Prop B');

insert into agro.talhoes (id, propriedade_id, nome, cultura) values
  ('a2000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 'Talhão A', 'cafe-conilon'),
  ('b2000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000000', 'Talhão B', 'cafe-conilon');

-- helper para "logar" como um usuário
create or replace function tests.autenticar(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- ---------------------------------------------------------------------------
-- produtor A
-- ---------------------------------------------------------------------------
select tests.autenticar('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from agro.talhoes where id = 'a2000000-0000-0000-0000-000000000000'),
  1, 'produtor A enxerga o próprio talhão');

select is(
  (select count(*)::int from agro.talhoes where id = 'b2000000-0000-0000-0000-000000000000'),
  0, 'produtor A NÃO enxerga o talhão do produtor B');

select is(
  (select count(*)::int from agro.produtores where id = 'b0000000-0000-0000-0000-000000000000'),
  0, 'produtor A NÃO enxerga o cadastro do produtor B');

select throws_ok(
  $$ insert into agro.talhoes (propriedade_id, nome, cultura)
     values ('a1000000-0000-0000-0000-000000000000', 'hack', 'milho') $$,
  '42501', null, 'produtor A não pode inserir talhão (somente leitura)');

-- ---------------------------------------------------------------------------
-- consultor A
-- ---------------------------------------------------------------------------
select tests.autenticar('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from agro.talhoes where id = 'a2000000-0000-0000-0000-000000000000'),
  1, 'consultor A enxerga o talhão da carteira dele');

select is(
  (select count(*)::int from agro.talhoes where id = 'b2000000-0000-0000-0000-000000000000'),
  0, 'consultor A NÃO enxerga a carteira da Org B');

-- ---------------------------------------------------------------------------
-- consultor B
-- ---------------------------------------------------------------------------
select tests.autenticar('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from agro.produtores),
  1, 'consultor B enxerga apenas os produtores da própria organização');

select * from finish();
rollback;
