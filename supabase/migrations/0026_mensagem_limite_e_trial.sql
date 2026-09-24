-- 0026 — mensagem melhor no bloqueio de limite/trial + destrava trials vencidos
-- Achado numa auditoria pedida pelo Gustavo (2026-09-24): "erros nas
-- criações dos produtores". Causa real, dupla:
--   1. O app não tinha nenhum error.tsx — qualquer Error lançado numa
--      server action (validação, RLS, trigger) virava a tela de erro
--      genérica do Next em vez de mostrar a mensagem (corrigido no app,
--      commit separado).
--   2. checar_limite() (0013) bloqueia insert em produtores/talhoes/
--      documentos quando trial_expira_em já passou — mas nada muda a
--      coluna status sozinho (sem cron), e a mensagem dizia "regularize o
--      pagamento", que nem faz sentido pra um teste vencido (não tem
--      cobrança pendente nenhuma). Como essa sessão já passa de 14 dias
--      desde o onboarding, é a causa mais provável do erro relatado.

create or replace function agro.checar_limite() returns trigger
language plpgsql
security definer
set search_path = agro, public
as $$
declare
  v_org   uuid;
  v_ass   agro.assinaturas;
  v_plano agro.planos;
  v_qtd   int;
begin
  if tg_table_name = 'produtores' then
    v_org := new.org_id;
  elsif tg_table_name = 'talhoes' then
    select org_id into v_org from agro.propriedades where id = new.propriedade_id;
  elsif tg_table_name = 'documentos' then
    v_org := new.org_id;
  end if;

  if v_org is null then
    return new;
  end if;

  select * into v_ass from agro.assinaturas where org_id = v_org;
  if not found then
    return new;
  end if;

  if v_ass.status = 'trial' and v_ass.trial_expira_em is not null and v_ass.trial_expira_em < now() then
    raise exception 'Seu período de teste venceu em %. Faça upgrade em Assinatura para continuar cadastrando — os dados existentes continuam acessíveis.', to_char(v_ass.trial_expira_em, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  elsif v_ass.status in ('cancelada', 'suspensa') then
    raise exception 'Assinatura % — regularize o pagamento para cadastrar novos registros. Os dados existentes continuam acessíveis.', v_ass.status
      using errcode = 'check_violation';
  end if;

  select * into v_plano from agro.planos where id = v_ass.plano;

  if tg_table_name = 'produtores' then
    select count(*) into v_qtd from agro.produtores where org_id = v_org;
    if v_qtd >= v_plano.lim_produtores then
      raise exception 'Limite do plano % atingido: % produtores. Faça upgrade em Assinatura.', v_plano.nome, v_plano.lim_produtores
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'talhoes' then
    select count(*) into v_qtd from agro.talhoes where org_id = v_org;
    if v_qtd >= v_plano.lim_talhoes then
      raise exception 'Limite do plano % atingido: % talhões. Faça upgrade em Assinatura.', v_plano.nome, v_plano.lim_talhoes
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'documentos' then
    select count(*) into v_qtd from agro.documentos
     where org_id = v_org and criado_em >= date_trunc('month', now());
    if v_qtd >= v_plano.lim_laudos_mes then
      raise exception 'Limite do plano % atingido: % laudos neste mês. Faça upgrade em Assinatura.', v_plano.nome, v_plano.lim_laudos_mes
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Destrava agora: qualquer org em trial já vencido ganha mais 30 dias.
-- Ação operacional pontual (não é algo que deva repetir sozinho a cada
-- deploy — um cron de verdade pra isso fica fora de escopo por ora,
-- porque nem o checkout do Asaas foi validado ainda; suspender quem não
-- tem como pagar seria pior que não suspender).
update agro.assinaturas
   set trial_expira_em = now() + interval '30 days'
 where status = 'trial'
   and trial_expira_em is not null
   and trial_expira_em < now();
