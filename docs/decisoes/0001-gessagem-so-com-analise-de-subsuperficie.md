# Gessagem: dose só com análise de 20–40 cm

- **Data:** 2026-10-08
- **Decidido por:** Claude, por delegação do dono ("veja o que você acha melhor"); **revisar com agrônomo responsável antes de vender para vários escritórios**
- **Estado:** em vigor

## Contexto
A tela mostrava "2.100 kg/ha" de gesso (50 × % de argila) enquanto o PDF dizia "investigar". A decisão de gessar depende do perfil, não da camada de 0–20 cm.

## Decisão
Três situações: `sem_indicacao`, `investigar_subsuperficie`, `aprovada`. **A dose só existe** quando há análise de 20–40 cm do mesmo talhão, não arquivada, a até 24 meses da superficial, confirmando Ca < 0,5 cmolc/dm³ ou m > 20%. Sem isso a dose é `null` (não há dose "de referência"). Subsuperfície incompleta (falta Ca, Mg, K ou Al) é ignorada. Tela, laudo, PDF e link do produtor usam o mesmo texto.

## Consequências e limites
Limites (0,5 e 20%), a dose (50 kg/ha por % de argila) e a janela de 24 meses vêm do código anterior/escolha técnica e não foram revisados por um agrônomo externo. Recomendações antigas nunca exibem a dose antiga como prescrição.
