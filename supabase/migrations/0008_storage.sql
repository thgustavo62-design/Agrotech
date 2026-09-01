-- 0008 — buckets privados e políticas de Storage
-- Caminhos:
--   laudos/{org_id}/{produtor_id|_}/{uuid}.pdf
--   recomendacoes/{org_id}/{produtor_id}/{uuid}.pdf
--   visitas/{org_id}/{visita_id}/{uuid}.jpg

insert into storage.buckets (id, name, public)
values ('laudos', 'laudos', false),
       ('recomendacoes', 'recomendacoes', false),
       ('visitas', 'visitas', false)
on conflict (id) do nothing;

-- laudos --------------------------------------------------------------------
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
  and agro.sou_consultor()
);

-- recomendações -----------------------------------------------------------
create policy recomendacoes_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'recomendacoes'
  and (
    (storage.foldername(name))[1] = agro.meu_org_id()::text
    or (storage.foldername(name))[2] = agro.meu_produtor_id()::text
  )
);

create policy recomendacoes_envio on storage.objects
for insert to authenticated
with check (
  bucket_id = 'recomendacoes'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and agro.sou_consultor()
);

-- fotos de visita -------------------------------------------------------
create policy visitas_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'visitas'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
);

create policy visitas_envio on storage.objects
for insert to authenticated
with check (
  bucket_id = 'visitas'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and agro.sou_consultor()
);
