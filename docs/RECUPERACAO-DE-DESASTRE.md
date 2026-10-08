# Recuperação de desastre — AgroTech

O que fazer se o banco do Supabase for perdido ou corrompido. Última verificação: 08/10/2026 (restauração limpa, 0 erros, 67 tabelas e contagens iguais à produção).

## O que existe
- **Backup diário do banco**, às 03h de Brasília (workflow "Backup diário"): schemas `agro` (todo o negócio), `auth` (contas) e `storage` (só a lista dos arquivos). Fica 30 dias como artefato do GitHub, **criptografado** (AES-256) porque o repositório é público.
- **Ensaio de restauração a cada backup:** o mesmo job decifra o arquivo, restaura num Postgres 17 descartável e confere tabelas, contagens e RLS contra a produção. Se falhar, o GitHub avisa por e-mail.
- **Perda máxima aceita (RPO):** até 24 horas de dados (o que foi lançado depois do último backup).
- **Tempo estimado para voltar (RTO):** 1 a 2 horas com o passo a passo abaixo (não medido numa emergência real).

## O que NÃO está coberto
- **Os arquivos do Storage** (PDFs de laudo, fotos de visita, comprovantes): o backup guarda só a lista (`storage.objects`), não os arquivos. Hoje há poucos. Cobrir isso exige um acesso ao Storage (chave de serviço ou chaves S3) guardado como secret do GitHub — decisão e ação do dono.
- **A senha de criptografia** (`BACKUP_PASSPHRASE`): sem ela os backups não abrem. Guarde uma cópia num gerenciador de senhas, fora do GitHub.
- **Configurações do painel do Supabase** (hook de login, limites, URLs, template de e-mail): não estão no backup; estão descritas em `docs/PROGRESSO.md`.
- **Variáveis do Vercel** (chaves): guardadas no próprio Vercel.

## Passo a passo para restaurar
1. **Criar um projeto Supabase novo** (ou limpar o existente, se for o caso). Anotar a URL de conexão do banco (Settings → Database).
2. **Aplicar as migrações** do repositório no projeto novo (`supabase db push --db-url <URL>`), para ele ter a estrutura, as funções e as políticas de segurança.
3. **Baixar o último backup:** GitHub → Actions → "Backup diário" → última execução verde → artefato `backup-…`.
4. **Decifrar** com a senha: `gpg --decrypt backup-AAAAMMDD.dump.gpg > backup.dump`.
5. **Restaurar só os dados**: `pg_restore --no-owner --data-only --disable-triggers -d <URL> backup.dump` (versão 17 do cliente). Se a estrutura já veio das migrações, os dados entram nas tabelas existentes.
6. **Conferir:** número de usuários, produtores, análises; entrar no site com a conta do proprietário; abrir um laudo.
7. **Apontar o site:** atualizar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no Vercel e fazer um novo deploy; refazer no painel do Supabase o hook de login (Authentication → Hooks), a Site URL e a Redirect URL `/redefinir-senha`.
8. **Avisar a equipe:** as sessões antigas deixam de valer; todos entram de novo.

> O passo 5 (restauração dos dados sobre a estrutura das migrações) **não** foi ensaiado — o que o ensaio diário prova é a restauração completa do dump (estrutura + dados) num Postgres limpo. Se o passo 5 falhar, a alternativa é restaurar o dump inteiro sem as migrações: `pg_restore --no-owner -d <URL> backup.dump`.

## Quando revisar
- Depois de qualquer mudança grande de banco (o ensaio diário já detecta objetos que deixam de restaurar).
- A cada 3 meses: baixar um backup, decifrar na sua máquina e conferir que a senha guardada funciona.
