# Política de aprovação — AgroTech

Combinado entre o dono do sistema e o Claude para evitar retrabalho. **O que está aqui já foi aprovado e não precisa ser perguntado de novo.** Quando uma decisão nova for aprovada, ela entra nesta lista. O Claude lê este arquivo no começo de cada sessão (ele é citado no `CLAUDE.md`).

Última atualização: 08/10/2026.

## Como funciona
1. **Aprovado → o Claude faz direto**, sem pedir confirmação, e só relata o que fez.
2. **Sistemas aprovados não são mexidos** sem motivo: só se houver um defeito comprovado, uma falha de segurança ou pedido do dono. Nesses casos o Claude corrige, avisa o que mudou e por quê.
3. **Tudo que não está na lista → perguntar antes** (principalmente o que for caro, irreversível, que envolva dinheiro, dados de clientes ou que mude regra agronômica).
4. Cada nova decisão do dono vira uma linha na seção certa, com a data.

---

## A. Conexões e acessos já aprovados (o Claude usa direto)
| O quê | Pode fazer sem perguntar | Desde |
|---|---|---|
| Repositório GitHub `thgustavo62-design/Agrotech` | Trabalhar na branch `main`, commit e push, ler logs do CI, disparar workflows (ex.: backup) | 02/10 |
| Vercel (site em produção) | Receber os deploys automáticos de cada push; conferir o site publicado | 02/10 |
| Supabase de produção | As migrações em `supabase/migrations` são aplicadas sozinhas pelo workflow a cada push | 02/10 |
| Secrets do GitHub | Criar/atualizar secrets necessários ao próprio sistema (ex.: `BACKUP_PASSPHRASE`), sem exibir o valor | 08/10 |
| Internet (pesquisa e download de documentos públicos) | Pesquisar e baixar material público para testes (ex.: PDFs técnicos) | 06/10 |
| Testes locais | Subir o simulador, o navegador de teste e o build local | 02/10 |

## B. Decisões técnicas já aprovadas (não rediscutir)
- **Estrutura:** monorepo Next + Supabase; código modular (página → dados → componentes), como está hoje.
- **Segurança:** perfis combináveis (Proprietário, Agronômico, Campo, Financeiro, Consulta), regras no banco (RLS); CSP com nonce; toda migration que cria função revoga o acesso público.
- **Equipe:** o proprietário cadastra o empregado direto com e-mail e senha (sem confirmação de e-mail); remover = desativar a conta (não apagar); recuperação de senha pelo proprietário (definir a senha ou gerar link) e "Esqueci minha senha" no login.
- **Senha:** mínimo de 8 caracteres, com letras e números. Senha definida pelo proprietário é **provisória**: a pessoa cria a própria no primeiro acesso.
- **Verificação em duas etapas (TOTP):** opcional por pessoa, recomendada ao proprietário; quando ligada, o banco só entrega dados a sessões com o código.
- **Sem CAPTCHA.**
- **Sem domínio próprio de e-mail por enquanto:** nada que dependa de enviar e-mail em volume.
- **Next 16 + vitest 4**, `proxy.ts`, ESLint direto.
- **Backup:** diário, criptografado (repositório é público); a senha fica só no secret e numa cópia do dono; restauração ensaiada a cada backup (`docs/RECUPERACAO-DE-DESASTRE.md`).
- **Análise incompleta não vira laudo:** campo em branco nunca é tratado como zero; zero medido é válido.
- **Laudo:** leva o escritório e o responsável com CREA de quem emite; sem CREA não emite.
- **Edge Functions:** toda função com service_role autentica o chamador e confere o escritório atual do perfil antes de tocar nos dados (`_shared/autorizacao.ts`); nada é publicado sem o dono fornecer o token.
- **Offline:** fila de visitas, pré-carregamento das próximas visitas e faixa "sem sinal".
- **Vigilância:** workflow de monitoramento a cada 30 min + `/api/saude`; log de erros estruturado e mascarado.
- **LGPD:** a exclusão de um produtor apaga também os arquivos dele no Storage; textos jurídicos só como minuta até o advogado aprovar.

## C. Sistemas já aprovados (só mexer com motivo)
Funcionando e verificados — **não refatorar nem "melhorar" por conta própria**:
- Login e sessão · Central de configurações e equipe · Cadastro/remoção de empregado · Recuperação de senha
- CSP e cabeçalhos de segurança · Fila offline e cache das visitas · Backup diário
- Leitor de laudos por rótulo e tabela da Água Limpa · Validação de análise (`validarAnalise`)
- Identidade do laudo (escritório + CREA) · Telas do consultor e do produtor existentes

