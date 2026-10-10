# Atlas de doenças e pragas

Parte da Academy (`/academy/atlas`): fichas com fotos para reconhecer o problema na lavoura, ligadas ao Connect (o produtor pede ajuda a partir da ficha e a equipe aponta uma ficha na resposta). Itens AC-08/AC-09 do plano de expansão.

## O que existe (fatia 1)

- **19 fichas-base de café conilon** (12 doenças e 7 pragas), com 44 fotos, importância no campo e no viveiro, o que favorece, como manejar, como monitorar (nível de controle quando existe) e "pode ser confundida com". Dados em `apps/web/lib/atlas-base.ts`, fotos em `apps/web/public/atlas/`.
- **Organização (referência: SENAR Play):** banner com busca e números (12 doenças, 7 pragas, 44 fotos), chips de navegação (tipo e "onde aparece": folha, fruto e flor, ramo e ponteiros, raiz/colo/caule, muda) e **trilhas** em fileiras — "as mais importantes no campo" e uma por parte da planta. Com busca ou filtro vira grade de resultados. A ficha tem faixa de resumo (importância no campo e no viveiro, onde aparece), galeria com miniaturas, quatro blocos numerados (o que é, o que favorece, como manejar, como monitorar), fonte e fichas parecidas.
- **Busca** por nome, nome científico, outro nome, parte da planta ("folha", "raiz", "fruto") e texto, sem acento; filtro doença/praga. Sem resultado, a tela oferece **atalhos** "Procurar na Embrapa" e "Procurar no Incaper" (abrem a pesquisa em outra aba; o sistema não consulta nem copia nada por trás).
- **Suspeito disso na minha lavoura:** o produtor abre um pedido do Connect com assunto, tipo "problema na lavoura" e origem `atlas` (a equipe vê "veio de uma ficha do Atlas").
- **Resposta com ficha:** na conversa, a equipe escolhe uma ficha; o texto ganha a frase e a conversa mostra um link para ela.

## Fonte e autorização

O conteúdo vem da **Embrapa Rondônia** (capítulos 1 e 2 do guia de diagnose e manejo de doenças e pragas do cafeeiro na Amazônia, links do original em cada ficha). **O dono do sistema informou em 09/10/2026 que a Embrapa autoriza a reprodução**; guarde essa autorização por escrito (e-mail ou termo). Cada ficha mostra a instituição, os autores, o título, o link do documento e a autoria das fotos.

Escolhas editoriais (política de aprovação):
- **Sem produto e sem dose.** As tabelas de defensivos do documento (princípios ativos, doses, volumes de calda) **não** foram trazidas. Onde o texto fala em controle químico, a ficha diz que existe e que **produto, dose e época são do agrônomo, com receituário** (teste automático confere que não entra dose nem princípio ativo).
- **Condições da Amazônia.** Épocas, níveis e variedades (ex.: BRS Ouro Preto) são de Rondônia; cada tela avisa que podem ser diferentes no município. O Incaper tem material próprio do conilon do Espírito Santo, que o escritório pode acrescentar.
- O conteúdo é de **apoio ao reconhecimento**; o diagnóstico é do agrônomo.

## Fichas do escritório (fatia 2)

O agrônomo escreve as fichas dele no **Estúdio → Atlas** (`/academy/estudio/atlas`), a partir do manual técnico: tipo (doença, praga, outro), nome, nome científico, cultura, onde aparece na planta, importância no campo e no viveiro, e quatro blocos de texto com **um item por linha** (o que é, o que favorece, como manejar, como monitorar), mais "pode ser confundida com", apoio/fonte e link opcionais. Até **8 fotos** por ficha, reduzidas no navegador e guardadas no bucket privado da Academy (`{escritório}/atlas/{ficha}/…`).

- **Fluxo:** rascunho → salvar e adicionar fotos → publicar. Publicar exige texto em "o que é", ao menos uma parte da planta e ao menos uma foto (o banco confere); uma ficha publicada não fica sem foto. O banco grava autor e revisor.
- **Quem vê:** o produtor só enxerga a ficha **publicada** do próprio escritório; a equipe vê todas (rascunho e arquivada) e só as do escritório dela. Quem escreve: `academy.gerenciar` (Agronômico e Proprietário); os demais perfis só consultam.
- **No Atlas:** as fichas publicadas entram na mesma busca, nos mesmos filtros e nas mesmas trilhas das fichas-base, com o selo "Do escritório". Na ficha aparece "Ficha escrita pelo seu escritório" e, se houver, o apoio/fonte e o link.
- **No Connect:** a equipe pode apontar uma ficha do escritório na resposta (o grupo "Do seu escritório" aparece na lista) e a conversa mostra o link com o nome da ficha.
- Banco: migração `0050_academy_atlas.sql` (`atlas_fichas`, `atlas_fotos`, regras, RLS, política de leitura das fotos no Storage); 23 testes em `packages/db-test/test/atlas.test.ts`. App: `lib/atlas-escritorio.ts` (regras, com testes), `lib/atlas-dados.ts`, `components/atlas/form-ficha.tsx`, `app/(academy)/academy/estudio/atlas/…`; cenário de navegador `atlas_escritorio`.

## Próximas fatias

- **Indicar uma ficha a um produtor** (como já se indica um conteúdo) e botão "Indicar" dentro da ficha.
- Importar o manual do agrônomo (PDF) em rascunhos de ficha, para revisão — leitura do arquivo sem serviço pago.
- Mais culturas e o material do Incaper (conilon do ES), se houver autorização.
- Foto do produtor + "qual ficha parece?" (IA com visão): serviço pago e envio de imagem a terceiro — só com aprovação.
