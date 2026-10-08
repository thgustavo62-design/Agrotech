# Backup só sai criptografado (repositório público)

- **Data:** 2026-10-08
- **Decidido por:** Claude (autorizado a manter o backup funcionando)
- **Estado:** em vigor

## Contexto
O repositório é público e artefatos de workflow são baixáveis por qualquer conta do GitHub. Consertar o backup sem isso publicaria o banco inteiro.

## Decisão
Dump com `pg_dump` 17, conferido e criptografado (AES-256, secret `BACKUP_PASSPHRASE`) antes de guardar; o job falha se a senha não existir. A restauração é ensaiada a cada dia num Postgres descartável.

## Consequências e limites
Quem perder a senha perde os backups. Arquivos do Storage não estão no dump.
