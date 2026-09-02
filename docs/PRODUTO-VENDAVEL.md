# AgroTech como produto vendável

Decisões de arquitetura que mudam quando o software deixa de ser ferramenta interna
e passa a ser assinatura. Documento de apoio ao `AGROTECH.md`.

---

## 1. O erro que teria custado caro

A primeira versão isolava os dados assim:

```sql
create policy talhoes_consultor on agro.talhoes for all to authenticated
using (exists (
  select 1 from agro.propriedades pr
  join agro.produtores p on p.id = pr.produtor_id
  where pr.id = talhoes.propriedade_id and p.org_id = agro.meu_org_id()));
```

Funciona, passa em teste, e degrada em produção. O Postgres reavalia esse `EXISTS`
**uma vez por linha**. Num `select * from talhoes` com 10 mil linhas, são 10 mil
subqueries com dois joins cada.

A documentação do próprio Supabase trata isso como o erro de RLS mais comum, junto
com dois irmãos: chamar `auth.uid()` direto na política em vez de `(select auth.uid())`,
o que impede o planner de transformar a chamada num InitPlan executado uma vez por
query; e esquecer índice nas colunas usadas na política, o que segundo eles muda a
performance em mais de 100 vezes em tabelas grandes.

**Referências:**
- <https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv>
- <https://github.com/orgs/supabase/discussions/14576>
- <https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac>

### O modelo novo

Três camadas, na migração `0012_tenancy.sql`:

**1. `org_id` e `produtor_id` em toda tabela, preenchidos por trigger.**
Desnormalização deliberada. O app não consegue esquecer de preencher porque quem
preenche é o banco, herdando do pai na cadeia (`talhoes` herda de `propriedades`,
que herda de `produtores`).

**2. Os dois ids viajam no JWT.**
Um `custom_access_token_hook` injeta `org_id`, `user_role` e `produtor_id` a cada
emissão de token. A política compara coluna com literal — zero acesso a disco:

```sql
using (org_id = (select agro.jwt_org()))
```

**3. Guarda restritiva.**
Políticas `RESTRICTIVE` combinam com `AND` sobre todas as outras, enquanto as
permissivas combinam com `OR`. Uma guarda restritiva de tenant em cada tabela
significa que **nenhuma política futura consegue furar o isolamento**, nem por
descuido. É a diferença entre confiar na disciplina do time e confiar no banco.

> Cuidado com o claim: ele só muda quando o token é reemitido. Depois de criar a
> organização ou aceitar convite, chame `supabase.auth.refreshSession()`, ou o
> usuário fica com um token sem `org_id` e não vê nada.

---

## 2. Cadastro com senha e o que mais precisa estar ligado

Cadastro obrigatório já existia. O que faltava é o entorno, e quase tudo vem
desligado por padrão no Supabase.

| Item | Padrão | O que fica no AgroTech | Onde |
|---|---|---|---|
| Tamanho mínimo de senha | 6 | 10 | `config.toml` |
| Exigência de variedade | nenhuma | maiúscula, minúscula, dígito e símbolo | `config.toml` |
| Bloqueio de senha vazada | desligado | ligado (checagem HaveIBeenPwned) | painel + `config.toml` |
| CAPTCHA em login/cadastro | desligado | Turnstile | Attack Protection |
| MFA (TOTP) | desligado | disponível, obrigatório para quem assina laudo | `config.toml` |
| Confirmação de e-mail | ligado | ligado | — |
| Rate limit no `/auth/v1/token` | frouxo | apertado | `config.toml` |

O ponto sobre CAPTCHA merece destaque: em auditorias de segurança de projetos
Supabase é comum encontrar `/auth/v1/signup` e `/auth/v1/token` expostos sem
nenhuma proteção contra bot, porque a funcionalidade existe mas vem desabilitada.
Credential stuffing bate no endpoint de login, não no de cadastro.

**Referências:**
- <https://supabase.com/docs/guides/deployment/going-into-prod>
- <https://supabase.com/docs/guides/auth/password-security>
- <https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide>

