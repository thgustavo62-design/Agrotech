# UX_ARCHITECTURE.md — navegação, telas e sistema de componentes

Arquitetura de informação para as duas experiências (Central do Agrônomo,
Portal do Produtor), a partir do pedido do usuário e do estado real descrito
em `PRODUCT_AUDIT.md`. Este documento não implementa nada — é a planta antes
da obra (ver `PRODUCT_V2.md` para o faseamento).

---

## 1. Princípio de navegação

Hoje (`nav-abas.tsx`): uma fileira horizontal de 8 abas, sem agrupamento,
sem colapso em telas estreitas além do scroll horizontal. Funciona para 8
itens; não funciona para os ~14 itens de menu que o pedido descreve.

**Decisão:** sidebar retrátil no desktop (≥960px), agrupada em 4 seções;
barra inferior de ícones no mobile (<960px) com os 5 itens mais usados +
"Mais" abrindo um drawer com o resto. Isso segue o padrão que o pedido cita
como referência conceitual (Linear/Vercel/Stripe: sidebar agrupada, densa,
sem hero) sem copiar identidade visual — mantém `--papel`/`--tinta`/`--folha`.

### 1.1 Central do Agrônomo — grupos de menu

```
VISÃO GERAL
  Início            /app                (era "Painel")
  Agenda            /app/agenda         [novo, Fase 9]
  Pendências        /app/pendencias     [novo — recorte do painel, Fase 2]

GESTÃO TÉCNICA
  Produtores        /app/produtores
  Propriedades      /app/propriedades   [novo — hoje só existe dentro do produtor, Fase 3]
  Talhões           /app/talhoes
  Análises          /app/analises
  Laudos            /app/laudos
  Recomendações     /app/recomendacoes  [novo — hoje só existe dentro da análise, Fase 3/4]
  Monitoramento     /app/monitoramento

INTELIGÊNCIA
  Indicadores       /app/inteligencia   [novo, Fase 8]
  Relatórios        /app/relatorios     [novo, Fase 8]

GESTÃO
  Financeiro        /app/financeiro-escritorio  [novo — do ESCRITÓRIO, não do produtor; ver §4]
  Equipe            /app/equipe         [novo, Fase 26/multiusuário — fora do escopo imediato]
  Tabelas técnicas  /app/tabelas
  Assinatura        /app/assinatura
  Configurações     /app/config         [novo — hoje é a aba "Consultor" implícita em onboarding]
```

Nota: o pedido lista "FINANCEIRO DO ESCRITÓRIO" como item do agrônomo,
**diferente** do financeiro do produtor (§4). O financeiro do escritório
(quanto o consultor cobra dos clientes, despesas do escritório) não tem
nenhuma tabela hoje e não está no schema desta leva (`DATABASE_CHANGES.md`
foca no financeiro do produtor, que é o pedido com especificação completa
nas seções 10–15). Financeiro do escritório fica como item de menu
reservado (rota existe, tela "em breve") até ter especificação própria.

### 1.2 Portal do Produtor — menu simples, sem grupos

```
Início            /produtor
Minha Fazenda     /produtor/fazenda      [novo — hoje é implícito no painel, Fase 5]
Talhões           /produtor/talhoes      [novo — hoje só aparece agregado no painel]
Recomendações     /produtor/recomendacoes [novo — hoje só via laudo direto]
Atividades        /produtor/atividades   [novo, Fase 9 — depende de visitas/agenda existirem]
Financeiro        /produtor/financeiro   [novo, Fase 6]
Produção          /produtor/producao     [novo, Fase 7]
Documentos        /produtor/documentos   [novo — laudos + arquivos]
```

Sem sidebar agrupada aqui — 7 itens cabem numa barra simples, e o público
(produtor rural, uso predominante no celular) se beneficia de menos
hierarquia, não mais.

**O produtor nunca vê:** Tabelas técnicas, Configurações, Assinatura,
Equipe, Produtores (carteira), Financeiro do escritório — nenhuma dessas
rotas existe sob `/produtor/*`, e a guarda de layout (`app/(produtor)/produtor/layout.tsx`)
já barra qualquer tentativa de acessar `/app/*` redirecionando para `/produtor`.
Isso continua sendo também uma questão de RLS, não só de rota — ver `DATABASE_CHANGES.md` (nenhuma tabela nova sob `/produtor/*` tem política de consultor, ver §Decisões).

