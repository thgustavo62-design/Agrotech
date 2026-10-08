# Análise incompleta nunca vira laudo; em branco não é zero

- **Data:** 2026-10-08
- **Decidido por:** Claude (aprovado pelo dono: "Posso começar pelo AG-002?" → "FAZ")
- **Estado:** em vigor

## Contexto
O motor trata campo em branco como zero (`n()`): Ca vazio saía como "solo sem cálcio" e M.O./B/Zn/S em branco geravam diagnóstico de deficiência inventado.

## Decisão
`validarAnalise()`: essenciais (pH, argila, P, K, Ca, Mg, Al, H+Al) em branco, texto, negativos ou fora da faixa bloqueiam a emissão (no servidor; a tela só avisa). Zero medido é válido. Opcionais em branco ficam "não informados": o diagnóstico não os avalia e o laudo mostra "—".

## Consequências e limites
A regra está no servidor e no motor, não como restrição do banco (o cálculo é em TypeScript).