### MFA para quem assina

O laudo sai com CREA e responsabilidade técnica. Conta comprometida não é só
vazamento de dado, é assinatura profissional em documento errado. A recomendação
aqui é exigir `aal2` para as rotas de emissão de laudo e de mudança de cobrança,
não para o app inteiro — MFA em tudo vira atrito e o usuário desiste.

---

## 3. Painéis separados por papel

Dois problemas foram corrigidos juntos.

**Eficiência.** O painel antigo fazia quatro round trips e trazia linhas para contar
no JavaScript. Agora é uma função no banco (`agro.painel_consultor()`) que devolve
um JSON agregado. Elas são `SECURITY INVOKER` de propósito: a RLS continua valendo
dentro da função, então a mesma lógica serve os dois papéis sem vazar nada.

**Conteúdo.** Painel não é vitrine de números, é fila de trabalho.

*Consultor* abre em "talhões que pedem intervenção" — saturação por bases abaixo de
45% ou alumínio acima de 20%, calculados pela view `vw_talhao_situacao`, que pega a
análise mais recente de cada talhão via `LATERAL`. Depois vêm laudos na fila,
composição de área por cultura e ritmo de visitas. Contagem de produtores é a
métrica menos útil da tela e por isso não abre o painel.

*Produtor* abre na última recomendação que recebeu e no estado de cada talhão em
linguagem dele: "precisa de correção" ou "solo em ordem". CTC e saturação por bases
não aparecem na primeira dobra — quem quiser o número técnico abre o laudo.

---

## 4. Cobrança

Comparei as opções para produto vendido só no Brasil.

| Gateway | Recorrência nativa | Pix | Boleto | Observação |
|---|---|---|---|---|
| **Asaas** | sim | nativo | sim | sandbox sem burocracia, régua de cobrança pronta |
| Stripe | sim, a melhor API | exige configuração extra | idem | conversão USD/BRL e suporte em português limitado |
| Mercado Pago | sim | nativo | sim | bom para checkout de varejo |
| Pix Automático | via PSP | nativo | — | taxa muito menor, mas migração custa caro |

A escolha do scaffold é **Asaas**, pelo conjunto: Pix, boleto e cartão no mesmo
contrato, assinatura nativa e webhooks confiáveis. Para SaaS brasileiro com
mensalidade fixa, a API do Stripe é melhor mas cobra mais caro e pede trabalho extra
justamente nos meios de pagamento que seu cliente usa.

Vale acompanhar o **Pix Automático**, a modalidade de débito recorrente do Banco
Central. A economia de taxa em relação ao cartão é grande, e ele resolve o churn
involuntário — cartão vencido, limite estourado, recusa de antifraude — que come
uma fatia relevante do MRR de qualquer assinatura. Mas a migração é obra, não
configuração. Faz sentido quando a base já estiver de pé.

**Referências:**
- <https://curitibablog.com.br/pagamento-recorrente-asaas-webhook-dotnet>
- <https://fwctecnologia.com/blog/post/pix-automatico-apps-recorrencia-sem-cartao-2026>
- <https://www.mercadopago.com.br/blog/ferramenta-assinatura-saas-alto-faturamento>

### Três cuidados no webhook

1. **Autenticidade.** O Asaas manda um token fixo no header `asaas-access-token`.
   Sem conferir, qualquer um ativa a assinatura de qualquer organização.
2. **Idempotência.** O gateway reenvia o evento quando não recebe 200. A `unique`
   em `cobrancas.gateway_id` faz o reenvio virar `upsert` em vez de duplicata.
3. **Responder 200 depois de gravar.** Erro não tratado vira fila de reenvio.

### Limite de plano cobrado pelo banco

O trigger `agro.checar_limite()` roda antes do insert em `produtores`, `talhoes` e
`documentos`. Se a interface esquecer de checar, o banco recusa com mensagem legível.
Assinatura em `cancelada` ou `suspensa` bloqueia cadastro novo mas **não apaga nem
esconde** o que já existe — laudo é documento técnico e o cliente precisa conseguir
exportar o dele mesmo depois de sair.