---

## 2. Dashboard do Agrônomo (`/app`)

Estado atual: `painel_consultor()` devolve produtores/talhões/área/análises/
laudos-na-fila/pendências/área-por-cultura/últimas-visitas num único JSON,
renderizado em cards + duas listas. Já é uma boa base — **não precisa de
nova função no banco para os cards básicos do pedido**, só de:

1. Expandir `painel_consultor()` (mesma função, `jsonb_build_object` cresce)
   para incluir: visitas atrasadas, próximas visitas, recomendações
   pendentes vs. emitidas, produtores sem visita recente, talhões sem
   análise atualizada. Todos esses são `count`/`filter` sobre tabelas que já
   existem — não pedem schema novo, só mais campos na função.
2. Seção **"Precisa da sua atenção"**: não é uma tabela nova — é a lista de
   `pendencias` que já existe, mas ordenada por prioridade (crítico > vencido
   > análise pendente > próxima visita > recomendação não vista) em vez de
   só por cultura. A ordenação por prioridade é lógica de apresentação
   (client ou na própria função SQL via `order by` composto), não schema.
3. **Timeline de atividades recentes**: esta, sim, precisa de dado que não
   existe hoje de forma consultável — ver `DATABASE_CHANGES.md §Timeline`.
   Decisão: **não** criar uma tabela `atividades` de propósito geral (seria
   duplicar o que já está em `audit_log`, que registra `acao`/`entidade`/
   `entidade_id`/`dados`/`criado_em` para cada evento relevante desde a
   Fase "produto vendável"). A timeline do painel é `select` em `audit_log`
   filtrado por `acao in (...)` e formatado — reaproveita o que já existe e
   finalmente dá um consumidor para essa tabela (dívida técnica #2 de `PRODUCT_AUDIT.md §7`: "audit_log sem consumidor").

Layout: grid de métricas no topo (como hoje), seção "Precisa da sua atenção"
logo abaixo (substitui a atual "Pendências químicas", que vira um filtro
dela), depois "Composição" (área por cultura, já existe) e "Atividade
recente" (nova, timeline de `audit_log`) lado a lado em telas largas.

---

## 3. Visão 360º do Produtor (`/app/produtores/[id]`)

Hoje é uma página única e já densa (a mais completa do app). Vira um
cabeçalho fixo + abas, reaproveitando cada bloco existente como conteúdo de
uma aba em vez de seção empilhada:

```
┌─────────────────────────────────────────────────────────────┐
│ ← Produtores                                    [Editar] […] │
│ João Silva                                                    │
│ Fazenda Esperança · Baixo Guandu/ES · 42 ha · última visita  │
│ há 12 dias · próxima em 3 dias · ● situação geral: atenção   │
├─────────────────────────────────────────────────────────────┤
│ RESUMO  PROPRIEDADES  TALHÕES  ANÁLISES  RECOMENDAÇÕES        │
│ VISITAS  DOCUMENTOS  FINANCEIRO*  LINHA DO TEMPO              │
└─────────────────────────────────────────────────────────────┘
```

`*` FINANCEIRO aqui é **read-only e condicional**: só aparece se o produtor
tiver ativado compartilhamento explícito com o consultor (ver decisão §2.2
de `PRODUCT_V2.md` — por padrão o consultor não vê nada financeiro do
produtor). Sem esse compartilhamento, a aba nem aparece.

Mapeamento aba → dado (o que já existe vs. novo):

| Aba | Fonte de dado | Novo? |
|---|---|---|
| Resumo | Agregação das outras abas + `vw_talhao_situacao` (já existe) | Composição nova, dados existentes; gráfico de evolução do solo é novo (§6) |
| Propriedades | `agro.propriedades` (já existe) | Só listagem, reaproveita `salvarPropriedade` |
| Talhões | Bloco atual de "agrupado por cultura" (já existe) | Reaproveita como está |
| Análises | `agro.analises` por talhão | Precisa de vista agregada por produtor (query nova, schema não) |
| Recomendações | `agro.recomendacoes` por produtor via `produtor_id` (já denormalizado desde `0012`) | Tela nova (`/app/produtores/[id]` aba), consulta simples |
| Visitas | `agro.visitas` por produtor | Depende do formulário de visita existir (débito técnico #4 do audit) |
| Documentos | `agro.documentos` por produtor_id (coluna já existe desde `0012`) | Tela nova, consulta simples |
| Financeiro | `financeiro_*` (novo, Fase 6), só com opt-in | Novo, condicional |
| Linha do tempo | `audit_log` filtrado por `entidade_id` na cadeia do produtor | Reaproveita, mesma fonte do painel |

O mapa de propriedades citado no pedido (§4) depende de coordenadas —
`propriedades.lat/lng` já existem no schema (migration `0002`), nunca
usadas na UI. Decisão de implementação: usar um mapa estático (sem lib de
mapa interativa) na primeira versão — leaflet/mapbox é uma dependência
pesada para um dado que hoje é opcional e raramente preenchido; reavaliar
quando houver massa real de coordenadas cadastradas.

---

## 4. Visão 360º do Talhão (nova — não existe hoje em nenhuma forma)

Hoje o talhão só aparece embutido: como linha numa tabela (dentro da página
do produtor) ou como contexto de uma análise (`/app/analises/[id]`). É a
maior lacuna estrutural do pedido em relação ao que existe.

```
┌─────────────────────────────────────────────────────────────┐
│ ← Fazenda Esperança                                            │
│ Talhão 03 — Café Conilon                          [Editar] […] │
│ 5,8 ha · plantado 2019 · 3,0×1,2 m · esperado 60 sc/ha ·       │
│ realizado 54 sc/ha (safra 2025) · ● status: adequado           │
├─────────────────────────────────────────────────────────────┤
│ VISÃO GERAL  SOLO  NUTRIÇÃO  HISTÓRICO  RECOMENDAÇÕES          │
│ MONITORAMENTO  FOTOS  CUSTOS  PRODUÇÃO                         │
└─────────────────────────────────────────────────────────────┘
```

| Aba | Fonte | Novo? |
|---|---|---|
| Visão geral | Dados do talhão + última situação (`vw_talhao_situacao`) | Tela nova, dado existente |
| Solo | Últimas análises, réguas de interpretação (reaproveita `regua-interpretacao.tsx`) | Tela nova, componente existente |
| Nutrição | Última adubação calculada (reaproveita `interpretacao-view.tsx`, seção de adubação) | Tela nova, lógica existente |
| Histórico | Timeline por safra (ver abaixo) | Novo — depende de `safras` existir (Fase 7) para agrupar por ano-safra; sem isso, agrupa por ano civil da `data_coleta`/`data` |
| Recomendações | `agro.recomendacoes` por talhão (via `analises.talhao_id`) | Tela nova, dado existente |
| Monitoramento | `agro.visitas` do talhão | Depende do form de visita (débito #4) |
| Fotos | `agro.visita_fotos` do talhão | Já suportado no schema, sem UI de galeria |
| Custos | `financeiro_lancamentos` filtrados por `talhao_id` | Novo (Fase 6/7), só visível ao produtor (mesma regra de isolamento) |
| Produção | `producao_registros` do talhão | Novo (Fase 7) |

A "timeline por safra" do pedido (§5) é a peça mais nova conceitualmente:
não existe hoje o conceito de safra como período. Ver `DATABASE_CHANGES.md`
para a tabela `agro.safras` (proposta: ano + cultura + datas de início/fim
por talhão) — sem ela, "safra" vira só "ano civil da data do evento", o que
é aceitável como primeira versão e não bloqueia as outras abas.

---

## 5. Análises agronômicas visuais (pedido §6)

Todos os cinco itens do pedido (radar de fertilidade, perfil da CTC,
evolução histórica, comparador, indicador geral) **leem dados que o
`agro-core` já calcula** — nenhum precisa de mudança no motor:

- **Radar de fertilidade**: `ResultadoCalculo` já tem `classeP`/`classeK` e
  os valores brutos de pH/Ca/Mg/MO; o radar é só a mesma régua atual em
  outra geometria. Precisa de uma lib de chart (Recharts, como o pedido já
  assume) porque hoje **não existe nenhuma** no projeto.
- **Perfil da CTC**: já existe (`perfil-ctc.tsx`), é uma barra empilhada —
  "mostrar visualmente Ca/Mg/K/Na/Al/H+Al" já é isso, com a ressalva
  documentada de que Al é fração dentro de H+Al (auditoria A5), não uma
  fatia própria. Reaproveitar sem mudança.
- **Evolução histórica**: precisa de uma consulta nova (várias `analises` do
  mesmo talhão, ordenadas por data) — schema não muda, é `order by
  data_coleta`.
- **Comparador de análises**: mesma fonte, par de análises escolhido pelo
  usuário; "melhorou/estável/piorou" é uma função pura nova em `agro-core`
  (compara dois `ResultadoCalculo`, threshold configurável) — **isso sim é
  mudança no motor, mas aditiva** (função nova, não altera as existentes,
  ganha teste próprio). Ver nota de implementação: nunca afirmar
  causalidade, só diferença — o pedido é explícito sobre isso.
- **Indicador geral do talhão** (Crítico/Atenção/Adequado): já existe como
  conceito em `vw_talhao_situacao.situacao` (`precisa_correcao/atencao/em_ordem`),
  criada na etapa "produto vendável". Reaproveitar o nome e a lógica —
  só precisa expor "quais regras causaram o status" na UI (a view já
  computa V%/m%/classeP, só faltava mostrar o porquê, que é literalmente o
  texto que `gerarDiagnostico()` do `agro-core` já produz).

---

## 6. Inteligência da carteira (`/app/inteligencia`, novo)

Consultas agregadas sobre `talhoes`/`analises`/`recomendacoes`, sem tabela
nova (ver decisão §2.4 do `PRODUCT_V2.md` sobre `cultura` como texto). Cada
item do pedido (§7) é uma consulta, não uma feature de schema:

- talhões com V% abaixo da meta / P baixo / K baixo → mesma lógica de
  `vw_talhao_situacao`, sem filtro de "última análise apenas" (aqui pode
  fazer sentido olhar todas as análises recentes, não só a última)
- maior incidência de deficiência → `count` sobre `diagnostico[].g = 'crit'`
  persistido em `recomendacoes.resultado` (jsonb) — dá para consultar com
  `jsonb` operators do Postgres, sem nova coluna
- produtores sem análise recente → `analises` mais recente por produtor,
  comparada a um limiar de dias
- área/volume por cultura, calcário/fertilizante estimado → soma de
  `recomendacoes.resultado->totais` (jsonb) agrupado por `talhoes.cultura`

Filtros (safra, cultura, município, produtor, propriedade, talhão) —
"safra" aqui, antes de `agro.safras` existir, filtra por intervalo de datas
livre (date range picker), não por safra nomeada.

---

## 7. Dashboard do Produtor (`/produtor`)

Hoje já tem o tom certo (linguagem simples, sem jargão técnico). Cresce
para incluir os cards que o pedido pede, todos derivados de dado que já
existe ou que nasce nas Fases 5–7:

```
Boa tarde, João.

[Minha propriedade: 42 ha]   [Culturas: Café Conilon, Pimenta-do-reino]

PRECISA DA SUA ATENÇÃO
• Aplicação recomendada para o Talhão 03.
• Seu agrônomo publicou uma nova recomendação.
• Visita técnica marcada para 27/09.        [depende da Fase 9 — agenda]
• Há uma análise de solo nova disponível.

Últimas recomendações        Próximas atividades
Resumo financeiro (Fase 6)   Produção atual (Fase 7)
Documentos recentes
```

"Resumo financeiro" e "Produção atual" só aparecem depois das Fases 6/7
existirem — antes disso, a home do produtor não regride (continua mostrando
o que já mostra hoje: situação dos talhões e última recomendação).

---

## 8. Sistema de design — o que existe, o que falta

### 8.1 Tokens (já definidos em `app/globals.css`, reaproveitar sem mudança)

`--papel/--papel-2/--papel-3` (fundo), `--tinta` (texto), `--grafite/--grafite-2`
(texto secundário), `--linha/--linha-forte` (bordas), `--folha/--folha-clara/--folha-escura`
(marca), escala de interpretação `--c-mb/--c-b/--c-m/--c-bom/--c-mbom` (a
"fita de pH" — reaproveitar como paleta semântica de status: crítico →
`--c-mb`, atenção → `--c-b`/`--c-m`, ok → `--c-bom`/`--c-mbom`), `--r/--r-p/--r-mini`
(raios), `--sombra/--sombra-alta`, tipografia via `--fonte`/`--mono`
(Archivo + IBM Plex Mono, `next/font`).

**Decisão:** não criar uma segunda paleta "de produto SaaS". A escala de
interpretação já é uma paleta semântica de status coerente com o domínio
(derivada da fita de pH, não genérica) — é exatamente o tipo de escolha que
o pedido pede em UX/UI (§22: "evitar interface genérica de template").
Reaproveitar para todo `StatusBadge` novo.

### 8.2 Componentes — mapa de reaproveitamento

| Pedido (§23) | Existe hoje | Ação |
|---|---|---|
| `PageHeader` | `CabecalhoVista` | Renomear conceito, manter implementação, talvez adicionar `breadcrumbs` prop |
| `MetricCard` | `Metrica` | Estender com variantes de cor semântica |
| `StatusBadge` | `Tag` | Formalizar variantes `critico/atencao/adequado/neutro` mapeadas às cores da fita de pH |
| `EmptyState` | `Vazio` | Reaproveitar como está |
| `DataTable` | Tabelas HTML manuais | **Novo** — componente genérico com ordenação/paginação, usado por toda lista nova (produtores, talhões, financeiro, produção) |
| `FilterBar`, `SearchInput` | Nada | **Novo** |
| `Timeline`, `ActivityItem` | Nada (dado existe em `audit_log`) | **Novo** |
| `ChartCard` | Nada, nenhuma lib de chart | **Novo**, depende de escolher/instalar Recharts |
| `SectionCard` | `Cartao` | Reaproveitar, talvez variante para conteúdo denso |
| `ProducerSelector`/`FarmSelector`/`PlotSelector` | Selects HTML simples espalhados pelos forms | **Novo** — combobox com busca, padrão único |
| `DateRangeFilter` | Inputs de data soltos | **Novo** |
| `NotificationCenter` | Nada | **Novo**, depende da tabela `notificacoes` (Fase 9) |
| `QuickCreate` ("+ Novo") | Nada — cada criação tem seu próprio botão em sua própria tela | **Novo** — menu global fixo no header |

### 8.3 Busca global / Command Palette (§17)

`Ctrl+K`, busca em produtores/propriedades/talhões/análises/recomendações.
Implementação proposta: **sem Postgres full-text search na primeira
versão** — as tabelas são pequenas por organização (dezenas a poucas
centenas de linhas); um `ilike` simples em 2-3 colunas por tabela, agregado
no cliente, atende bem e evita a complexidade de `tsvector`/índice GIN antes
de haver dado real para justificar. Reavaliar se a base crescer.

### 8.4 Mobile e PWA (§21, Fase 10)

Layout já quebra para 1 coluna em `max-width:520px` (grid `g2/g3/g4`).
Faltam: `manifest.json`, ícones, service worker (cache de shell da app),
e — o item mais caro do pedido — **modo offline para atividades de campo**.
Decisão de escopo: offline-first pleno (fila de escrita local + sync) é
grande demais para entrar junto com o resto; a Fase 10 entrega PWA
instalável + cache de leitura (páginas já visitadas funcionam offline para
consulta), e fila de escrita offline (registrar visita sem sinal) fica
como sub-fase explícita, só depois do formulário de visita existir de
verdade (Fase 9).

---

## 9. Onboarding (§24)

Hoje: `garantirEscritorio()` roda silenciosamente no primeiro acesso a
`/app` (cria org, semeia tabelas, cria assinatura trial) — não há
progresso visível, nem os passos 2-5 do pedido (cadastrar produtor/
propriedade/talhão/primeira análise). Proposta: um card persistente no
painel ("2 de 5 passos concluídos") que desaparece quando os 5 passos do
pedido são cumpridos, calculado por `exists` simples (tem produtor? tem
propriedade? tem talhão? tem análise?) — sem tabela nova, é estado
derivado, não persistido.

---

## 10. O que este documento deliberadamente não resolve

- Layout pixel-a-pixel de cada tela nova — fica para quando cada fase for
  implementada, com o componente real e dado real na mão.
- Biblioteca de mapa (adiada, §3).
- Realtime/WebSocket (adiado, §2.6 de `PRODUCT_V2.md`).
- Full-text search (adiado, §8.3).
