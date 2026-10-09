# Academy — a universidade do produtor

Um dos **três sites** do AgroTech (ver [SITES.md](SITES.md)). É um site à parte, com molde próprio (barra no topo, vitrine de cursos, página de aula), no estilo de plataformas de cursos como o SENAR Play: o produtor entra, escolhe um curso, faz as aulas no ritmo dele e, ao concluir, recebe o certificado de participação.
A **Assistência Técnica** (painel do escritório e portal do produtor) não tem mais nada da Academy no menu; a entrada é pela tela de login, escolhendo o site.

Detalhe de cada entrega: [PROGRESSO.md](PROGRESSO.md). Banco: migrações `0046`, `0047`, `0048`.

## O que o aluno (produtor) vê — `/academy`

| Tela | O que tem |
|---|---|
| **Início** (`/academy`) | Hero com busca, "Continue de onde parou", "Indicado pelo seu agrônomo", cursos para você, explorar por tema, aulas avulsas, notícias do agro |
| **Cursos** (`/academy/cursos`) | Catálogo com busca (sem acento) e filtros por tema, nível e cultura; aulas avulsas que combinam com a busca |
| **Curso** (`/academy/cursos/[id]`) | Capa, resumo, "sobre", módulos e aulas (com ✓ nas concluídas), progresso, "Começar/Continuar", certificado quando concluído |
| **Aula** (`/academy/aula/[id]`) | Vídeo (o player do YouTube/Vimeo só carrega depois do clique), artigo, material ou notícia; roteiro do curso ao lado; "Concluir e ir para a próxima" |
| **Meus cursos** | Em andamento, concluídos e certificados, indicados para mim |
| **Certificado** (`/academy/certificados/[id]`) | Imprimível (PDF pelo navegador), com código de conferência |
| **Notícias** | Resumos do escritório com fonte e link da matéria original |

Abrir a primeira aula de um curso matricula o aluno; concluir todas as aulas conclui a matrícula e emite o certificado **no banco** (não pela tela).

## O que a equipe faz — Estúdio (`/academy/estudio`)

- **Cursos:** dados (título, resumo, sobre, cultura, tema, nível, capa, destaque, certificado, quem vê), **módulos e aulas** (cada aula é um conteúdo da biblioteca; subir/descer/tirar), publicar/arquivar/excluir, indicar a produtores, acompanhar os alunos.
- **Conteúdos:** vídeo (link), artigo (texto), material (PDF/imagem/link) e **notícia** (resumo com as próprias palavras + fonte + link); publicar para todos, **por cultura** ou só selecionados; indicar avulso.
- **Visão geral:** números e quem está aprendendo.
- Permissões: `academy.gerenciar` (Agronômico e Proprietário) monta e publica; `academy.indicar` (Agronômico, Campo e Proprietário) indica. Consulta e Financeiro só leem (e nem veem o Estúdio no menu).

## Regras no banco (testadas em `packages/db-test/test/academy*.test.ts`)

- O produtor só vê o que foi **publicado e é para ele** (todos, por cultura, selecionado ou indicado). Rascunho e arquivado nunca. Outro produtor e outro escritório nunca.
- As aulas de um curso visível são visíveis, mesmo que o conteúdo avulso fosse "só selecionados".
- **Não se publica curso sem aula, nem com aula não publicada; não se tira do ar uma aula de curso publicado; apagar conteúdo que é aula é recusado.**
- O produtor só grava o **próprio** progresso e matrícula, com a hora do servidor; concluir não se desfaz; matrícula concluída e certificado só nascem da conta do banco.
- O certificado guarda uma **foto** do que valia na emissão (curso, aluno, escritório, responsável técnico com CREA, carga horária prevista) — renomear o curso depois não muda o certificado já emitido.
- Link só `https`; arquivo só na pasta do escritório; apagar o produtor apaga matrículas, progresso e certificados dele (LGPD).
- **Notícia:** só publica com resumo próprio, fonte e link. O sistema não copia nem republica matérias.

## O certificado

É **certificado de participação do escritório**. O texto da tela diz que não equivale a certificação acadêmica nem a habilitação profissional e que a carga horária é a **prevista** nas aulas (soma da duração declarada), não tempo medido. A conferência é pelo código (`AT-XXXXX-XXXXX`): hoje o aluno informa o código ao escritório; uma página pública de validação exigiria abrir uma função ao público e fica para quando for decidido.

## Decisões

- **Vídeo embutido só do YouTube (modo sem cookies) e do Vimeo**, depois do clique. A CSP ganhou `frame-src` apenas com esses dois endereços; o identificador do vídeo é conferido letra a letra antes de ir para o iframe.
- **Cultura** segmenta a visibilidade: "café" alcança quem tem talhão de café-conilon ou café-arábica, também para talhões criados depois.
- Sem custo, sem serviço externo pago, sem mensagens fora do sistema.

## O que falta

1. **Atlas de doenças e pragas** (fichas editoriais) e **suspeita fitossanitária com fotos** ao consultor — esta última depende do Connect (pedido com foto).
2. Botão **"Indicar conteúdo"** dentro das telas de visita e de laudo da Assistência (a indicação já aceita o contexto `?produtor=&visita=&analise=`).
3. **Quiz** por aula/curso com nota mínima para concluir.
4. **Painel de uso** (quem acessou, quais aulas funcionam) e página pública de **validação do certificado**.
5. Pré-requisitos do plano de expansão: backup dos arquivos do Storage (inclui o bucket `academy`), staging, proteção da `main`, textos jurídicos revisados.