## D. Delegado ao Claude ("faça o que achar melhor")
Quando o dono disser "veja o que você acha melhor", o Claude decide, **registra a decisão aqui** e segue:
- **08/10 — Gessagem e profundidade (AG-003/AG-004):** a dose de gesso só existe com análise de 20–40 cm; sem ela o sistema diz apenas "investigar". Calagem e adubação só saem de amostra de 0–20 cm; amostras de 20–40 cm (subsuperfície) e 0–40 cm não geram recomendação. A situação do talhão passa a vir só da camada 0–20. Subsuperfície válida: mesmo talhão, até 24 meses de diferença, Ca < 0,5 ou m > 20% confirma. Revisar com agrônomo responsável antes de venda ampla.

- **08/10 — AG-013:** MFA opcional (não obrigatório, por falta de recuperação por e-mail); senha provisória obrigatória de trocar; limite de usuários do plano imposto no banco.

## E. Sempre perguntar antes (não entram na autorização)
- Gastar dinheiro, contratar plano ou serviço pago, ativar cobrança (Asaas) ou mexer em preços.
- Apagar dados de clientes, resetar ou restaurar o banco de produção, publicar chaves ou segredos.
- Mudar regra agronômica que **não** esteja na seção D, ou fórmulas e tabelas técnicas.
- Enviar mensagens ou e-mails a terceiros, ou publicar algo em nome do dono.
- Alterar configurações no painel do Supabase/Vercel (o Claude orienta; quem clica é o dono).
- Texto jurídico (privacidade, termos, contrato): o Claude rascunha (`docs/LGPD-MINUTA.md`), o dono e um advogado aprovam — nada vai para as páginas públicas antes disso.

## E2. Plano de expansão (AgroTech 2.0) — o que o dono já encaminhou
- **09/10 — Estrutura aprovada pelo dono: três sites separados (Assistência Técnica, Academy, Connect), com escolha na tela de login; a Academy no estilo de plataforma de cursos (SENAR Play), sem nada dela dentro da Assistência.** Não rediscutir; cada site tem o próprio molde.
- **09/10 — Plano de expansão compartilhado pelo dono** (Academy, Connect, Intelligence). O próprio plano recomenda começar por um MVP de **Academy + solicitação ao consultor**; o Claude segue essa ordem, em fatias pequenas (migração + RLS + testes + documentação por fatia) e **sem tocar no motor agronômico**. **10/10 — O dono aprovou os avisos no celular (Web Push)** para o produtor e a equipe, sem custo; o conteúdo do aviso é o da própria notificação (título/resumo curtos). **E-mail e WhatsApp Business continuam exigindo aprovação** (serviço pago/domínio e mensagem externa).
- **09/10 — O dono aprovou copiar conteúdo da Embrapa para o Atlas** (informou que a Embrapa autoriza; guardar a autorização por escrito): sempre com fonte, autoria e link; **nunca** produto, princípio ativo ou dose. Mesma regra para outras fontes: pedir autorização. Feito: Atlas ([ATLAS.md](ATLAS.md)), Academy ([ACADEMY.md](ACADEMY.md)) e Connect, fatia 1 ([CONNECT.md](CONNECT.md)) — o aviso ao produtor é só dentro do site; o link do WhatsApp apenas abre a conversa para a pessoa enviar. **Ainda perguntar antes de:** contratar serviço ou API paga (WhatsApp Business, satélite/NDVI, IA com visão), enviar mensagens a produtores fora do sistema, publicar conteúdo de terceiros, e qualquer coisa que dê a IA poder de recomendar defensivo ou emitir laudo.

## F. Fila de decisões pendentes (aguardam o dono)
- **Ensaio da cobrança no sandbox do Asaas** (conta sandbox + chave + token do webhook): o código está pronto (AG-010); só depois do ensaio completo se decide ativar a cobrança real.
- **Backup dos arquivos (PDFs e fotos) do Storage:** exige guardar uma credencial de Storage como secret do GitHub (o Claude não tem essa chave; quem cola é o dono).
- **Proteger a branch `main`** (exigir Pull Request + testes passando antes de entrar): mais seguro, mas acaba o push direto que usamos hoje. E **criar um ambiente de teste (staging)** com um segundo projeto Supabase gratuito, para as migrações serem testadas fora de produção.
- Revisão da regra de gessagem/camada (seção D) por agrônomo responsável antes de vender para vários escritórios.
- Fluxo de revisão/aprovação do laudo (rascunho → revisão → aprovado → retificado), ou deixar o agrônomo emitir direto?
- Região do site no Vercel → Portland (2 minutos, feito pelo dono).
- PDFs de laudos reais de 2–3 laboratórios para validar o leitor.
