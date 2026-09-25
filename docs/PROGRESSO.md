# Progresso — passo a passo

Acompanha o roadmap de `AGROTECH.md` §13. Marca o que saiu do protótipo.
Decisões de virar produto vendável: `PRODUTO-VENDAVEL.md`.
Transformação em dois produtos (agrônomo + produtor): `PRODUCT_AUDIT.md` /
`PRODUCT_V2.md` / `UX_ARCHITECTURE.md` / `DATABASE_CHANGES.md` — as "fases"
dessa leva têm numeração própria (1–11 do pedido), diferente das fases
abaixo (que seguem o roadmap original de `AGROTECH.md`).

---

## AgroTech v2 — dois produtos, uma infra

**As 11 fases do roteiro pedido estão implementadas (concluído em
2026-09-24).** Central do Agrônomo e Portal do Produtor, cada um com
navegação própria, sobre a mesma infraestrutura (schema `agro`, RLS,
`agro-core`) — o princípio central do pedido original. O que fica de fora
por decisão deliberada, documentado em cada fase: fila de escrita offline
(Fase 10), permissão granular por papel (Fase 11), checkout Asaas nunca
testado contra conta real (Fase 11), `pgTAP`/`supabase test db` nunca
rodado (falta de Docker neste ambiente). Site em produção, banco real
migrado, deploy e migrations automáticos a cada push — ver entradas
"Deploy em produção" e "autoalimentável" abaixo.

**Achado ao validar o deploy da Fase 11 em produção (2026-09-24):** os
smoke tests de `curl` desde a Fase 6 vinham batendo numa URL de
**deployment antiga e congelada** do Vercel (`agrotech-f206ibkos-...`) —
cada deploy novo no Vercel ganha uma URL própria; só a alias
`agrotech-git-main-thgustavo62-designs-projects.vercel.app` (ou um
domínio de produção configurado) sempre aponta pro deploy mais recente.
Confirmando contra a URL certa, achei um bug real de verdade: o
middleware usava `caminho.startsWith('/app')`, que também batia em
`/apple-icon` (o ícone do iOS, criado na Fase 10) — o navegador pedia
`/apple-icon`, o middleware achava que era rota do consultor, e
redirecionava pro login mesmo sem precisar de sessão. Corrigido
conferindo limite de segmento (`== '/app'` ou `startsWith('/app/')`),
commit `cb4845b`. **Lição pro resto do projeto: sempre testar contra a
URL alias/produção, nunca contra uma URL de deployment específico** — ela
para de refletir a realidade assim que o próximo deploy sai.

