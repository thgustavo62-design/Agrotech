-- 0031 — idempotência do registro de visita (fila offline)
-- O app guarda a visita no aparelho quando não há sinal e reenvia depois. Se o
-- servidor gravar e a resposta se perder, o reenvio não pode duplicar a visita:
-- o cliente manda um uuid próprio (gerado ao enfileirar) e o índice único faz o
-- segundo insert falhar com 23505, que a server action trata como "já gravado".

alter table agro.visitas add column if not exists chave_cliente uuid;

create unique index if not exists visitas_chave_cliente_uk
  on agro.visitas (chave_cliente)
  where chave_cliente is not null;
