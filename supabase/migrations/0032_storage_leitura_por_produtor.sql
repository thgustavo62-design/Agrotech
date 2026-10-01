-- 0032 — Storage: produtor só lê os arquivos dele
--
-- As políticas de leitura de 0008 liberavam a pasta inteira da organização
-- para qualquer usuário do escritório, inclusive produtor: (foldername)[1] =
-- meu_org_id(). Um produtor conseguia listar e baixar laudos, PDFs de
-- recomendação e fotos de visita de outro produtor do mesmo escritório. Achado
-- ao aplicar as migrations num Postgres e testar com dois produtores na mesma
-- org (ver packages/db-test/test/storage.test.ts).
--
-- Agora: consultor/admin lê a org inteira; produtor lê só a pasta com o id dele
-- (laudos e recomendacoes: {org}/{produtor}/...) ou as fotos das visitas dos
-- talhões dele (visitas: {org}/{visita}/..., resolvido via visita_fotos).

drop policy if exists laudos_leitura on storage.objects;
create policy laudos_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'laudos'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    agro.sou_consultor()
    or (storage.foldername(name))[2] = agro.meu_produtor_id()::text
  )
);

drop policy if exists recomendacoes_leitura on storage.objects;
create policy recomendacoes_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'recomendacoes'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    agro.sou_consultor()
    or (storage.foldername(name))[2] = agro.meu_produtor_id()::text
  )
);

drop policy if exists visitas_leitura on storage.objects;
create policy visitas_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'visitas'
  and (storage.foldername(name))[1] = agro.meu_org_id()::text
  and (
    agro.sou_consultor()
    or exists (
      select 1
      from agro.visita_fotos f
      join agro.visitas v on v.id = f.visita_id
      where f.storage_path = storage.objects.name
        and v.produtor_id = agro.meu_produtor_id()
    )
  )
);
