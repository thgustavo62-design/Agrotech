# MOTOR.md — fórmulas do `agro-core`

Toda mudança de fórmula, faixa ou regra de decisão exige: bump em
`src/versao.ts`, atualização desta página e um caso de teste.

---

## 1. Complexo sortivo — `calculos.ts`

```
K  (cmolc/dm³) = K  (mg/dm³) / 391      CONV.K
Na (cmolc/dm³) = Na (mg/dm³) / 230      CONV.Na
SB = Ca + Mg + K + Na
t  = SB + Al                            (CTC efetiva)
T  = SB + (H+Al)                        (CTC a pH 7)
V% = 100 · SB / T
m% = 100 · Al / t
```

Relações: `Ca/Mg`, `Ca/K`, `Mg/K`, e participação `%` de cada base em T.
Divisões protegidas (`div`) — divisor 0 devolve 0, nada de `NaN`.

## 2. Interpretação — `interpretacao.ts`

5 classes, 4 quebras. **Valor sobre a quebra fica na classe inferior**
(`v > quebra` para subir). Parâmetros invertidos (Al, H+Al, m%) trocam os
rótulos das classes 3/4 para "Alto"/"Muito alto".

Fósforo depende da argila:

| Argila | MB até | B até | M até | Bom até |
|---|--:|--:|--:|--:|
| 60–100% | 2,7 | 5,4 | 8,0 | 12,0 |
| 35–60%  | 4,0 | 8,0 | 12,0 | 18,0 |
| 15–35%  | 6,6 | 12,0 | 20,0 | 30,0 |
| 0–15%   | 10,0 | 20,0 | 30,0 | 45,0 |

## 3. Calagem — `calagem.ts`

Dois métodos, **adota o maior**.

```
Saturação por bases:   NC = (V2 − V) · T / 100
Neutralização do Al:    NC = Y · [Al − (m_max · t / 100)] + [2 − (Ca + Mg)]
                        (ambos os termos truncados em 0)
```

`Y` por textura: ≥60% → 4 · 35–60% → 3 · 15–35% → 2 · <15% → 1.

```
Dose aplicada = NC · (100 / PRNT) · fator_profundidade
fator_profundidade: 0–20 → 1,0 · 0–30 → 1,5 · 0–40 → 2,0
```

### Escolha do corretivo — **auditoria A1** (estava invertida no protótipo)

```
Mg < 0,9 cmolc/dm³  OU  Ca/Mg > 4:1   → dolomítico
Ca/Mg < 2:1                           → calcítico
2:1 ≤ Ca/Mg ≤ 4:1  com Mg adequado    → magnesiano
Mg não informado                      → magnesiano (conservador) + aviso
```

Olha o Mg **absoluto antes da relação**: solo pobre nos dois cátions pode ter
Ca/Mg "bom" e ainda precisar de Mg.

## 4. Gessagem — `gessagem.ts`

Indica **investigar** (não calcula dose) quando, na camada 0–20 cm:
`Al > 0,5` **ou** `Ca < 0,5` **ou** `m% > 20`.
Dose de referência grosseira `50 · %argila` só vale com análise de 20–40 cm.

## 5. Adubação — `adubacao.ts`

```
fator = produtividade_esperada / produtividade_referência
N    = N_ref · fator
P2O5 = P_tabela[classe_de_P] · fator
K2O  = K_tabela[classe_de_K] · fator
```

Pendência A11: para pastagem (UA/ha) a proporcionalidade do N é frouxa; fórmula
mantida, valor editável.

## 6. Conversão em fonte comercial — `fontes.ts`

```
kg de produto/ha = kg de nutriente/ha / (garantia% / 100)
```

Condicional ao enxofre: S baixo → superfosfato simples + sulfato de amônio;
senão → superfosfato triplo + ureia. B e Zn entram quando abaixo da faixa baixa.

## 7. Diagnóstico — `diagnostico.ts`

Regras encadeadas → texto `crit` / `atencao` / `ok`. Ordem = prioridade:
pH, m%, V%, P, K, MO, Ca/Mg, Mg/K, B, Zn, S.

## 8. Rastreabilidade — `recomendacao.ts` + `versao.ts`

Toda `Recomendacao` carrega `motor_versao` e `tabelas_snapshot` (cópia JSON).
`gerarRecomendacao` é pura (a data pode ser fixada por parâmetro nos testes).

---

## Referências

- Alvarez V., V.H. et al. **Interpretação dos resultados das análises de solos.**
  In: Ribeiro, Guimarães, Alvarez V. (eds.) *Recomendações para o uso de
  corretivos e fertilizantes em Minas Gerais — 5ª Aproximação.* Viçosa: CFSEMG, 1999.
- Prezotti, L.C. et al. **Manual de recomendação de calagem e adubação para o
  Estado do Espírito Santo — 5ª aproximação.** Vitória: SEEA/Incaper/Cedagro, 2007.
- Sobral, L.F. et al. **Guia prático para interpretação de resultados de análises
  de solos.** Embrapa Tabuleiros Costeiros, 2015.

> Os números carregados por padrão são de literatura. Antes de laudo para
> cliente, calibrar a aba Tabelas contra material do Incaper e histórico regional.