Planos iniciais: teste de 14 dias, Técnico e Escritório. Os limites que valem são
produtores, talhões e laudos processados por mês, porque é o laudo que consome
processamento e API.

---

## 5. Concorrência e posicionamento

O maior player de gestão agrícola no Brasil é o **Aegro**, que tem oferta específica
para agrônomo consultor: múltiplos clientes numa tela, histórico da lavoura e
demonstração de retorno da recomendação técnica. É gestão rural completa —
financeiro, estoque, maquinário, integração fiscal — com foco em grãos, algodão,
café, cana e citrus, e em operações de porte (na oferta via Orbia, área mínima de
300 hectares).

Isso define o espaço do AgroTech, e o espaço é bom:

**Onde não competir.** Financeiro, fiscal, estoque, maquinário. Construir isso é anos
de trabalho e não é o seu diferencial.

**Onde ganhar.**
1. **Ingestão do laudo em PDF.** Nenhum concorrente grande automatiza a leitura do
   laudo de laboratório. É a dor mais concreta do consultor e a que economiza tempo
   de verdade.
2. **Motor de recomendação com tabela calibrável.** Os sistemas de gestão registram
   o que foi aplicado; poucos calculam o que deveria ser aplicado, e menos ainda
   deixam o agrônomo calibrar a tabela e guardam o snapshot que torna o laudo
   defensável anos depois.
3. **Culturas capixabas.** Conilon, mamão, banana e pimenta-do-reino não são o foco
   de quem mira grãos do Centro-Oeste. Consultor de Colatina não é atendido por
   software desenhado para soja em Sorriso.
4. **Porte.** Área mínima de 300 hectares exclui boa parte da agricultura familiar e
   das propriedades de café do ES. Esse é o seu cliente.
5. **Integração com o Campo Forte.** Preço da saca ao lado da recomendação técnica é
   algo que nenhum concorrente tem, porque nenhum deles opera um monitor de preço
   regional.

**Referências:**
- <https://aegro.com.br/para-voce/software-para-consultor-agronomico/>
- <https://www.orbia.ag/produto/33324/BY4029/0/aegro-aplicativo-de-gestao-rural-para-fazendas-e-consultorias>

---

## 6. Sobre comprar um boilerplate

Vale a pena pesquisar antes de continuar escrevendo do zero. O mercado de starter
kits para SaaS multi-tenant amadureceu: MakerKit e Supastarter são as duas
referências para produto B2B com organizações, convites e RBAC, na faixa de US$ 300
a 600 por licença vitalícia. Existem opções abertas e gratuitas também
(`nextjs/saas-starter`, `ixartz/SaaS-Boilerplate`, Open SaaS).

A avaliação honesta: um boilerplate te vende **decisões de arquitetura**, não código
que você não conseguiria escrever. A parte que ele resolve — organizações, convites,
papéis, billing, portal do cliente — é exatamente a que você está construindo agora.
A parte que ele não resolve é o motor agronômico e a leitura de laudo, que é onde
está o valor do seu produto.

Se o objetivo é vender rápido, comprar o kit e portar o `agro-core` para dentro dele
é um caminho legítimo e provavelmente mais curto. Se o objetivo é dominar a base de
código, o que está no repositório já cobre o essencial. Não recomendo os dois ao
mesmo tempo: misturar seu multi-tenant com o do kit dá retrabalho.

**Referências:**
- <https://makerkit.dev/blog/saas/best-nextjs-saas-boilerplate>
- <https://supastarter.dev/best-saas-boilerplate-2026>

---

## 7. LGPD: você vira operador

Enquanto era ferramenta interna, os dados eram seus. Vendendo assinatura, a relação
inverte: **o agrônomo cliente é o controlador** e você passa a ser **operador**,
tratando dados pessoais em nome dele. Isso não é formalidade — muda obrigação legal.