**Auditoria pedida pelo Gustavo — "erros nas criações dos produtores"
(2026-09-24).**
Rodei um agente de investigação (só leitura) sobre o fluxo de criar
produtor inteiro — form, server action, RLS, trigger — e sobre padrões
parecidos com o bug do `/apple-icon`. Achou duas causas reais, ligadas:
1. **O app não tinha nenhum `error.tsx`.** Toda `server action` deste
   projeto lança `Error` puro em validação (ex.: "Informe o nome do
   produtor.") — sem um error boundary, qualquer erro (validação, RLS,
   trigger do banco) virava a tela de erro genérica e ilegível do Next,
   em vez de mostrar a mensagem de verdade perto do formulário. Corrigido
   com `components/erro-view.tsx` + `app/error.tsx` +
   `app/global-error.tsx` + `app/(consultor)/app/error.tsx` +
   `app/(produtor)/produtor/error.tsx` (cada um com o botão "Tentar de
   novo" e o `voltarHref` certo pro contexto).
2. **O trial de 14 dias da organização provavelmente já tinha vencido.**
   `checar_limite()` (0013) bloqueia insert em produtores/talhões/
   documentos quando `trial_expira_em < now()` — mas nada muda a coluna
   `status` sozinho (não existe cron nenhum pra isso), então
   `/app/assinatura` continuava mostrando a tag "período de teste" pra
   sempre, sem sinalizar que o cadastro já estava travado. Com o achado
   #1, esse erro aparecia como tela quebrada, não como aviso claro.
   `0026_mensagem_limite_e_trial.sql`: reescreve a mensagem do trigger
   pra diferenciar trial vencido de assinatura suspensa/cancelada, e
   **estende 30 dias o trial de qualquer org já vencida** (ação
   operacional pontual, não um cron — suspender quem ainda nem validou o
   checkout do Asaas seria pior que não suspender). `/app/assinatura`
   ganhou a tag "teste vencido" e o aviso de bloqueio também pro caso de
   trial expirado, que antes só cobria `suspensa`/`cancelada`.

Achados secundários do mesmo agente, também corrigidos por precaução (sem
bug confirmado, mesmo padrão de risco do `/apple-icon`): `path.startsWith(href)`
pra destacar item de menu ativo em `barra-mobile.tsx`, `lateral-consultor.tsx`
e `nav-produtor.tsx` — unificado num helper só, `rotaAtiva()` em
`lib/navegacao.ts` (limite de segmento, mesmo raciocínio do middleware).
E o bypass de auth pra `/demo` no middleware ganhou o mesmo cuidado
(`/r/` já era seguro, já tinha barra no fim).

- [x] **Auditoria + plano** (`PRODUCT_AUDIT.md`, `PRODUCT_V2.md`,
      `UX_ARCHITECTURE.md`, `DATABASE_CHANGES.md`) — inventário verificado do
      código real, decisões de arquitetura, roadmap nas 11 fases pedidas,
      migrations `0019–0023` propostas (não escritas).
- [x] **Fase 4 do pedido — Visão 360º do talhão** (`/app/talhoes/[id]`) —
      maior lacuna estrutural identificada na auditoria, agora existe.
      Header com situação/status; abas: **Visão geral** (métricas + dados de
      cadastro), **Solo & Nutrição** (fundido de propósito — reaproveita
      `InterpretacaoView` inteira, que já cobre as duas coisas juntas),
      **Histórico** (linha do tempo mesclando análises + recomendações +
      visitas, ordenada por data), **Recomendações** (persistidas, com link
      pro laudo), **Monitoramento** (visitas e ocorrências), **Fotos**
      (signed URLs do bucket `visitas`), e **Custos**/**Produção** como
      estado vazio explícito apontando para as migrations `0019`/`0020`
      propostas (ainda não existem). Componente novo reutilizável:
      `components/abas-paineis.tsx` (abas de conteúdo dentro da página,
      client-side, state local — diferente de `nav-abas.tsx`, que navega
      entre rotas). Linkado a partir de `/app/talhoes` e da tabela de
      talhões em `/app/produtores/[id]`.
- [x] **Pré-requisito transversal — validado contra Supabase real (2026-09-23).**
      Gustavo passou a connection string de um projeto Supabase real
      (vazio) e o repositório GitHub `thgustavo62-design/Agrotech`. `npx
      supabase db push --db-url` (não precisa de Docker — só `supabase
      start`/dev local precisa) rodou as 20 migrations e achou 2 bugs reais,
      **nunca antes executados com sucesso em lugar nenhum**, corrigidos nos
      próprios arquivos: `unaccent()` é `STABLE` não `IMMUTABLE`
      (`nome_norm` em `0002` não compilava — corrigido com o envelope
      `agro.unaccent_imutavel()`), e `0012_tenancy.sql` tentava `drop
      function talhao_na_minha_org` antes de derrubar as políticas que
      ainda dependiam dela (`2BP01` — reordenado). As 20 migrations agora
      rodam limpo do zero. `supabase test db` (pgTAP) ainda não rodou —
      depende do runner local via Docker, que este ambiente não tem.
      Repositório conectado como `origin` (estava vazio, sem risco de
      sobrescrever nada). Credenciais só em `supabase/.env`/`.env.local`
      (gitignored), nunca commitadas.
- [x] **Deploy em produção no Vercel (2026-09-23).** `apps/web/.env.local` e
      `.env.local` (raiz) apontados pra API real do Supabase (`NEXT_PUBLIC_SUPABASE_URL`
      + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, a publishable key nova do formato
      `sb_publishable_...`). Três problemas de configuração do projeto Vercel
      (nenhum era bug de código, exceto o 2º) resolvidos:
      1. **Root Directory** vazio → setado pra `apps/web` (Vercel buildava a
         partir da raiz do monorepo, que não tem `next.config.js`).
      2. **Bug real**: `apps/web`'s "build" script era só `next build` — não
         buildava `@agrotech/agro-core` antes, e esse pacote aponta pro
         `dist/` (`main`/`exports` do `package.json`), que só existe depois
         de `tsc` rodar. Localmente sempre rodei os dois builds à mão (rotina
         de todo phase desta sessão); no Vercel isso nunca acontecia, porque
         com Root Directory=`apps/web` ele só roda o script do workspace web,
         não o script da raiz (`npm run build --workspaces`, que builda
         `packages/*` antes de `apps/*` por causa da ordem em
         `workspaces`). Corrigido deixando o próprio script "build" do
         `apps/web` autossuficiente: `cd ../.. && npm run build --workspace
         @agrotech/agro-core && cd apps/web && next build` (commit `d6631b5`).
      3. **Framework Preset** estava em "Other" → trocado pra "Next.js" no
         painel (causava o erro `No Output Directory named "public"` — sem
         o preset certo, o Vercel cai no fallback de site estático em vez de
         usar `.next`).
      Também precisou desligar o **Deployment Protection** (SSO da Vercel),
      que bloqueava qualquer acesso não autenticado — inclusive dos usuários
      reais do produto, não só de mim testando. Smoke test em produção
      (`curl`) confirma o mesmo padrão de redirecionamento 307/200 validado
      localmente o resto da sessão.
- [x] **Achado crítico — schema `agro` nunca esteve exposto na Data API
      (2026-09-24).** O smoke test de `curl` acima só confere status HTTP de
      página (redirect/200) — não prova que uma página com dado real
      funciona. A pedido do Gustavo ("confira se está tudo interligado"),
      testei direto o REST endpoint (`Accept-Profile: agro`) e voltou
      `PGRST106 — Invalid schema: agro. Only the following schemas are
      exposed: public, graphql_public`. **Isso significa que, apesar do
      banco, das migrations e do deploy estarem todos certos, nenhuma tela
      do site conseguia buscar dado nenhum desde o primeiro deploy** — é uma
      configuração do painel (Project Settings → Data API → Exposed
      schemas), separada de tudo que git/migration cobre, e por isso nunca
      apareceria em nenhum dos testes rodados até aqui (build, tsc, smoke
      test de redirect). Gustavo habilitou `agro` na lista pelo painel;
      reconfirmei com uma chamada real à RPC pública
      `resultados_por_token` (schema `agro`, via `Content-Profile: agro`) —
      voltou `200 OK` com o corpo esperado (`null` pro token de teste). Essa
      configuração não é gerenciável por migration/CLI neste ambiente —
      **é um passo manual que precisa ser lembrado em qualquer novo projeto
      Supabase** (staging, ou se o projeto for recriado).
- [x] **Pipeline "autoalimentável" ponta a ponta confirmado (2026-09-24).**
      Gustavo pediu explicitamente a automação GitHub↔Vercel↔Supabase.
      `deploy-supabase.yml` (commit `4e8c555`) rodou com sucesso no
      GitHub Actions do repositório certo (run #5, "Success", 14s) depois de
      cadastrar o secret `SUPABASE_DB_URL`. No caminho, a senha do Postgres
      foi resetada pelo painel do Supabase (Project Settings → Database →
      Reset database password — o popup de "salvar senha" que apareceu por
      cima era do **navegador**, não do Supabase, e gerou confusão com
      senhas erradas por um tempo). Senha nova só existe em
      `supabase/.env` (gitignored) e no secret do GitHub — nunca commitada.
      Fluxo confirmado: push no GitHub → Vercel builda/publica sozinho
      (Git integration nativa) **e** GitHub Actions aplica migration nova
      sozinho no Supabase (`supabase/migrations/**` como trigger). Resetar
      a senha do Postgres não quebra o app em produção — ele fala com o
      Supabase pela API (anon key), não por conexão direta ao banco.
- [x] **Fase 1 do pedido — navegação agrupada** — sidebar (desktop, ≥960px) com
      4 grupos (Visão geral / Gestão técnica / Inteligência / Gestão), colapsável
      (`lateral-consultor.tsx`, estado em `localStorage`); barra inferior no
      mobile com os 5 itens mais usados + "Mais" abrindo gaveta com o resto
      (`barra-mobile.tsx`); breadcrumbs estruturais que pulam segmentos de uuid
      (`breadcrumbs.tsx`); paleta de comandos `Ctrl/Cmd+K` buscando produtores/
      propriedades/talhões por `ilike` (`paleta-comandos.tsx`, sem full-text
      search — ver `UX_ARCHITECTURE.md §8.3`). `nav-abas.tsx` removido (as abas
      horizontais viravam a sidebar). Ícones próprios em `components/icones.tsx`
      (SVG de linha, sem lib nova). Fonte única do menu: `lib/navegacao.ts`.
      Todo item do menu é um link de verdade, mesmo os "em breve" — a página de
      destino explica o que falta, em vez de item de menu morto.
    - Três telas novas viraram reais no processo (dado já existente, sem
      schema novo): `/app/pendencias` (recorte do painel), `/app/propriedades`
      (lista com link pro produtor), `/app/recomendacoes` (lista com link pro laudo)
    - Seis telas novas são placeholder "em breve" com explicação e link pra
      fase certa: `/app/agenda`, `/app/inteligencia`, `/app/relatorios`,
      `/app/financeiro-escritorio`, `/app/equipe`, `/app/config`
    - **Exceção:** `/app/config` ganhou uma função real além do placeholder —
      editar nome/CREA/ART/telefone do próprio consultor (`profiles_atualiza_proprio`
      já cobria isso por RLS, só faltava a tela). Renomear o escritório
      (`orgs.nome`) continua sem UI — não há política de UPDATE em `orgs` hoje.
- [x] **Fase 2 do pedido — Central Operacional** (`0018_painel_v2.sql` + `/app`
      reescrito). `painel_consultor()` ganhou, sem quebrar contrato com quem já
      a chamava (`create or replace`, mesma assinatura): `visitas_atrasadas`
      (lista + total, a partir de `visitas.proxima_visita` — não há
      `agenda_eventos` ainda), `proximas_visitas`, `recomendacoes_pendentes`
      (análises sem recomendação emitida, lista + total),
      `recomendacoes_emitidas_mes`, `produtores_sem_visita_recente` (60 dias),
      `talhoes_sem_analise_atualizada` (180 dias), e **`atividade_recente`**
      lendo `audit_log` — que finalmente ganhou um consumidor de UI (dívida
      técnica #2 de `PRODUCT_AUDIT.md`). A tela virou: 2 fileiras de métricas
      (o que pede atenção / visão geral), **"Precisa da sua atenção"**
      mesclando os 4 tipos de pendência em prioridade (crítico > atrasado >
      recomendação pendente > próxima visita), Área por cultura (mantido) e
      Atividade recente (novo, timeline com rótulos em português + link pra
      cada evento). `analises/nova/acoes.ts` (`criarAnalise`) ganhou uma
      chamada a `registrar()` que faltava — sem isso a timeline não veria
      análises lançadas manualmente.
- [x] **Fase 3 do pedido — Visão 360º do produtor** (`/app/produtores/[id]`
      reescrito em abas, mesmo padrão de `abas-paineis.tsx` da Fase 4). Header
      fora das abas: nome/contato, tag de situação agregada (pior caso entre
      os talhões: precisa de correção > fósforo baixo > em ordem > sem
      análise), métricas (culturas/talhões/área/análises), última/próxima
      visita. Nove abas: **Resumo** (alertas, área por cultura, últimas
      análises com seta de tendência ▲/▼/– comparando com a coleta anterior do
      mesmo talhão — substituto honesto e sem dependência nova para o
      "gráfico de evolução do solo" do pedido, já que Recharts é não-objetivo
      declarado em `PRODUCT_V2.md`), **Propriedades**, **Talhões** (agrupado
      por cultura, com um único `resumos` pré-computado por talhão em vez de
      recalcular `calcular()` por linha), **Análises** (lista achatada de
      todos os talhões do produtor), **Recomendações** (`agro.recomendacoes`
      filtrado por `produtor_id`, denormalizado desde `0012`), **Visitas**
      (`agro.visitas` por `talhao_id`, hoje vazio — não existe formulário de
      registrar visita, achado já registrado em `PRODUCT_AUDIT.md`),
      **Documentos** (`agro.documentos` por `produtor_id`), **Acesso**
      (desvio deliberado da lista de 9 abas do pedido: agrupa links de
      resultados + convite de portal + zona de risco LGPD, que já existiam e
      não mapeiam limpo pra nenhum nome do pedido — preferível a espalhar ou
      forçar dentro de "Resumo"), **Linha do tempo** (novo: junta os ids do
      produtor + talhões + análises + recomendações + documentos + visitas e
      consulta `audit_log` uma vez por todos). **Sem aba Financeiro** — o
      pedido já condiciona essa aba ao opt-in do produtor, e o schema
      `financeiro_*` de `DATABASE_CHANGES.md` ainda não existe; melhor omitir
      que simular. Extraído para reaproveitar entre painel e produtor:
      `lib/atividade.ts` (rótulo + link de `audit_log`) e `lib/documentos.ts`
      (rótulo de status de `agro.documentos`) — `/app` e `/app/laudos`
      passaram a importar dali em vez de duplicar.
- [x] **Fase 6 do pedido — Financeiro do produtor** (`0019_safras.sql` +
      `0020_financeiro.sql`, primeiras migrations novas desde a auditoria além
      de `0018`). Schema: `financeiro_categorias` (16 padrão semeadas via
      `semear_categorias_financeiras()`, mesmo padrão do `garantirEscritorio()`
      do onboarding), `financeiro_centros_custo`, `financeiro_contas`,
      `financeiro_lancamentos` (receita/despesa, status
      pendente/pago/atrasado/cancelado, comprovante opcional), `financeiro_orcamentos`.
      **Isolamento total por decisão de produto** (`PRODUCT_V2.md §2.2`):
      nenhuma tabela `financeiro_*` tem política de consultor — nem leitura —
      só `produtor_id = jwt_produtor()`. Bucket de Storage `financeiro` novo
      (não estava na proposta original, adicionado para o comprovante ter
      algo de verdade por trás — ver divergência anotada em
      `DATABASE_CHANGES.md`). `agro.safras` nasceu junto (pré-requisito de
      `safra_id` em lançamento/orçamento) mas só a tabela — `producao_registros`
      continua proposta, fica para quando a Fase 7 for implementada de fato.
    - Tela nova `/produtor/financeiro` (abas: Resumo, Lançamentos, Contas &
      categorias, Orçamento). Orçamento compara ao gasto pago no ano civil —
      sem seletor de safra ainda (chega com a Fase 7); o valor planejado é
      só por categoria por enquanto.
    - `/produtor` ganhou o card "Resumo financeiro" (saldo + pendências,
      linkando pro financeiro) citado em `UX_ARCHITECTURE.md §7`.
    - Como a Fase 5 (dashboard/menu do produtor) ainda não foi implementada,
      não existe o menu de 7 itens que `UX_ARCHITECTURE.md §1.2` desenha —
      criei só um nav mínimo de 2 itens (Início/Financeiro) no header do
      portal, o suficiente pra não deixar `/produtor/financeiro` orfão.
      Os outros 5 itens do menu (Fazenda, Talhões, Recomendações,
      Atividades, Produção, Documentos) continuam não existindo até que
      suas fases cheguem.
    - Sem feature flag de plano: `planos.features.financeiro` é da Fase 11
      (`0023`, ainda proposta) — por ora todo produtor autenticado vê o
      financeiro, independente do plano do escritório.
    - Novo em `lib/`: `financeiro.ts` (rótulos de status, `statusEfetivo()` —
      calcula "atrasado" na hora da leitura, já que não há job de fundo
      mudando o status gravado — e `resumoFinanceiro()`, reaproveitado pelo
      card do dashboard) e `moeda()` em `formato.ts`. `produtorAtual()` novo
      em `lib/supabase/server.ts` (id de `agro.produtores` do usuário logado).
- [x] **Fase 5 do pedido — Dashboard do produtor** (2026-09-24). Menu simples
      de 8 itens (`components/nav-produtor.tsx`, "sem grupos" por decisão de
      `UX_ARCHITECTURE.md §1.2` — público predominante no celular, menos
      hierarquia): Início, Minha fazenda, Talhões, Recomendações, Atividades,
      Financeiro, Produção, Documentos — substitui o nav mínimo de 2 itens
      que a Fase 6 tinha deixado provisório. Quatro telas novas reais:
      `/produtor/fazenda` (propriedades com talhões aninhados),
      `/produtor/talhoes` (situação de todos, via `vw_talhao_situacao`),
      `/produtor/recomendacoes` (histórico completo, link pro laudo),
      `/produtor/documentos` (laudos em PDF com link assinado direto pro
      Storage). Duas em "em breve" (`atividades`, `producao` — Fases 9 e 7).
      `/produtor` (painel) ganhou saudação por hora do dia (calculada em
      `America/Sao_Paulo` explicitamente — servidor roda em UTC),
      "Precisa da sua atenção" mesclando talhão crítico + recomendação nova
      (≤14 dias) + laudo novo (≤14 dias), e as fileiras "Últimas
      recomendações"/"Documentos recentes" do mockup de `UX_ARCHITECTURE.md
      §7` — mantém o resumo financeiro (Fase 6) e a lista de situação
      (recortada a 6 + link pra `/produtor/talhoes`).
    - **Achado de RLS construindo esta fase**: `agro.documentos` nunca teve
      política de leitura pro produtor (só `documentos_consultor`) — o
      `GRANT` de tabela já cobria (`0017`, blanket), só faltava a policy.
      Sem isso, `/produtor/documentos` sempre voltaria vazio mesmo com dado
      no banco — corrigido com `0021_documentos_produtor.sql`, aplicada no
      Supabase real. As migrations propostas que restavam em
      `DATABASE_CHANGES.md` (Agenda/Notificações/Planos) foram renumeradas
      de `0021`–`0023` pra `0022`–`0024`, mesma disciplina da vez que `0018`
      virou real.
- [x] **Fase 7 do pedido — Produção e safra** (`0022_producao.sql`, 2026-09-24).
      `agro.producao_registros` (o resto do que `0019` tinha deixado só como
      `agro.safras`). **Corrigiu de verdade a lacuna de RLS que a proposta
      original deixava aberta**: a política de leitura do consultor
      desenhada em `DATABASE_CHANGES.md` era um `select` de linha inteira,
      que exporia `preco_medio`/`receita_obtida` também — contradizendo a
      própria decisão #2 do documento ("campos comerciais continuam só do
      produtor"). RLS não filtra coluna, só linha; a correção foi tirar essa
      política da tabela base e criar `agro.producao_visivel_consultor()`
      (function `security definer`, mesmo padrão de `painel_consultor()`/
      `casar_produtor()`) que nem seleciona as colunas comerciais no
      retorno — o consultor não vê preço/receita porque a query nunca busca
      essas colunas, não porque uma policy "esconde" depois.
    - `/produtor/producao` (novo, real): lançar produção por talhão/safra
      (receita calculada automaticamente se não informada — realizada ×
      preço médio), agrupado por safra com % de atingimento, + criação
      rápida de safra inline (ainda não existe uma tela dedicada de gestão
      de safras — fica pra quando fizer falta).
    - Aba **Produção** de `/app/talhoes/[id]` (consultor) deixa de ser
      placeholder: mostra prevista×realizada via a function acima.
    - Aba **Custos** do mesmo talhão teve a mensagem reescrita — não é mais
      "ainda não existe" (`financeiro_lancamentos` já existe desde a Fase
      6), e sim "não é visível pra você, por padrão": isolamento total do
      financeiro do produtor é decisão de design (`PRODUCT_V2.md §2.2`),
      não uma lacuna de implementação a preencher depois.
- [x] **Fase 8 do pedido — Inteligência e relatórios** (2026-09-24). Sem
      schema novo, como `UX_ARCHITECTURE.md §6` já previa — tudo consulta
      sobre `talhoes`/`analises`/`recomendacoes` existentes.
    - `/app/inteligencia` (deixa de ser placeholder): talhões fora da meta
      (V/m fora do alvo da cultura, fósforo baixo, **potássio baixo** — item
      que nem o painel nem a visão 360º cobriam ainda), deficiências mais
      comuns (conta `resultado.diagnostico[].g = 'crit'` de toda recomendação
      da org, sem coluna nova), produtores sem análise recente (>180 dias,
      mesmo limiar de `painel_consultor()`, mas aqui com a lista, não só a
      contagem), e área/calcário/fertilizante estimado por cultura (soma de
      `resultado.totais`, já calculado em cada laudo — não é reestimativa).
      Reaproveita o padrão "busca tudo, computa no JS" da Fase 3 (produtor
      360) em vez de nova function no banco — mesmo raciocínio de manter o
      motor (classificação) só em `agro-core`, nunca duplicado em SQL.
      Filtro por cultura (abas, mesmo padrão de `/app/analises`); filtro por
      safra/período fica pra quando fizer sentido — carteira inteira não tem
      uma "safra" comum entre produtores diferentes.
    - `/app/relatorios` (deixa de ser placeholder): relatório A4 imprimível
      (reaproveita `.folha-a4` + `BotaoImprimir`, mesmo padrão do laudo) com
      visão geral + área por cultura, e exportação **CSV** da carteira
      inteira (`/app/relatorios/carteira.csv`, route handler no mesmo
      padrão de `/app/produtores/[id]/exportar`) — um talhão por linha,
      pronto pra abrir em planilha.
    - `lib/navegacao.ts`: tirei `embreve: true` de Indicadores/Relatórios
      (não tirei de `/app/config`, que já estava assim antes desta fase e é
      inconsistência pré-existente, fora de escopo).
- [x] **Fase 9 do pedido — Agenda e notificações** (`0023_agenda.sql` +
      `0024_notificacoes.sql`, 2026-09-24). Carrega também o **débito
      técnico #4 do audit**, como `PRODUCT_V2.md §3` já avisava que essa
      fase precisaria: o formulário de registrar visita, que nunca existiu
      no app (só leitura de `agro.visitas`).
    - **`agro.agenda_eventos`** — separada de `agro.visitas` de propósito
      (decisão #4 de `DATABASE_CHANGES.md`): agenda é antes do fato,
      visita é depois. `/app/agenda` (deixa de ser placeholder): agendar
      (tipo/título/data/hora/produtor/talhão opcionais), lista agrupada em
      atrasados/hoje/próximos 7 dias/depois, concluir/cancelar, histórico
      recente. Simplificação assumida: concluir um evento tipo "visita"
      não vincula automaticamente a uma linha de `visitas` — ficam
      registrados em telas separadas por enquanto.
    - **Formulário de registrar visita** — aba Monitoramento de
      `/app/talhoes/[id]` ganhou o form de verdade (data, fenologia,
      condição, observações, recomendação de campo, próxima visita, até
      3 ocorrências fixas — sem lista dinâmica, simplificação deliberada;
      a maioria das visitas registra poucos alvos).
    - **`agro.notificacoes`** — tabela + `select` normal com RLS por
      destinatário, **sem Realtime** nesta primeira versão (decisão
      `PRODUCT_V2.md §2.6`: "badge que revalida no carregamento de
      página"). Dois gatilhos reais (dos vários que a proposta original
      deixava como exemplo a implementar quando fizesse falta):
      `notificar_nova_recomendacao()` (como proposto) e
      `notificar_visita_agendada()` (novo — dispara quando um evento de
      agenda tipo "visita" com produtor definido é criado). Sino
      (`components/sino-notificacoes.tsx`, contagem de não lidas) no
      cabeçalho dos dois lados — `/app/notificacoes` e
      `/produtor/notificacoes`, mesmo padrão de lista + marcar lida(s).
    - `/produtor` ganhou o bullet "Visita técnica marcada para..." que o
      mockup de `UX_ARCHITECTURE.md §7` já previa, mas ficava marcado como
      dependente desta fase.
    - `lib/navegacao.ts`: tira `embreve` de Agenda.
- [x] **Fase 10 do pedido — PWA e polimento mobile** (2026-09-24). Escopo
      deliberado, como `UX_ARCHITECTURE.md §8.4` já definia: PWA instalável
      + cache de leitura de páginas já visitadas — **não** fila de escrita
      offline (registrar visita sem sinal fica pra quando fizer falta de
      verdade; é maior que cabe numa fase de polimento). Sem migration,
      sem dependência nova (nenhum `next-pwa`/Workbox — service worker
      escrito à mão, consistente com o resto do projeto).
    - `app/manifest.ts` (convenção do Next, serve em `/manifest.webmanifest`,
      link injetado automaticamente no `<head>`) + `app/icon.tsx`/
      `app/apple-icon.tsx`/`app/icones-pwa/[size]/route.tsx` — ícones
      gerados sob demanda com `ImageResponse` (`next/og`), sem nenhum
      arquivo binário no repo; mesma marca (losango) de `.marca::before`
      em `globals.css`.
    - `app/sw.js/route.ts` — service worker servido como route handler
      (sem precisar de pasta `public/`). Estratégia: rede primeiro,
      grava no cache a cada resposta 200 same-origin; offline, serve do
      cache o que já foi visitado, ou `/offline` (novo, página estática)
      pra navegação nunca vista. Versionado (`agrotech-cache-v1`) — nunca
      serve JS/CSS velho por cima de build novo enquanto houver sinal.
    - `components/registrar-sw.tsx` registra o SW no layout raiz.
      `viewport`/`metadata` ganharam `themeColor` e `appleWebApp`.
    - Layout responsivo (grid quebra em `max-width:520px`) já existia
      desde antes desta fase — não foi retrabalhado.
- [x] **Fase 11 do pedido — Planos SaaS** (`0025_planos_features_e_papeis.sql`,
      2026-09-24). **Última fase do roteiro de 11 — as 11 estão implementadas.**
    - `planos.features` (jsonb) + `usuarios_max`. **Divergência deliberada**:
      todos os planos nasceram com `financeiro`/`relatorios_avancados` em
      `true` — a organização em uso hoje já testa as duas telas ativamente
      há várias fases; travar alguma delas numa migration sem pedido
      explícito quebraria o que já funciona. A infraestrutura de gating
      está real e testada nas duas telas que ela protege
      (`/produtor/financeiro`, `/app/relatorios` + `carteira.csv`); só não
      está restringindo nada ainda. Decidir o que vira premium é decisão
      comercial de quem vende o software — um `update agro.planos set
      features = ...`, sem tocar em código.
    - `agro.tenho_feature(text)` — function nova (fora da proposta
      original) que faltava pra fechar o gating de verdade: `agro.assinaturas`
      só tem política de leitura pra consultor/admin (0013), e sem essa
      function o **produtor** não teria como checar se o financeiro do
      escritório dele está habilitado. `components/precisa-upgrade.tsx`
      é a tela mostrada no lugar de um recurso que o plano não inclui —
      com ou sem botão "Ver planos" dependendo de quem pode de fato mudar
      o plano (só consultor/admin).
    - Papéis novos (`proprietario/tecnico/assistente`) no `check` de
      `profiles.role` + coluna `titulo` — só o schema, como
      `PRODUCT_V2.md §2.3` já decidia (permissão granular por papel fica
      pra quando existir caso de uso real; `/app/equipe` continua "em breve").
    - `/app/assinatura` ganhou botão "Assinar" por plano — gera um link de
      checkout recorrente no Asaas (`paymentLinks`, cobrança mensal) e
      redireciona pra lá; o `webhook-asaas` (já existente desde o "produto
      vendável") recebe a confirmação. **Nunca testado contra uma conta
      Asaas real** — este ambiente não tem credencial (`ASAAS_API_KEY`).
      Sem a chave configurada, o botão explica isso com uma mensagem clara
      em vez de fingir que funciona — mesmo padrão de degradação já usado
      no envio de e-mail de convite (`RESEND_API_KEY` opcional).

---

## Redesign visual + novas funcionalidades (mapa, histórico, kanban)

Gustavo mandou 5 prints de um dashboard de referência e pediu visual mais
rico + funcionalidades novas, terminando com auditoria própria — ver plano
completo em `C:\Users\Seu Computador\.claude\plans\zany-noodling-kazoo.md`.
Decisões confirmadas com ele antes de começar: visual completo estilo dos
prints (não só evolução do atual); sem foto de banco de imagem (ilustração/
gradiente próprio); sem clima (precisaria de API key); mapa completo mesmo
sem contorno real cadastrado; histórico de métricas começa a ser guardado
agora, sem inventar "+X%" antes de existir dado de verdade.

- [x] **Sub-fase A — Fundação visual.** `components/banner-hero.tsx` (banner
      decorativo, gradiente + padrão SVG próprio — sem foto de terceiro),
      `components/avatar-usuario.tsx` (iniciais, sem upload de foto nesta
      rodada), `Metrica` (`components/ui.tsx`) ganhou `icone`/`tendencia`
      opcionais e 100% retrocompatíveis (toda chamada antiga continua
      igual). Avatar no cabeçalho dos dois layouts (consultor/produtor).
- [x] **Sub-fase B — Histórico de métricas.** `agro.metricas_diarias` +
      `agro.registrar_metricas_hoje()` (`0027_metricas_diarias.sql`) —
      upsert idempotente a cada carregamento de `/app`, sem cron. `/app`
      compara com a snapshot de ~25-30 dias atrás; sem base anterior,
      **omite a tendência** (nunca mostra "+0%" nem inventa número).
- [x] **Sub-fase C — Mapa.** Dependência nova: `leaflet` + `react-leaflet@5`
      (única lib nova do front além das já existentes) — tiles OpenStreetMap,
      sem API key. `components/mapa-propriedades.tsx`: marcador por
      propriedade via `propriedades.lat/lng` (existia desde `0002`, nunca
      usado em UI); polígono de `talhoes.geom` quando existir — hoje nenhum
      registro tem, cai pro marcador simples (biblioteca pronta, falta só o
      dado). Embutido em `/app/propriedades`, aba "Mapa" ao lado de "Lista"
      (`AbasPaineis`, mesmo componente da Visão 360º).
- [x] **Sub-fase D — Kanban.** `/app/agenda` ganhou aba Kanban com
      **drag-and-drop de verdade** (`components/kanban-agenda.tsx`, HTML5
      DnD nativo, sem lib nova) — soltar num card chama `moverEvento(id,
      novaData)` (`agenda/acoes.ts`), só um `update`. Fecha o que
      `DATABASE_CHANGES.md` já previa pra essa tela. `/app/pendencias`
      ganhou aba Kanban **só leitura** (`components/kanban-pendencias.tsx`
      — classificação crítico/atenção/programado é derivada da análise, não
      editável à mão) e passou a mostrar as 3 categorias completas (antes só
      mostrava "crítico" — mesma lógica de `atencao` já usada em `/app`).
- [x] **Sub-fase E (núcleo) — Visual aplicado nas telas de maior uso.**
      `/app` (painel, com tendência real quando houver histórico),
      `/app/produtores`, `/app/propriedades`, `/app/talhoes`, `/produtor`
      (dashboard do portal) — todas com `BannerHero` + `Metrica` com ícone.
- [x] **Sub-fase E (continuação) — resto das telas de lista/dashboard.**
      `/app/analises`, `/app/laudos`, `/app/monitoramento` (e corrigi de
      passagem um texto desatualizado: o botão dizia "Registrar visita
      (Fase 5)" e ficava sempre desabilitado — a Fase 9 já tinha
      construído esse formulário de verdade dentro do talhão; troquei o
      botão morto por um link "abrir talhão" em cada item da lista),
      `/app/recomendacoes`, `/app/tabelas`, `/app/notificacoes`,
      `/app/config`, `/app/inteligencia`, `/app/assinatura`, e do lado do
      produtor: `/produtor/documentos`, `/produtor/fazenda`,
      `/produtor/notificacoes`, `/produtor/producao`,
      `/produtor/recomendacoes`, `/produtor/talhoes`,
      `/produtor/financeiro`. `/app/relatorios` ficou de fora de propósito
      — o cabeçalho dali precisa ficar escondido na impressão
      (`nao-imprime`), e `BannerHero` ainda não tem esse comportamento;
      só removi o import de `CabecalhoVista` que tinha ficado morto lá.
      **Continuam no padrão anterior, por decisão de escopo — telas de
      formulário/edição** (`analises/nova`, `laudos/novo`, `laudos/[id]`,
      `produtores/nova`, `produtores/[id]/editar`, `talhoes/[id]/editar`)
      **e as duas visões 360º** (`produtores/[id]`, `talhoes/[id]` — já
      têm cabeçalho com `Tag`/ações próprias, trocar exige mais cuidado
      pra não perder nada) — um banner grande de decoração não combina
      com tela de digitar dado; formulário pede objetividade, não drama
      visual. `demo/tabelas` (vitrine pública) também ficou fora.
- [x] **Sub-fase E (fotos reais) — reverte a decisão de "sem foto".**
      Gustavo pediu explicitamente ("quero que utilize imagens") depois de
      ver o resultado só-gradiente. Usei o **Pexels** (licença comercial
      livre, sem exigência de crédito, confirmada em pexels.com/license) —
      3 fotos baixadas pra `apps/web/public/banners/`: `campo-aereo.jpg`
      (área rural aérea, lado consultor), `vale-verde.jpg` (vale verde,
      portal do produtor), `cafe-cereja.jpg` (cereja de café, telas de
      análise/laudo). `BannerHero` ganhou o prop opcional `imagem` — com
      foto, aplica um gradiente verde da marca por cima
      (`rgba(11,72,52,.90)…`) pra manter o texto legível; sem foto, cai no
      padrão SVG antigo (nenhuma tela ficou sem opção). Prop conectado nas
      22 telas que já usavam `BannerHero`. Commit `d8e2555`.

---

## Nova marca + telas de login/cadastro (2026-09-25)

Gustavo mandou um mockup de referência (tela de login/cadastro dividida:
foto + lista de recursos à esquerda, cartão de formulário com abas Entrar/
Criar conta à direita) e uma nova logo (folha) gerada por IA, pedindo pra
seguir esse visual "em tudo" e usar banco de imagens gratuitas.

- [x] **Marca nova (recriada à mão, versão inicial).** Enquanto o PNG da
      logo não estava disponível como arquivo (só colado no chat, sem
      caminho extraível neste ambiente), recriei o motivo "folha" como um
      SVG próprio desenhado à mão em `components/logo.tsx`.
- [x] **Marca nova (logo real, versão final).** Gustavo colocou os dois
      PNGs em `Downloads/` e pediu pra extrair e usar de verdade. Como o
      `sharp` já está disponível (dependência do Next.js), rodei um script
      único (`extrair-logo.js`, descartado depois de usar) que recorta só a
      região do ícone (sem a palavra "AgroTech"), corta as bordas até o
      conteúdo (`trim`) e remove o fundo branco por canal alpha
      (`alpha = 255 − min(R,G,B)` por pixel — funciona bem porque o ícone
      não tem branco puro na própria arte; testado compondo sobre fundo
      escuro antes de aceitar, sem halo visível). Resultado:
      `apps/web/public/logo-icone.png` (320×283, ~42KB, fundo transparente).
      `components/logo.tsx` agora exporta `LogoIcone` (via `next/image`,
      usa o PNG real) para todo lugar que renderiza no navegador — barra do
      consultor, do produtor, vitrine `/demo`, `/termos`, `/privacidade` e
      a vitrine de login — substituindo o quadrado rotacionado antigo **e**
      a versão SVG desenhada à mão. O favicon/apple-icon/ícones PWA também
      passaram a usar o PNG real (embutido como data URI dentro do
      `ImageResponse` via `lib/logo-buffer.ts`, já que um `<img src="/...">`
      relativo não é resolvido pelo Satori em tempo de requisição). Fora de
      propósito: `app/r/[token]` (impressão de campo) — tem marca própria
      em mono, pensada pra imprimir em papel, sem ícone.
- [x] **Login/cadastro em vitrine dividida.** `components/tela-auth.tsx`
      (`TelaAuth`) — foto real à esquerda com gradiente verde da marca por
      cima (mesmo tratamento do `BannerHero`) + headline + lista de
      recursos (ícone + título + descrição, reaproveitando `icones.tsx`
      existente); cartão de formulário à direita, com abas Entrar/Criar
      conta quando aplicável. Abaixo de 880px a foto some — sobra só o
      cartão, decoração não é prioridade no celular numa tela de entrar.
      Aplicado em `/login`, `/cadastro` (+ estado de confirmação de
      e-mail), `/produtor/login` e `/produtor/aceitar` (reaproveita
      `FOTO_PRODUTOR`, já existente desde o redesign anterior).
- [x] **Foto nova.** `apps/web/public/banners/tecnico-campo.jpg` (Pexels,
      licença comercial livre, sem exigência de crédito — mesma licença já
      verificada pros banners do redesign anterior) — homem em campo com
      tablet, usado no lado consultor da vitrine de login/cadastro.
- Verificação: `tsc --noEmit` limpo, `next build` zero warning,
  `test:core` 45/45, smoke test local + em produção (todas as rotas
  novas, `/icon` e `/apple-icon` respondendo `image/png`). Commit
  `3fbb2a2`.
- [x] **Fidelidade ao mockup (segunda rodada).** Gustavo pediu "quero a
      página de login igual essa" depois de ver o resultado — fechei os
      detalhes que faltavam: ícone (pessoa/e-mail/cadeado) dentro dos
      campos de texto (`components/campo-auth.tsx`, `CampoAuth`), botão de
      mostrar/ocultar senha (`CampoSenha`), confirmação de senha no
      cadastro (validada no cliente antes de enviar), risco decorativo sob
      a marca na foto, badges dos recursos com cor sólida (antes
      semi-transparentes, destoava do mockup). **Achado ao revisar:**
      `.tela-auth-cartao` nunca tinha ganhado fundo/sombra própria — o
      "cartão" branco do formulário só existia visualmente por acaso
      (herdava o fundo da página); corrigido junto.
- [x] **Login/cadastro com Google.** Botão "Continuar com Google" real —
      chama `supabase.auth.signInWithOAuth({ provider: 'google' })`; só
      funciona depois que o provedor Google for habilitado no painel do
      Supabase (Authentication → Providers), igual ao padrão já usado pro
      Asaas/Resend: a ação é real, só falta a credencial de produção.
- [x] **Termos de uso e política de privacidade.** O mockup exige aceite
      de termos pra criar conta — como as páginas não existiam, criei
      `/termos` e `/privacidade` (`app/termos`, `app/privacidade`) com
      conteúdo real (não é lorem ipsum) cobrindo o que o AgroTech
      efetivamente faz com os dados hoje (isolamento financeiro
      produtor×consultor, exportação/exclusão já implementadas na Fase
      LGPD). **Aviso visível no rodapé de ambas as páginas:** é um texto
      inicial da plataforma, recomenda revisão por advogado antes de
      operação comercial formal — não é um documento jurídico definitivo.
      Checkbox de aceite agora é obrigatório pra criar conta em `/cadastro`.
      **Decisão de escopo:** não implementei o campo "Perfil" (seletor
      Técnico/Produtor) que aparece no mockup de cadastro — o app real não
      permite que produtor se autocadastre (conta de produtor só existe via
      convite do técnico, decisão de `PRODUCT_V2.md`); um seletor ali seria
      uma opção fantasma sem fluxo funcional por trás.
- [x] **Logout na área do consultor.** Achado ao mexer nas telas de
      autenticação: o lado do produtor tinha "sair" no cabeçalho desde a
      Fase 4, mas o lado do consultor **nunca teve nenhuma forma de
      encerrar sessão** — Gustavo pediu explicitamente. `app/(auth)/sair/
      route.ts` (mesmo padrão do `produtor/sair` — `signOut` + redireciona
      pro `/login`); link "sair" no cabeçalho de `/app` (ao lado do
      nome/CREA) e cartão "Sair da conta" em `/app/config`. Commit
      `2f33f76`.
- [x] **Visual novo nas duas visões 360º + vitrine de tabelas.** Pedido
      genérico "continue" — apliquei o `BannerHero` em `/app/produtores/[id]`
      e `/app/talhoes/[id]` (visões de detalhe ricas, não formulário — cabe
      bem), preservando 100% das ações/Tags existentes, e em `demo/tabelas`
      (vitrine pública). Formulários/edição e a conferência de laudo
      continuam no padrão antigo, mesma razão de sempre. Commit `c4450de`.
- [x] **Financeiro do escritório (de verdade) + selo "em breve" indevido
      em Configurações.** Gustavo pediu "crie a aba de financeiro e
      configurações". Achado ao investigar: `/app/config` já era real e
      funcional — só o item do menu (`lib/navegacao.ts`) tinha ficado
      marcado `embreve: true` por engano desde a Fase 1, mostrando o selo
      "em breve" numa tela que já funcionava; corrigido só o flag.
      "Financeiro do escritório" (`/app/financeiro-escritorio`) esse sim
      era só placeholder — construído com o mesmo desenho do financeiro do
      produtor (`0020`), mas escopado por `org_id`: contas, categorias
      (semeadas automaticamente), lançamentos de receita/despesa com
      comprovante e vínculo opcional a um cliente. `0028_financeiro_
      escritorio.sql` — isolamento total na direção oposta do `0020`: só
      consultor/admin, **nenhuma** política de produtor em nenhuma tabela.
      Fora de escopo por ora (mesma simplificação inicial do financeiro do
      produtor): centros de custo e orçamento. Commit `c4ee75e`.
- [x] **Editar o escritório em Configurações.** "Continue a fase de
      configuração" — a própria tela dizia "Renomear o escritório ainda
      não é possível pelo app", achado de auditoria registrado desde a
      Fase 1 (`PRODUCT_AUDIT.md` item 14: `agro.orgs` nunca teve policy de
      `update`). `0029_orgs_atualizar.sql` — policy restrita a
      consultor/admin da própria org. Form de nome/município/UF em
      `/app/config`, grava auditoria (`escritorio.editado`, mesmo padrão
      de `perfil.editado`). Aplicada no Supabase real. Commit `6edc45c`.

**Auditoria própria pedida por ele** (parte do mesmo pedido): rodada de
`tsc --noEmit` + `next build` (zero warning) + `test:core` (45/45) + smoke
test a cada sub-fase, igual ao resto do projeto — sem achado novo de bug
nesta rodada além do que já tinha sido corrigido na auditoria anterior
(error.tsx + trial vencido). Limitação registrada: sem navegador disponível
neste ambiente, não dá pra confirmar visualmente o mapa renderizando —
build/typecheck/SSR confirmam que não quebra o servidor, mas a conferência
visual de verdade (cores, alinhamento, o mapa carregando os tiles) depende
do Gustavo abrir no navegador dele.

---

## Produto vendável (multi-tenant + billing)

- [x] **Tenancy à prova de descuido** (`0012_tenancy.sql`) — `org_id`/`produtor_id`
      desnormalizados por trigger, `custom_access_token_hook` (claims no JWT),
      helpers `jwt_org/jwt_role/jwt_produtor` com fallback, políticas `coluna = literal`,
      **guarda `RESTRICTIVE` de tenant em toda tabela**, índices. `config.toml` liga o hook.
- [x] **Auth endurecido** (`config.toml`) — senha mínima 10 + variedade, MFA TOTP,
      rate limits no token. CAPTCHA/leaked-password ficam no painel + secret.
- [x] **Billing Asaas** (`0013_billing.sql`) — `planos` (teste/técnico/escritório),
      `assinaturas`, `cobrancas` (`unique(gateway_id)`), trigger `checar_limite()`.
      Edge Function `webhook-asaas` (confere token, upsert idempotente, 200 após gravar).
      Tela `/app/assinatura` (plano, uso vs limite, cobranças).
- [x] **Painel agregado no banco** (`0014_painel.sql`) — `vw_talhao_situacao` (LATERAL) +
      `painel_consultor()` (JSON, SECURITY INVOKER); painel do consultor rewireado, virou fila de trabalho.
- [x] **LGPD** — `lib/audit.ts` gravando em `audit_log` (produtor/talhão/laudo/link/convite);
      `0015` libera o insert do consultor. Export dos dados do produtor em JSON:
      `/app/produtores/[id]/exportar`. **Exclusão sob solicitação**: `excluirProdutor`
      (confirmação por texto, cascata, audit) na "Zona de risco" da página do produtor.
- [ ] Ligar hook, senha vazada, CAPTCHA e rate limit no painel do projeto real
- [ ] Conta sandbox Asaas + ciclo completo de webhook
- [ ] Contrato + política de privacidade com cláusula de operador
- [ ] Exclusão de dados sob solicitação (hoje só exportação)

---

## Fase 1 — Fundação · em andamento

- [x] Monorepo (npm workspaces) — `packages/*`, `apps/*`, tsconfig strict
- [x] `packages/agro-core` — motor extraído em módulos puros
  - [x] `calculos` · `interpretacao` · `calagem` · `gessagem` · `adubacao` · `fontes` · `diagnostico`
  - [x] `recomendacao` — orquestrador com `motor_versao` + `tabelas_snapshot`
  - [x] `tabelas/padrao` — PADRAO tipado
  - [x] `parsers/` — `numero`, `sanidade`, `perfis`, `extrair`, `normalizar`
  - [x] **45 testes (vitest) passando** · typecheck strict limpo
  - [x] **Auditoria A1 corrigida no código** (escolha do corretivo) + 5 testes
- [x] `supabase/migrations/0001–0009` — schema `agro`, RLS em todas as tabelas, trigrama
  - [x] constraints de sanidade no banco (A7)
  - [x] `supabase/tests/rls.test.sql` (pgTAP) — isolamento produtor/organização
- [x] `supabase/functions/` — esqueletos de `processar-laudo`, `gerar-laudo-pdf`, `convidar-produtor`
- [x] `.github/workflows/` — `ci.yml`, `deploy-supabase.yml`, `backup.yml`
- [x] `apps/web` — Next 15 **buildando** (`next build` verde) e servindo
  - [x] sistema visual completo em `globals.css` (tokens do protótipo, refinados) + fontes via `next/font`
  - [x] topo + abas com estado ativo (`nav-abas`), primitivas em `components/ui.tsx`
  - [x] `login` / `cadastro` (stub) estilizados
  - [x] painel do consultor com pendências químicas reais (motor sobre as análises)
  - [x] **tela de interpretação** completa (`interpretacao-view`): métricas, perfil da CTC, réguas macro+micro, diagnóstico, calagem/gessagem, adubação + fontes + parcelamento
  - [x] `/app/analises` (lista + filtro por cultura), `/app/analises/[id]`, `/app/analises/nova` (form + server action)
  - [x] `/app/produtores` + `/app/produtores/[id]` — **talhões e análises agrupados por cultura**, resumo V%/m% por talhão
  - [x] listas de talhões, laudos, monitoramento, tabelas (read-only)
  - [x] **`/demo`** — vitrine pública da interpretação (sem auth, sem banco, motor real)
- [x] **Link público de resultados** (`/r/[token]`) — produtor abre sem login e vê V%, m%, calagem e NPK por cultura/talhão, layout "bruto" para o campo
  - [x] migration `0010_compartilhamentos` + RPC `resultados_por_token` (security definer, `grant … to anon`)
  - [x] gestão dos links na página do produtor (gerar por cultura ou lavoura toda, ativar/desativar, contador de acessos)
- [x] **CRUD de escrita** de produtores (`/produtores/nova`, `/[id]/editar`),
      propriedades e talhões (`<details>` na página do produtor, `/talhoes/[id]/editar`) — server actions em `produtores/acoes.ts`
- [x] **`/cadastro` real** (signUp com metadata) + `garantirEscritorio()` no guard:
      cria a org e semeia as 5 `tabelas_referencia` com `clonarPadrao()` no 1º acesso
      (migration `0011` — policy `orgs_criar` para consultor sem org)
- [x] **`tabelasDaOrg(sb)`** — todas as telas usam as tabelas calibradas da organização
      (fallback para PADRAO por tipo); painel, análises, produtor e laudo já threadados
- [ ] Projeto Supabase real (staging) + `supabase link` + primeira `db push`
- [ ] Editor visual das `tabelas_referencia` por organização (hoje só semeadas)

## Fase 2 — Análise e recomendação

- [x] Tela de lançamento manual da análise (form → server action → interpretação)
- [x] Tela de interpretação (réguas, perfil da CTC, diagnóstico, calagem, adubação)
- [x] **Laudo A4 imprimível** — `/app/analises/[id]/laudo` (`LaudoView` + `window.print()`,
      `@page` A4 + `.nao-imprime` já no `globals.css`). Conteúdo vem da recomendação
      (motor_versao), nada recalculado.
- [ ] `gerar-laudo-pdf` na Edge Function (PDF server-side, hoje é impressão do navegador)
- [ ] Editor visual das tabelas de referência por organização
- [ ] Tela de conferência do laudo (Fase 3) reaproveitando `interpretacao-view`

## Fase 3 — Ingestão de PDF

- [ ] Upload + Storage + insert em `documentos` com hash
- [ ] `processar-laudo`: `unpdf` + `extrairDeTexto` + (LLM opcional) → `revisao`
- [ ] Tela de conferência lado a lado (PDF | formulário), campos por confiança
- [ ] `casar_produtor` na UI (score ≥0,90 / 0,60–0,89 / <0,60)
- [ ] Lote (várias amostras por PDF)
- [ ] **5–10 laudos reais anonimizados → casos de teste + perfis**

## Fase 4 — Portal do produtor

- [x] **Convite** — server action `convidarProdutor` grava em `agro.convites` +
      e-mail (Resend, se configurado) ou link direto. Botão "Enviar convite" na página do produtor.
- [x] **`/produtor/aceitar?token=`** — RPC `convite_resumo` (anon) mostra "de qual
      organização"; cria senha (signUp) → RPC `aceitar_convite` (SECURITY DEFINER)
      liga `produtores.user_id` + `profiles.org_id`/`role` → `refreshSession()` (`0016`)
- [x] **`/produtor/login`** + `/produtor/sair`; layout `(produtor)` com guarda `role='produtor'`
- [x] **`/produtor`** — painel em linguagem do produtor ("precisa de correção" /
      "solo em ordem" via `vw_talhao_situacao`), última recomendação em destaque
- [x] **`/produtor/laudos/[id]`** — laudo completo (mesmo `LaudoView`), imprimível
- [x] **Emissão persistida** — `emitirRecomendacao` grava `agro.recomendacoes`
      (`motor_versao` + `tabelas_snapshot` + `resultado` com contexto). `LaudoView`
      renderiza da recomendação persistida, não recalcula. `0017` — GRANTs do schema `agro`.
- [ ] Notificação ao produtor quando sai recomendação nova
- [ ] Exclusão da conta de auth do produtor no fluxo LGPD (hoje remove só os dados de negócio)

## Fase 5 — Campo

- [ ] Caderno de campo com foto + geolocalização
- [ ] PWA com fila offline

## Fase 6 — Integração Campo Forte

- [ ] Preço da commodity no painel do produtor
- [ ] Estimativa de receita e custo da recomendação com preço real de insumo

---

## Como retomar

```bash
cd C:/Nova7/agrotech
npm install
npm run test:core      # deve dar 45 passando
```

Próximo passo natural: criar o projeto Supabase de staging, rodar
`supabase db push`, e migrar a **tela de Análises** do protótipo para o Next
(é onde o `agro-core` aparece inteiro).
