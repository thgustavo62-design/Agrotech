# Academy — a universidade do produtor

Primeiro módulo do plano de expansão (AgroTech 2.0: Academy, Connect e Intelligence — documento de produto do dono, fora do repositório).
Esta página registra **o que foi construído**, **como funciona** e **o que falta**. Detalhe de cada entrega: [PROGRESSO.md](PROGRESSO.md).

## O que existe (fatia 1 — biblioteca e indicação)

| Plano | O que é | Onde |
|---|---|---|
| AC-01 | Biblioteca: **vídeo** (link), **artigo** (texto do escritório) e **material** (PDF/imagem ou link), com cultura, tema, nível, duração e fonte | `/app/academy`, `/app/academy/novo`, `/app/academy/[id]` |
| AC-03 | Publicação para **todos** os produtores ou só **selecionados** | formulário do conteúdo |
| AC-04 | Rascunho → publicado → arquivado; **quem publicou e quando** fica registrado pelo banco (revisor) | `academy_conteudos.revisado_por/revisado_em` |
| AC-06 | Material de apoio em arquivo privado (bucket `academy`, 10 MB, confere o conteúdo do arquivo) | Storage + `signed URL` |
| AC-12 | **Indicar** conteúdo a um ou mais produtores, com recado, a partir da tela do conteúdo (aceita contexto de visita/análise) | seção "Indicar a produtores" |
| AC-13 | Busca (sem acento) e filtros por tipo, tema e situação | lista do escritório e do produtor |
| — | **Acompanhamento**: indicada → abriu → concluiu, visível ao agrônomo | seção de indicações |
| — | **Portal do produtor**: "Universidade" com "Indicado pelo seu agrônomo" (progresso) e a biblioteca; aviso no sino ao ser indicado | `/produtor/universidade` |

## Regras (impostas no banco — migração `0046`, testada em `packages/db-test/test/academy.test.ts`)

- **Quem mexe:** `academy.gerenciar` (criar/editar/publicar/arquivar) = Agronômico e Proprietário; `academy.indicar` = Agronômico, Campo e Proprietário. Consulta e Financeiro só leem. Restritivo na RLS: vale mesmo chamando a API direto.
- **O produtor só lê o que foi publicado e é para ele** (para todos, selecionado para ele, ou indicado a ele). Rascunho e arquivado nunca. Outro produtor do mesmo escritório e outro escritório não veem.
- **O produtor só marca "abri" e "concluí"** nas próprias indicações — uma vez, com a hora do servidor; nada mais muda.
- **Indicar não altera laudo, análise nem recomendação.** Só conteúdo publicado pode ser indicado; produtor e contexto (visita/análise) têm de ser do mesmo escritório/produtor.
- **Link só `https`** (nunca `http`, `javascript:`, `data:`); publicar exige que haja o que mostrar (vídeo com link, artigo com texto, material com arquivo ou link).
- **Arquivo** só na pasta do escritório; o produtor só lê o arquivo de um conteúdo que a RLS dele deixa ver.
- **LGPD:** apagar o produtor apaga as indicações e seleções dele; o conteúdo do escritório fica.

## Decisões desta fatia

- **Vídeo abre em outra aba** (YouTube, Vimeo…), em vez de embutir: embutir exige abrir a CSP para outro domínio (`frame-src`) — fica para quando houver pedido.
- **Cultura é etiqueta de busca**, não regra de acesso. Segmentar por cultura (AC-03) pode virar regra depois, a partir dos talhões do produtor.
- **Sem cópia de material de terceiros:** o campo "Autoria / fonte" existe para apontar a origem; o sistema não baixa nem republica vídeos ou cartilhas.

## O que falta do plano (em ordem sugerida)

1. **Atlas de doenças e pragas editorial** (AC-08) e **suspeita fitossanitária com fotos** (AC-09) — depende de decidir quem revisa as fichas.
2. **Connect, fatia 1:** solicitação do produtor com foto e propriedade/talhão (CO-02), fila de atendimento e responsável/prazo (CO-03/04), página "Minha assistência" no portal.
3. Botão **"Indicar conteúdo"** direto nas telas de visita e de laudo (a tela já aceita `?produtor=&visita=&analise=`).
4. Progresso por aula, cursos e trilhas (AC-02/05), quiz e certificado (AC-10/11) — P1/P2 do plano.
5. Pré-requisitos do plano que continuam abertos: **backup dos arquivos do Storage** (inclui o bucket `academy`), staging, proteção da `main`, textos jurídicos revisados.
