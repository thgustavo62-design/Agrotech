-- 0021 — produtor lê os próprios documentos (laudos)
-- Achado construindo a Fase 5 (dashboard/portal do produtor, item "Documentos"
-- do menu, UX_ARCHITECTURE.md §1.2): agro.documentos tem produtor_id
-- desnormalizado desde 0012, mas nunca ganhou política de leitura pro
-- produtor — só documentos_consultor (0012). O GRANT de tabela já cobre
-- (0017 é blanket pra authenticated); faltava só a RLS. O Storage já estava
-- certo (laudos_leitura, 0008, já libera pelo segundo segmento do path =
-- produtor_id).

create policy documentos_produtor on agro.documentos for select to authenticated
  using (produtor_id = (select agro.jwt_produtor()));
