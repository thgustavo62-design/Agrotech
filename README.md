# AgroTech

Plataforma de **assistência técnica agronômica** para escritórios: carteira de produtores, propriedades e talhões;
análises de solo (digitadas ou lidas de PDF); recomendação de calagem, gessagem e adubação; laudos; caderno de campo
(com trabalho sem sinal); agenda; financeiro do escritório; e um portal para o produtor acompanhar a lavoura.

> O app calcula, o agrônomo decide. Toda recomendação sai com o escritório e o responsável técnico (nome + CREA) e
> carrega a versão do motor e o snapshot das tabelas usadas — o laudo emitido continua reproduzível.

**No ar:** https://agrotech-three-self.vercel.app · **Estado atual, em linguagem simples:** [docs/ESTADO-DO-SISTEMA.md](docs/ESTADO-DO-SISTEMA.md)

---

## Como o código está organizado

```
apps/web/             Next.js 16 (App Router) + React 19 — a aplicação (telas, ações de servidor, proxy de sessão/CSP)
packages/agro-core/   motor agronômico e leitor de laudos — TypeScript puro, sem DOM/banco/rede
packages/laudo-pdf/   renderiza o laudo A4 em PDF (pdf-lib)
packages/db-test/     aplica TODAS as migrações num Postgres em WASM (PGlite) e testa isolamento, permissões e segurança
supabase/             migrações SQL (RLS em tudo), Edge Functions (ainda não publicadas), testes pgTAP
prototipo/            protótipo HTML de referência (congelado)
docs/                 documentação (tabela abaixo)
.github/workflows/    CI, migrações com portão de testes, backup criptografado + ensaio de restauração, monitoramento
```

Padrão das telas: **página → `dados.ts` (uma rodada de consultas) → componentes de seção** (ver [docs/ESTRUTURA.md](docs/ESTRUTURA.md)).
Regras de acesso: **no banco** (RLS + `agro.pode()`), espelhadas em `apps/web/lib/permissoes.ts` só para esconder o que a pessoa não pode usar.

## Rodando

Requisitos: Node 20+ (testado com 24).

```bash
npm install
npm run build --workspace @agrotech/agro-core   # o web e os testes leem os tipos de agro-core/dist
npm test                                        # todos os pacotes (motor, banco, laudo, web)
npm run typecheck && npm run lint --workspace @agrotech/web
```

App em modo desenvolvimento: crie `apps/web/.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(e, no servidor, `SUPABASE_SERVICE_ROLE_KEY` — **nunca** com prefixo `NEXT_PUBLIC_`) e rode `npm run dev`.

**Sem um Supabase real:** `apps/web/e2e/supabase-simulado.mjs` simula a API e o login; os scripts `verificar-*.mjs`
(Playwright) conferem telas, segurança (CSP), fila offline, senhas e equipe num navegador de verdade — ver
[apps/web/e2e/LEIA-ME.md](apps/web/e2e/LEIA-ME.md). Não rodam no CI (precisam de navegador).

## Ambientes e deploy

- **Produção:** Vercel (site) + Supabase (banco, login, arquivos; região us-west-2). Não existe ambiente de teste separado ainda.
- **Código → produção:** push na `main` publica o site (Vercel). Migrações em `supabase/migrations/` só vão ao banco real
  **depois** que os testes do `db-test` passam (workflow *Migrações (Supabase)*). Nunca edite uma migração já aplicada: crie outra.
- **Regra das migrações que criam função:** revogar `execute` de `public`/`anon` (o teste de segurança falha se esquecer).
- **Backup:** diário, criptografado, com restauração ensaiada ([docs/RECUPERACAO-DE-DESASTRE.md](docs/RECUPERACAO-DE-DESASTRE.md)).
- **Vigilância:** workflow *Monitoramento* a cada 30 min ([docs/OPERACAO.md](docs/OPERACAO.md)).

## Limites conhecidos (resumo)

Laudos de laboratórios reais além do primeiro ainda não foram validados · Edge Functions e cobrança Asaas não foram publicadas
nem testadas com contas reais · arquivos do Storage não entram no backup · reenvio offline só com o app aberto ·
textos de privacidade/termos são rascunho (ver [docs/LGPD-MINUTA.md](docs/LGPD-MINUTA.md)). Lista completa e atual em
[docs/ESTADO-DO-SISTEMA.md](docs/ESTADO-DO-SISTEMA.md) e [docs/PROGRESSO.md](docs/PROGRESSO.md).

## Documentação

| Documento | O que é |
|---|---|
| [docs/ESTADO-DO-SISTEMA.md](docs/ESTADO-DO-SISTEMA.md) | **Comece aqui.** Como o sistema está, em linguagem simples |
| [docs/POLITICA-DE-APROVACAO.md](docs/POLITICA-DE-APROVACAO.md) | O que já foi aprovado pelo dono (não perguntar de novo), sistemas aprovados e o que sempre pede confirmação |
| [CHANGELOG.md](CHANGELOG.md) | O que mudou, por data |
| [docs/decisoes/](docs/decisoes/) | Decisões técnicas e agronômicas, uma por arquivo (ADR), com data e motivo |
| [docs/OPERACAO.md](docs/OPERACAO.md) | O que vigiar e o que fazer quando algo quebra |
| [docs/RECUPERACAO-DE-DESASTRE.md](docs/RECUPERACAO-DE-DESASTRE.md) | Backup e passo a passo de restauração |
| [docs/LGPD-MINUTA.md](docs/LGPD-MINUTA.md) | Mapa de dados, direitos, retenção e incidente — rascunho para o advogado |
| [docs/PROGRESSO.md](docs/PROGRESSO.md) | Histórico técnico detalhado, entrega por entrega |
| [docs/ESTRUTURA.md](docs/ESTRUTURA.md) | Como o código se organiza e como provar que uma refatoração não mudou nada |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Arquitetura **no início do projeto** (histórico; o código manda) |
| [docs/MOTOR.md](docs/MOTOR.md) | Fórmulas do `agro-core` e referências |
| [docs/AUDITORIA-03.md](docs/AUDITORIA-03.md) | Auditoria de sessão, segurança, banco e erros (01/10/2026) — AUDITORIA.md e AUDITORIA-02.md são anteriores |
| [docs/AGROTECH.md](docs/AGROTECH.md), [PRODUTO-VENDAVEL.md](docs/PRODUTO-VENDAVEL.md), [PRODUCT_V2.md](docs/PRODUCT_V2.md), [PRODUCT_AUDIT.md](docs/PRODUCT_AUDIT.md), [UX_ARCHITECTURE.md](docs/UX_ARCHITECTURE.md), [DATABASE_CHANGES.md](docs/DATABASE_CHANGES.md) | Visão de produto e documentos de planejamento — **históricos**: podem descrever fases já superadas |
