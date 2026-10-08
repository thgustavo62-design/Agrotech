# AgroTech — como está o sistema (08/10/2026)

Resumo em linguagem simples do que existe, do que já foi testado e do que falta.
Site: https://agrotech-three-self.vercel.app · Código: github.com/thgustavo62-design/Agrotech

---

## 1. O que o sistema é
Um painel de assistência técnica agronômica para escritórios. O escritório cadastra produtores, propriedades e talhões, lança análises de solo (digitando ou enviando o PDF do laudo), e o sistema interpreta os resultados, calcula calagem e adubação e emite recomendações e laudos. O produtor tem um portal próprio para acompanhar a fazenda.

## 2. O que já funciona

**Área do escritório (consultor)**
- Início com fila de trabalho, pendências e agenda de visitas.
- Produtores, propriedades (com mapa), talhões, análises, laudos, recomendações e monitoramento de pragas.
- Leitura de laudo em PDF: texto nativo e PDF escaneado (por OCR), com tela de conferência.
- Cálculo de calagem, gessagem e adubação, com tabelas que o escritório pode ajustar.
- Indicadores, relatórios (impressão e CSV), financeiro do escritório, assinatura/plano.
- Funciona no celular (barra inferior, telas adaptadas).
- Trabalha **sem sinal no campo**: visita registrada offline vai para uma fila e é enviada quando o sinal volta; as páginas das próximas visitas ficam salvas no aparelho.

**Portal do produtor:** fazenda, talhões, laudos, recomendações, atividades, financeiro, produção e notificações.

**Configurações e equipe (novo)**
- Central em Configurações: meu perfil (com troca de senha), escritório, equipe e permissões, privacidade.
- **Cadastrar empregado:** você informa nome, e-mail, cargo, perfis e senha; a pessoa entra direto pelo login, sem confirmar e-mail.
- **Cinco perfis combináveis:** Proprietário, Agronômico, Campo, Financeiro e Consulta. Cada um só vê e faz o que o perfil permite; a regra vale no banco de dados, não só na tela.
- Senha esquecida do empregado: o proprietário define uma nova na hora ou gera um link. Para o proprietário existe "Esqueci minha senha" no login.
- **Remover empregado** de verdade: a conta é bloqueada, o e-mail fica livre e o histórico é preservado.
- Histórico da movimentação da equipe e uso do plano ("3 de 5 usuários").

## 3. Segurança
- **Falha crítica corrigida:** qualquer usuário logado (até um produtor) podia se promover a consultor de outro escritório. Corrigido e coberto por testes.
- Cada escritório só enxerga os próprios dados (isolamento no banco), e cada produtor só vê os seus.
- Política de segurança de conteúdo (CSP) ativa em produção, contra injeção de scripts.
- Senha mínima de 8 caracteres com letras e números (site e Supabase iguais).
- Login com hook que coloca escritório e papel no token (confirmado em produção).
- Dependências sem vulnerabilidades conhecidas (`npm audit`: 0), Next 16.
- Decisões suas: sem CAPTCHA; sem confirmação de e-mail no cadastro.

## 4. Como está a qualidade
| Verificação | Resultado |
|---|---|
| Testes do site | 92 passando |
| Testes do motor agronômico e leitor de laudos | 75 passando |
| Testes do banco (permissões, isolamento, segurança) | 59 passando |
| Verificação automática a cada envio (CI) | passando |
| Telas conferidas em navegador real (computador e celular) | sim, com Supabase simulado |
| Páginas públicas conferidas em produção | sim |
| Área logada conferida em produção | **parcialmente** (hook de login e "esqueci minha senha" sim; o resto não) |

## 5. Limites conhecidos (sem rodeios)
1. **Leitor de laudos:** validado com um laudo real (Laboratório Água Limpa) e com textos que imitam outros layouts. **Nunca foi testado com PDFs reais de outros laboratórios.** Não existem laudos reais públicos na internet; precisa que você mande 2 ou 3.
2. **Remoção de empregado:** a pessoa removida perde a escrita na hora, mas pode **ler** dados por até 1 hora (até a sessão expirar).
3. **E-mails:** sem domínio próprio, o Supabase embutido manda poucos e-mails por hora e só para a equipe do projeto. Por isso o cadastro de empregado é direto, por senha, e a recuperação do empregado é feita pelo proprietário.
4. **Offline:** o reenvio só acontece com o app aberto (limitação do iPhone), e só visitas entram na fila.
5. **Plano gratuito do Supabase:** sem proteção contra senhas vazadas.
6. Gerar o **PDF do laudo no servidor do Supabase** ainda não foi publicado (precisa de um token seu); **cobrança Asaas** nunca foi testada com conta real.
7. Textos de **privacidade e contrato** (LGPD) são rascunho e precisam de revisão de um advogado antes de vender.

## 6. O que depende de você
- Testar no site real: cadastrar um empregado de teste, entrar com ele em janela anônima, removê-lo; excluir um produtor de teste (a conta dele deve sumir do Supabase); registrar uma visita sem sinal no celular.
- Mandar 2 ou 3 PDFs de laudos reais (pode anonimizar o cliente).
- Trocar a região do site no Vercel (Settings → Functions) para **Portland (pdx1)**, perto do banco que está em Oregon. Deixa o site mais rápido.
- Quando for cobrar: conta de teste no Asaas e token do Supabase para a função de PDF.

## 7. O que eu posso fazer sem depender de você
- Rodar os testes de navegador automaticamente a cada envio (hoje só rodam no meu ambiente).
- Ajustar o leitor de laudos assim que chegarem PDFs reais.
- Reduzir o prazo de leitura de quem foi removido.
- Rascunhar os textos de privacidade e termos para o advogado revisar.

## 8. Mapa técnico (para quem for manter)
- **Site:** Next 16 + React 19 (pasta `apps/web`), publicado no Vercel a cada envio para `main`.
- **Banco e login:** Supabase (schema `agro`), 39 migrações aplicadas sozinhas em produção.
- **Motor agronômico e leitor de laudos:** `packages/agro-core`. **PDF do laudo:** `packages/laudo-pdf`. **Testes do banco:** `packages/db-test`.
- **Documentação:** `docs/PROGRESSO.md` (histórico detalhado), `docs/ARQUITETURA.md`, auditorias em `docs/AUDITORIA*.md`.
- **Regra de ouro das migrações:** toda migração que cria função precisa revogar o acesso público dela; um teste falha se isso for esquecido.