O que o contrato precisa ter, no mínimo:

- Identificação clara de quem é controlador e quem é operador
- Finalidade e duração do tratamento, com vedação expressa de usar os dados para
  finalidade própria (inclusive treinar modelo) sem autorização específica
- Medidas de segurança técnicas e administrativas descritas
- Regras para subcontratação (Supabase, Vercel, Asaas e Anthropic são seus
  suboperadores — precisam estar listados)
- Prazo de notificação de incidente. A Resolução ANPD 15/2024 dá ao controlador três
  dias úteis para notificar a autoridade, então o operador precisa avisar antes
  disso — 48 horas é o padrão de mercado
- Procedimento de término: devolução ou eliminação dos dados, com prazo

Do lado técnico, três coisas precisam existir antes da primeira venda: exportação
completa dos dados de um cliente em formato aberto, exclusão sob solicitação, e
registro de quem acessou o quê. O `audit_log` já está no schema; ligue o registro nas
ações que importam (emissão de laudo, correção de campo extraído, convite, alteração
de tabela de referência).

**Referências:**
- <https://baita.ac/insights/checklist-lgpd-para-saas-b2b-no-brasil-moaodu0f>
- <https://confidata.com.br/blog/clausulas-contratuais-lgpd-contratos-terceiros>
- <https://legalsuite.com.br/blog/emp-contrato-saas-clausulas-chave>

---

## 8. Ordem de trabalho até a primeira venda

1. Aplicar as três migrações novas e rodar `supabase test db` — o teste de RLS
   inclui o caso do produtor de uma organização tentando ler dados de outra
2. Ligar o hook de custom claims no painel (`Authentication > Hooks`)
3. Ligar senha forte, senha vazada, CAPTCHA e rate limit
4. Conta sandbox no Asaas, testar o ciclo completo de webhook
5. Calibrar as tabelas de referência — sem isso não há produto
6. Cinco a dez laudos reais anonimizados virando caso de teste do parser
7. Contrato e política de privacidade com cláusula de operador
8. Só então convidar o primeiro cliente pagante

O passo 5 continua sendo o mais importante da lista, e é o único que nenhum código
resolve por você.

---

## Estado da implementação (set/2026)

| Seção | O que já está no repo |
|---|---|
| 1 · tenancy | `0012_tenancy.sql` — colunas `org_id`/`produtor_id` denormalizadas + triggers de herança + backfill; `agro.custom_access_token_hook`; helpers `jwt_org()`/`jwt_role()`/`jwt_produtor()` (com fallback ao `profiles` durante o rollout); políticas reescritas para `coluna = literal`; **guarda `RESTRICTIVE` de tenant em toda tabela**; índices em `org_id`/`produtor_id`. `garantirEscritorio()` chama `refreshSession()`. |
| 2 · auth | `config.toml` — senha mínima 10, `password_requirements`, `[auth.hook.custom_access_token]`, MFA TOTP, rate limits. CAPTCHA (Turnstile) e leaked-password ficam no painel + secret. |
| 3 · painel | `0014_painel.sql` — `agro.vw_talhao_situacao` (LATERAL para a análise mais recente) + `agro.painel_consultor()` (JSON agregado, SECURITY INVOKER). Painel do consultor rewireado para a RPC com fallback. |
| 4 · billing | `0013_billing.sql` — `agro.planos`, `agro.assinaturas`, `agro.cobrancas` (`unique(gateway_id)`), trigger `agro.checar_limite()` em produtores/talhões/documentos. Edge Function `webhook-asaas` (confere `asaas-access-token`, upsert idempotente, 200 depois de gravar). Página `/app/assinatura` (status). |
| 7 · LGPD | `lib/audit.ts` + registro em emissão de laudo, geração de link, alteração/edição de cadastro. Export dos dados de um produtor em JSON: `/app/produtores/[id]/exportar`. |
| 5, 6, 8 | análise/prosa — sem código; a ordem de trabalho está em `PROGRESSO.md`. |
