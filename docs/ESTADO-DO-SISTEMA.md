# AgroTech — como está o sistema (08/10/2026, fim do dia)

Resumo em linguagem simples do que existe, do que foi testado e do que falta.
Site: https://agrotech-three-self.vercel.app · Código: github.com/thgustavo62-design/Agrotech
Detalhe técnico: [PROGRESSO.md](PROGRESSO.md) · O que já foi aprovado por você: [POLITICA-DE-APROVACAO.md](POLITICA-DE-APROVACAO.md)

---

## 1. O que o sistema é
Um painel de assistência técnica agronômica para escritórios. O escritório cadastra produtores, propriedades e talhões, lança análises de solo (digitando ou enviando o PDF do laudo), e o sistema interpreta os resultados, calcula calagem e adubação e emite recomendações e laudos. O produtor tem um portal próprio para acompanhar a fazenda.

## 2. O que já funciona
- **Área do escritório:** início com fila de trabalho, produtores, propriedades (com mapa), talhões, análises, laudos, recomendações, monitoramento, agenda, indicadores, relatórios, financeiro do escritório, assinatura. Funciona no celular.
- **Campo sem sinal:** visita registrada offline vai para uma fila e é enviada quando o sinal volta (completa só o que faltou, sem duplicar); as próximas visitas ficam salvas no aparelho; uma faixa avisa "sem sinal — dados salvos de tal hora".
- **Portal do produtor:** fazenda, talhões, laudos, recomendações, atividades, financeiro, produção, notificações.
- **Equipe e acesso:** cinco perfis combináveis (Proprietário, Agronômico, Campo, Financeiro, Consulta). O proprietário cadastra empregado com e-mail e senha provisória (a pessoa cria a própria no primeiro acesso), define nova senha, gera link, remove (a conta é bloqueada na hora). Verificação em duas etapas **opcional** (código do celular), aplicada no banco.
- **Laudos confiáveis:** só sai recomendação com análise completa e de 0–20 cm; gesso só tem dose com análise de 20–40 cm; o laudo leva o escritório e o responsável com CREA; campo em branco aparece como "—", nunca "0,0".
- **Leitura de laudo em PDF:** texto e escaneado (OCR), tela de conferência, recusa o que não é laudo, lê tabelas horizontais.

## 3. Segurança
- Cada escritório só vê os próprios dados e cada produtor só os seus — regra **no banco**, com testes automáticos.
- Falha crítica corrigida (usuário comum podia se promover a consultor de outro escritório).
- Quem é removido perde leitura e escrita imediatamente.
- CSP (proteção contra scripts injetados), cabeçalhos de segurança, senha mínima 8 com letras e números, dependências sem vulnerabilidade conhecida, Edge Functions com autorização.
- Exclusão de produtor (LGPD) apaga também PDFs e fotos do armazenamento.
- Decisões suas: sem CAPTCHA; sem confirmação de e-mail no cadastro.

## 4. Operação (sozinha, sem custo)
| O quê | Como |
|---|---|
| Backup do banco | Diário, **criptografado** (o repositório é público), 30 dias |
| Backup restaura? | **Ensaiado todo dia** num banco de teste; achou e corrigiu um defeito real |
| Site e banco no ar? | Monitoramento a cada 30 min, com e-mail do GitHub se falhar |
| Backup ainda roda? | O monitoramento confere que há backup das últimas 36 h |
| Migração só vai ao banco real | Depois dos testes de segurança passarem |
| Erros | Registro estruturado no Vercel (sem senhas/e-mails) |

Guias: [OPERACAO.md](OPERACAO.md) · [RECUPERACAO-DE-DESASTRE.md](RECUPERACAO-DE-DESASTRE.md)

## 5. Como está a qualidade
| Verificação | Resultado |
|---|---|
| Testes do site | 92 passando |
| Testes do motor agronômico e leitor de laudos | 92 passando |
| Testes do banco (permissões, isolamento, segurança, equipe, MFA) | 92 passando |
| CI a cada envio | passando |
| Telas conferidas em navegador real | sim, **com um Supabase simulado** — agora **automático no CI** (37 verificações) |
| Conferido no site real (produção) | páginas públicas, login/hook, "esqueci minha senha" |

## 6. Limites conhecidos (sem rodeios)
1. **Leitor de laudos:** provado com 1 laudo real (Água Limpa) e PDFs sintéticos de 4 estilos (SP/resina/mmolc, MG/Mehlich, cmol(c), lista) — a falha relatada em 09/10 (laudos de outros laboratórios não liam) foi corrigida com um leitor por unidades. Falta testar PDFs reais de outros laboratórios (**precisa dos seus**).
2. **Regra de gessagem e profundidade** foi decidida por mim por delegação; **um agrônomo responsável deve revisar** os limites antes de vender para vários escritórios.
3. **Verificação em duas etapas, senha provisória e as funções do Supabase** foram testadas no simulador e no banco de testes, **não no Supabase real**. Antes de ligar o segundo fator na sua conta: deixe outro proprietário cadastrado e saiba que a recuperação é pelo painel do Supabase.
4. **Cobrança Asaas** nunca foi testada com conta real. O código foi endurecido (o pagamento só ativa o escritório e o plano certos, valor errado não ativa, nada se perde), mas **falta o ensaio no sandbox do Asaas** (conta sua) antes de cobrar de verdade. **Edge Functions** não estão publicadas (precisam de um token seu).
5. **Arquivos do Storage** (PDFs e fotos) não entram no backup (só a lista). Precisa de uma credencial guardada como secret do GitHub (ação sua).
6. **E-mails:** sem domínio próprio, o Supabase manda pouquíssimos e-mails; por isso o cadastro de empregado é direto e a recuperação do empregado é feita pelo proprietário.
7. **Offline:** o reenvio só acontece com o app aberto (limite do iPhone); só visitas entram na fila.
8. **Sem ambiente de teste (staging)** nem proteção da branch `main` — depende da sua decisão (acaba o push direto).
9. **Textos de privacidade e termos são rascunho**; a minuta para o advogado está em [LGPD-MINUTA.md](LGPD-MINUTA.md).
10. Plano gratuito do Supabase: sem proteção contra senhas vazadas.

## 7. O que depende de você
- **Testar no site real** (15 min): cadastrar um empregado de teste → entrar com ele (deve pedir para criar a senha) → removê-lo; excluir um produtor de teste; uma visita offline no celular; (opcional) ligar a verificação em duas etapas com outro proprietário cadastrado.
- **Conferir** que o GitHub manda e-mail quando um workflow falha (Settings → Notifications → Actions).
- **Mandar** 2–3 PDFs de laudos reais de laboratórios diferentes.
- **Decidir:** proteger a `main` + criar staging; fluxo de revisão/aprovação do laudo; quando fazer o ensaio da cobrança no sandbox do Asaas.
- **Ações suas nos painéis:** região do Vercel → Portland; token do Supabase para publicar as funções; credencial de Storage para o backup dos arquivos; advogado para os textos.

## 8. Mapa técnico (para quem for manter)
Site Next 16 + React 19 (`apps/web`) no Vercel · Supabase (schema `agro`, 44 migrações) · motor e leitor em `packages/agro-core` · PDF em `packages/laudo-pdf` · testes de banco em `packages/db-test` · [README.md](../README.md) · [CHANGELOG.md](../CHANGELOG.md) · [decisões](decisoes/).
