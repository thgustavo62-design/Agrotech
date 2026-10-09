# Changelog

O que mudou no AgroTech, mais recente primeiro. Detalhe técnico de cada entrega: [docs/PROGRESSO.md](docs/PROGRESSO.md).
Migrações do banco entram numeradas (`0037`…); cada uma é aplicada em produção só depois dos testes.

## 2026-10-09

- **Três sites, uma conta:** a tela de login agora pergunta **para onde você quer ir** — Assistência Técnica, Academy ou Connect — e cada um tem o próprio molde. "Trocar de site" no topo. A Academy saiu de dentro da Assistência Técnica. Ver [docs/SITES.md](docs/SITES.md).
- **Academy como site de cursos** (estilo plataforma de cursos): vitrine, catálogo com filtros, **cursos com módulos e aulas**, progresso, matrícula automática, vídeo do YouTube/Vimeo dentro da página (só depois do clique) e **certificado de participação** imprimível ao concluir. Equipe monta tudo no **Estúdio** (cursos, conteúdos, notícias com fonte, visibilidade por cultura, indicação a produtores, acompanhamento dos alunos). Ver [docs/ACADEMY.md](docs/ACADEMY.md). Migrações 0047 e 0048.

- **Academy (nova):** a universidade do produtor. O escritório publica vídeos (por link), artigos e materiais, escolhe quem vê, **indica** a um produtor depois de uma visita ou de um laudo e acompanha se ele abriu e concluiu. O produtor tem a área "Universidade" no portal e recebe aviso. Só o que foi publicado e é para ele aparece; rascunho nunca. Detalhes em [docs/ACADEMY.md](docs/ACADEMY.md). Migração 0046.

- **Recorte do laudo ao lado de cada valor:** na conferência de laudo escaneado, cada campo mostra o trecho da imagem do laudo (rótulo + número ampliado e circulado). Dá para comparar o impresso com o lido sem procurar no PDF.

- **Extração de laudos mais confiável:** teste de robustez com erros de OCR simulados (252 mil valores, nenhum erro sem marca); novas conferências (V%, m%, t, pH água × CaCl₂, faixas usuais de solo); a conta da soma de bases não apaga mais um desacordo entre leituras.
- **Trava de conferência:** valor de baixa confiança só entra se você corrigir ou marcar "conferi com o laudo"; laudo lido por OCR exige confirmar que conferiu com o PDF. Validado no servidor e registrado na auditoria.

- **Leitura de laudos de outros laboratórios:** novo leitor por linha, guiado pelas unidades (mmolc/dm³, cmol(c)/dm³, g/kg…), que não depende de o laudo dizer "Mehlich". Antes, esses PDFs caíam em "nenhum perfil reconhecido". Livros e guias continuam recusados.
- **Laudo escaneado não ficava preso em "lendo…" por falha do deploy:** os arquivos do motor de OCR não iam para o servidor. Agora vão, o modelo de idioma vem junto, o OCR tem limite de tempo e o CI testa a leitura no Linux.
- Laudo cuja leitura (OCR) foi interrompida não fica mais preso em "lendo…": após 3 min a conferência abre para lançar à mão.

## 2026-10-08

### Segurança e acesso
- **Corrigido (crítico):** um usuário comum (até um produtor) podia se promover a consultor de outro escritório. Migração 0037.
- Perfis combináveis (Proprietário, Agronômico, Campo, Financeiro, Consulta), aplicados no banco (0037/0038).
- Equipe: o proprietário cadastra o empregado direto (e-mail + senha provisória), define senha nova, gera link, remove (conta desativada, 0039).
- Quem é removido perde **leitura e escrita na hora** (0039, 0041).
- Senha provisória obrigatória de trocar no primeiro acesso; verificação em duas etapas opcional (TOTP), aplicada no banco; limite de usuários do plano imposto no banco (0044).
- CSP com nonce; Edge Functions só com autorização (ainda não publicadas); senha mínima 8 + letras e números.
- Recuperação de senha sem depender de e-mail (proprietário → empregado) e "Esqueci minha senha".

### Qualidade técnica dos laudos
- Recomendação **só com análise completa**: campo em branco não é zero (AG-002). Laudo mostra "—" para o que não foi informado.
- **Gessagem sem dose "de referência"**: só existe dose com análise de 20–40 cm que confirme (AG-003). Só amostras de 0–20 cm geram calagem/adubação; a situação do talhão e o link do produtor vêm de 0–20 cm (AG-004, 0040).
- Laudo com o escritório e o responsável (nome + CREA) de quem emite; sem CREA não emite (AG-008).
- Leitor de laudos recusa o que não é laudo (testado com 10 PDFs técnicos reais) e lê tabelas horizontais.

### Cobrança (sem ativar nada)
- O checkout registra o link no banco antes de mandar pagar; o webhook casa o pagamento pelo escritório, confere o valor, **troca o plano** e põe o que não casa em quarentena; erro de gravação não é mais escondido (0045).

### Campo e operação
- Visita offline completa só o que faltou, sem duplicar nem perder ocorrências/fotos (AG-007, 0042); páginas das próximas visitas salvas no aparelho; faixa "sem sinal".
- Backup diário **criptografado** e **restauração ensaiada todo dia**; a restauração achou e corrigiu um defeito real (0043).
- Migrações só vão a produção depois dos testes (AG-006); monitoramento a cada 30 min; log de erros estruturado; `/api/saude`.
- Next 15 → 16, vitest 2 → 4, `npm audit` sem vulnerabilidades.

### LGPD
- Exclusão do produtor agora apaga também os **PDFs e fotos** do Storage (antes só as linhas do banco).
- Minuta de LGPD (mapa de dados, retenção, incidente) para revisão jurídica — [docs/LGPD-MINUTA.md](docs/LGPD-MINUTA.md).

### Testes em navegador no CI
- Nova suíte (Chromium + Supabase simulado) roda a cada envio: telas sem violação de CSP, recusas de laudo, equipe, senha provisória, segundo fator, conta desativada, fila offline. Achou e corrigiu um erro de hidratação na tela "Crie a sua senha".

### Documentação
- README, ESTADO-DO-SISTEMA, POLITICA-DE-APROVACAO, OPERACAO, RECUPERACAO-DE-DESASTRE, decisões (ADR).

## Antes de 2026-10-08
Ver [docs/PROGRESSO.md](docs/PROGRESSO.md) (11 fases do roteiro de produto, auditorias 01 a 03, modularização, camada mobile, performance).
