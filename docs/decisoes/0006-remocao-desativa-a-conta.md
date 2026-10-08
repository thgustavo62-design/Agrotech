# Remover da equipe = desativar a conta, não apagá-la

- **Data:** 2026-10-08
- **Decidido por:** Dono ("faça" a correção da remoção)
- **Estado:** em vigor

## Contexto
"Remover do escritório" só desvinculava: a pessoa entrava de novo e ganhava um escritório de teste vazio. Apagar a conta quebraria a autoria de laudos.

## Decisão
A conta é bloqueada no Auth, o e-mail é liberado e o perfil é marcado `desativado_em`. O banco passa a ler escritório e papel do **perfil**, não do token (0039, 0041): leitura e escrita caem na hora.

## Consequências e limites
O Auth ainda aceita o token até expirar; o banco é que não entrega mais nada.
