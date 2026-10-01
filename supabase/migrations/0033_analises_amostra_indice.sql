-- 0033 — laudo com várias amostras (tabela por colunas)
-- Um PDF de laboratório traz N amostras. Cada uma vira uma análise própria, ligada ao
-- mesmo documento. `amostra_indice` (1..N, a coluna do laudo) diz qual; o índice único
-- impede confirmar a mesma amostra duas vezes. Laudo de uma amostra só deixa NULL.

alter table agro.analises add column if not exists amostra_indice int;

create unique index if not exists analises_documento_amostra_uk
  on agro.analises (documento_id, amostra_indice)
  where documento_id is not null and amostra_indice is not null;
