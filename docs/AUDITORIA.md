# Auditoria do AgroTech

Revisão do protótipo `agrotech.html` e da documentação, feita antes de escrever o scaffold.
Data: agosto de 2026 · Versão auditada: protótipo 1.0

---

## Resumo

Foram encontrados **11 defeitos**, sendo 1 erro agronômico de recomendação, 3 problemas funcionais
que quebram o app em ambiente real e 7 de qualidade. Todos os de gravidade alta e média foram
corrigidos no protótipo e não se repetem no scaffold. A lista completa está abaixo, com o que ficou
pendente marcado.

O motor agronômico foi extraído e submetido a uma suíte de 19 testes com um caso real de latossolo
ácido de meia encosta (café conilon, região de Colatina). Foi essa suíte que expôs o erro agronômico.

---

## Grave — erro de recomendação técnica

### A1. Escolha do calcário estava invertida

**Onde:** protótipo, texto de orientação da calagem; e a regra reescrita em `agro-core/src/calagem.ts`.

**O que estava escrito:** relação Ca/Mg **abaixo** de 3:1 recomendava calcário dolomítico.

**Por que está errado:** Ca/Mg baixo significa magnésio sobrando em relação ao cálcio. Aplicar
dolomítico nesse solo agrava o desequilíbrio, porque o dolomítico é justamente a fonte de Mg. A
relação larga — muito Ca para pouco Mg — é que pede dolomítico.

**Como ficou:**

| Situação | Corretivo |
|---|---|
| Mg abaixo de 0,9 cmolc/dm³, ou Ca/Mg acima de 4:1 | Dolomítico |
| Ca/Mg abaixo de 2:1 | Calcítico |
| Entre 2:1 e 4:1 com Mg adequado | Magnesiano |

O critério agora olha o magnésio em termos absolutos antes da relação, porque um solo pobre nos dois
cátions pode ter uma relação aparentemente boa e ainda assim precisar de Mg.

**Como foi pego:** o teste `indica dolomitico quando falta magnesio` falhou na primeira execução.
Sem a suíte, isso teria chegado no laudo de um cliente.

---

## Alto — quebra em ambiente real

### A2. `confirm()` e `alert()` não funcionam em iframe restrito

