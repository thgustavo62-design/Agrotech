-- 0015 — permite ao consultor gravar na própria trilha de auditoria
-- (append-only: não há política de update nem delete). Ver PRODUTO-VENDAVEL §7.

create policy audit_log_insert on agro.audit_log
for insert to authenticated
with check (
  org_id = (select agro.jwt_org())
  and user_id = (select auth.uid())
);
