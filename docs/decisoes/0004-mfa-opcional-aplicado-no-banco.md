# Verificação em duas etapas opcional, aplicada no banco

- **Data:** 2026-10-08
- **Decidido por:** Claude, por delegação do dono
- **Estado:** em vigor

## Contexto
Sem domínio próprio não há recuperação de conta por e-mail; tornar o segundo fator obrigatório poderia trancar o único proprietário para fora.

## Decisão
TOTP **opcional por pessoa** (recomendado ao proprietário). Ligado, o banco (`jwt_org`, `jwt_role`, `pode`) só entrega dados a sessões `aal2` — quem tem a senha mas não o celular não lê nem grava, nem pela API. O perfil continua legível em aal1 para o app pedir o código.

## Consequências e limites
Perder o celular exige remover o fator no painel do Supabase (ou outro proprietário). Não testado com o Auth real.
