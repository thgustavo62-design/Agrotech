-- 0042 — reenvio de visita sem duplicar NEM perder partes (AG-007)
--
-- 0031 deu uma chave à visita inteira. Mas visita, ocorrências e fotos são gravadas em passos separados: se um deles
-- falhava depois da visita gravada, o reenvio batia na chave da visita ("já gravado") e as ocorrências e fotos que
-- faltavam eram descartadas em silêncio. Agora cada ocorrência e cada foto tem a PRÓPRIA identidade dentro da visita
-- (posição no formulário / chave derivada da chave da visita), então o reenvio completa só o que falta.
--
-- unique (...) comuns, não parciais: o INSERT ... ON CONFLICT do PostgREST precisa de uma restrição inferível, e
-- linhas antigas (campo nulo) não se conflitam porque NULL é distinto de NULL. Nenhuma função nova.

alter table agro.visita_ocorrencias add column if not exists indice smallint;
alter table agro.visita_ocorrencias drop constraint if exists visita_ocorrencias_visita_indice_uk;
alter table agro.visita_ocorrencias add constraint visita_ocorrencias_visita_indice_uk unique (visita_id, indice);

alter table agro.visita_fotos add column if not exists chave text;
alter table agro.visita_fotos drop constraint if exists visita_fotos_visita_chave_uk;
alter table agro.visita_fotos add constraint visita_fotos_visita_chave_uk unique (visita_id, chave);
