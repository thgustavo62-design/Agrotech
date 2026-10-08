# AgroTech — instruções para o Claude

**Antes de qualquer trabalho, leia `docs/POLITICA-DE-APROVACAO.md`.** Ele diz o que o dono já aprovou (fazer direto, sem perguntar), quais sistemas já estão aprovados (não mexer sem motivo) e o que sempre exige perguntar.

Regras de trabalho:
- Quando o dono aprovar algo novo ("pode ser", "faça", "veja o que acha melhor"), **acrescente a decisão à política** (seção B ou D, com a data) no mesmo commit.
- Não repita pergunta já respondida na política; não refatore sistemas listados na seção C sem defeito comprovado.
- Fale em português, simples, sem jargão; diga com honestidade o que foi testado e o que não foi.
- Documentação do estado: `docs/ESTADO-DO-SISTEMA.md` (visão do dono) e `docs/PROGRESSO.md` (histórico técnico).
- Verificações no navegador: simulador em `apps/web/e2e/supabase-simulado.mjs` e os `verificar-*.mjs` (Playwright). Em Git Bash use `MSYS_NO_PATHCONV=1` para caminhos começados em `/`.
- Toda migration que cria função precisa revogar `execute` de `public`/`anon` (o teste do `db-test` falha se não).