Exclusão e restauração de tabelas dependiam de `confirm()`, que é bloqueado quando o app roda dentro
de um iframe com sandbox. O usuário clicava em "Excluir" e nada acontecia, sem qualquer mensagem.
**Corrigido:** diálogo próprio, com promise, que também descreve o efeito em cascata ("os talhões,
análises e visitas ligados a ele também serão apagados").

### A3. Troca de talhão na visita apagava o formulário

`trocouTalhaoVisita()` reconstruía o modal inteiro raspando `lastElementChild.outerHTML`. Quem já tinha
digitado observação e recomendação perdia tudo ao corrigir o talhão. Além de frágil: qualquer mudança
na estrutura do rodapé quebrava a função.
**Corrigido:** só os dois blocos que dependem da cultura são reconstruídos — o seletor de fenologia e a
tabela de alvos. O resto do formulário fica intacto.

### A4. pH classificado na escala errada

O objeto de faixas do pH trazia nomes próprios (`Acidez elevada`, `Adequado`, `Alcalino`), mas a função
de régua ignorava esse campo e usava a escala genérica. Resultado: um solo com pH 7,4 aparecia como
**"Muito bom"**, quando é alcalino e traz risco de indisponibilizar zinco, manganês e boro.
**Corrigido:** a régua aceita escala e cores próprias por parâmetro; o pH usa a dele.

---

## Médio

### A5. Alumínio contado duas vezes no perfil da CTC

A legenda listava Al ao lado de H+Al como se fossem parcelas independentes. Quimicamente, a acidez
potencial (H+Al) **já contém** o alumínio trocável. Somar os dois superestima a acidez.
**Corrigido:** o Al não é mais um segmento próprio. Ele aparece como a fração avermelhada dentro do
segmento de H+Al, e a legenda diz explicitamente "parte do H+Al".

### A6. Modal sem tecla Escape e sem foco

Sem `Escape`, sem foco inicial e sem `aria-modal` nos diálogos de confirmação.
**Corrigido:** Escape fecha, o botão de ação recebe foco, e o diálogo tem papel de `alertdialog`.

### A7. Faixas de sanidade ausentes no lançamento

Nada impedia digitar pH 42 ou argila 300%. O motor calculava e devolvia números sem sentido.
**Corrigido:** faixas plausíveis por parâmetro no parser (`SANIDADE`) e constraints no
banco (`ph_plausivel`, `argila_plausivel`); e no protótipo HTML (`valoresImplausiveis()`
em `salvarAnalise`).

### A8. Sem impressão configurada

O laudo imprimia com as margens padrão do navegador e quebrava cartões no meio.
**Corrigido:** `@page` com A4 e margens de 16 mm por 14 mm, e `break-inside: avoid` em cartões, tabelas
e réguas.

---

## Baixo — qualidade

### A9. Código repetido na navegação

`verAnalise` e `verVisita` reconstruíam as abas manualmente, duplicando o que `render()` já faz.
Não quebra nada, mas é onde um bug futuro vai nascer. **Pendente no protótipo**, resolvido pelo
roteador do Next no scaffold.

### A10. `gessagem()` chamada três vezes na mesma renderização

Recalcula o mesmo resultado por falta de uma variável intermediária. Irrelevante para a performance,
relevante para a leitura. **Corrigido** no protótipo (`const ges` em `laudoHTML`); no scaffold
`gerarRecomendacao` já calcula uma vez.

### A11. Escalonamento do N para pastagem

A dose de nitrogênio escala com a produtividade esperada dividida pela de referência. Para culturas
medidas em toneladas ou sacas isso funciona. Para pastagem, medida em UA/ha, a proporcionalidade é
mais frouxa — 4 UA/ha não exige exatamente o dobro do N de 2 UA/ha.
**Pendente por decisão:** a fórmula continua transparente e o valor fica editável. Vale revisar quando
houver dado de campo.

---

## Achados na documentação

### D1. Recomendação de gesso apresentada como cálculo

O texto dava a fórmula `50 × % argila` com destaque semelhante ao da calagem. Isso sugere uma precisão
que o dado não tem: a decisão de gesso depende da camada de 20–40 cm, que o sistema não coleta.
**Ajustado:** a interface e o documento agora dizem que o sistema apenas *indica a necessidade de
investigar*, e que a dose só vale com análise de subsuperfície.

### D2. Perfis de laboratório eram descritos, não implementados

O documento definia o formato dos perfis de parsing sem nenhum código. **Resolvido:** o scaffold traz
`packages/agro-core/src/parsers/` funcional, com testes que leem um laudo em texto e conferem os
valores extraídos, incluindo os três casos que sempre dão problema — vírgula decimal, unidade de K
divergente entre laboratórios, e carbono orgânico no lugar de matéria orgânica.

---

## O que a suíte de testes cobre hoje

19 testes em `packages/agro-core/test/motor.test.ts`:

- conversão de K de mg/dm³ para cmolc/dm³
- SB, CTC efetiva, CTC a pH 7, V% e m% contra valores conferidos à mão
- classificação de fósforo mudando com o teor de argila (o mesmo P vira classe diferente)
- valor exatamente sobre um ponto de quebra permanece na classe inferior
- fator Y da calagem por textura
- escolha entre os dois métodos de calagem, e correção pelo PRNT
- escolha do corretivo nos três cenários de Ca/Mg
- escala da adubação pela produtividade esperada
- troca da fonte de fósforo e nitrogênio conforme o enxofre
- diagnóstico apontando alumínio como crítico
- carimbo da versão do motor
- parser: número em formato brasileiro, extração de laudo em texto, rejeição de valor impossível,
  conversão de carbono orgânico

**O que ainda não é testado:** políticas de RLS além do esqueleto em `supabase/tests/rls.test.sql`,
laudos reais em PDF (dependem de arquivos anonimizados que você precisa fornecer), e o fluxo de
convite do produtor.

---

## Recomendação de prioridade

1. **Calibrar as tabelas de referência.** É o maior risco em aberto e nenhum código resolve.
2. **Juntar cinco a dez laudos reais** dos laboratórios que você mais usa, anonimizados, e transformar
   cada um em caso de teste do parser. É o que faz a ingestão de PDF sair do papel.
3. **Rodar `supabase test db` no CI desde o primeiro dia.** Falha de RLS é vazamento de carteira.
4. Só depois disso vale investir em OCR, análise foliar e múltiplas camadas.
