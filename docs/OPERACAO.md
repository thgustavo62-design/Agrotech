# Operação — o que vigiar e o que fazer quando algo quebra

Para quem cuida do AgroTech no dia a dia. Em linguagem direta; sem precisar de código.

## O que já vigia sozinho
| O quê | Como | Quem avisa |
|---|---|---|
| Site no ar (`/login`, `/offline`, `/termos`) | workflow **Monitoramento**, a cada 30 min | e-mail do GitHub quando falha |
| Auth e banco do Supabase respondem | mesmo workflow, endereço `/api/saude` | idem |
| Backup rodando | mesmo workflow: backup bem-sucedido nas últimas 36 h | idem |
| Backup restaura | ensaio diário dentro do workflow **Backup diário** | idem |
| Testes e build a cada alteração | workflow **CI** | e-mail do GitHub + marca vermelha no commit |
| Migração só vai para produção se os testes passam | workflow **Migrações (Supabase)** | idem |

> **Confirme uma vez** que o GitHub está mandando e-mail de falha de workflow para você: GitHub → Settings → Notifications → "Actions" (marque "Send notifications for failed workflows only").

## Onde ver o que aconteceu
- **Erros do servidor:** painel do Vercel → o projeto → *Logs*. Cada erro é uma linha JSON com `contexto`, `codigo` e `requisicao` (o número que liga ao resto da requisição). Senhas, chaves e e-mails completos não entram no log.
- **Quem fez o quê no escritório:** Configurações → Privacidade e dados (atividade recente) e Equipe e permissões (movimentação da equipe).
- **Banco:** painel do Supabase → *Logs* (Postgres, Auth, API).

## Quando algo quebra
**O site não abre / o monitoramento avisou**
1. Abra `https://agrotech-three-self.vercel.app/api/saude`. Se `auth` ou `api` estiver `false`, o problema é o Supabase: veja status.supabase.com e o painel do projeto (pode estar pausado por inatividade no plano grátis → *Restore project*).
2. Se o `/api/saude` nem abre, é o Vercel: painel do Vercel → *Deployments*. Se o último deploy falhou, escolha o anterior que estava verde e **Promote to Production**.

**Um deploy novo deu problema**
- Vercel → *Deployments* → deploy anterior verde → *Promote to Production*. Isso volta o **site**; migrações do banco não voltam sozinhas (ver abaixo).

**Uma migração falhou no GitHub**
- O workflow para antes de alterar produção quando os testes falham. Se falhou **na aplicação** (depois dos testes), a migração roda numa transação: não deixa pela metade. Leia o erro no log do workflow, corrija no código e envie uma migração nova (nunca edite uma já aplicada).

**Alguém apagou dado por engano**
- Os dados continuam no backup diário (até 24 h atrás). Ver `docs/RECUPERACAO-DE-DESASTRE.md`. Para um registro só, restaure o backup num banco de teste e copie o registro; não restaure em cima da produção.

**O Auth do Supabase caiu / ninguém consegue entrar**
- Confirme em status.supabase.com. Quem já está logado continua até o token expirar (1 h). Não há o que fazer do nosso lado além de esperar e avisar a equipe.

**Uma conta foi comprometida (senha vazou)**
1. Equipe e permissões → remova a pessoa (a conta é bloqueada na hora) ou defina nova senha para ela.
2. Se for o proprietário: Supabase → Authentication → Users → o usuário → *Send password recovery* ou *Delete factors*; depois entre e troque a senha.
3. Veja o histórico da equipe para o que foi feito com a conta.

**Cobrança em desacordo (quando a cobrança estiver ativa)**
- Compare o Asaas com Configurações → Plano e cobrança. Não altere o plano na mão antes de entender a divergência (ver AG-010 no plano de melhorias).

**Incidente com dados pessoais (LGPD)**
- Siga `docs/LGPD-MINUTA.md`, seção "Incidente de segurança": conter, registrar, avaliar, comunicar.

## Rotina sugerida
- **Toda semana (5 min):** ver se há e-mails de falha do GitHub e abrir o painel de *Logs* do Vercel filtrando por `nivel":"erro"`.
- **Todo mês:** conferir no Supabase o uso do plano (banco, armazenamento, usuários) e o `docs/ESTADO-DO-SISTEMA.md`.
- **A cada 3 meses:** baixar um backup, decifrar na sua máquina e conferir que a senha guardada funciona.
