# AgroTech

Módulo de assistência técnica agronômica do ecossistema **Campo Forte** (Nova7).
O lado do técnico: solo, nutrição e sanidade da lavoura — calagem, gessagem e
adubação com respaldo, e caderno de campo por talhão.

> O app calcula, o agrônomo decide. Toda recomendação sai com nome e CREA do
> responsável técnico e carrega a versão do motor e o snapshot das tabelas usadas.

---

## Estrutura

```
packages/agro-core/   motor agronômico — TS puro, sem DOM/DB/rede, 45 testes
apps/web/             Next.js 15 (App Router) — esqueleto
supabase/             migrations (RLS em tudo), edge functions, testes pgTAP
prototipo/            agrotech.html — protótipo de referência (congelado)
docs/                 AGROTECH (visão) · ARQUITETURA (as-built) · MOTOR · AUDITORIA · PROGRESSO
```

## Rodando

```bash
npm install
npm run test:core     # 45 testes do motor (vitest)
npm run typecheck     # agro-core, strict
npm run build         # compila agro-core -> dist/
```

App web e banco local: ver [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Onde estamos

Fase 1 (Fundação) em andamento — motor extraído e testado, schema + RLS
prontos, esqueleto do Next no lugar. Detalhe em
[docs/PROGRESSO.md](docs/PROGRESSO.md).

## Documentação

| Documento | O que é |
|---|---|
| [docs/AGROTECH.md](docs/AGROTECH.md) | Visão completa: produto, arquitetura alvo, roadmap |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | O que já está no código (as-built) |
| [docs/MOTOR.md](docs/MOTOR.md) | Fórmulas do `agro-core` + referências |
| [docs/AUDITORIA.md](docs/AUDITORIA.md) | Revisão do protótipo (11 defeitos) |
| [docs/AUDITORIA-02.md](docs/AUDITORIA-02.md) | Auditoria da extração para o monorepo |
| [docs/PROGRESSO.md](docs/PROGRESSO.md) | Passo a passo por fase |
