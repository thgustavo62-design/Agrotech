# Atlas de doenças e pragas

Parte da Academy (`/academy/atlas`): fichas com fotos para reconhecer o problema na lavoura, ligadas ao Connect (o produtor pede ajuda a partir da ficha e a equipe aponta uma ficha na resposta). Itens AC-08/AC-09 do plano de expansão.

## O que existe (fatia 1)

- **19 fichas-base de café conilon** (12 doenças e 7 pragas), com 44 fotos, importância no campo e no viveiro, o que favorece, como manejar, como monitorar (nível de controle quando existe) e "pode ser confundida com". Dados em `apps/web/lib/atlas-base.ts`, fotos em `apps/web/public/atlas/`.
- **Busca** por nome, nome científico, outro nome, parte da planta ("folha", "raiz", "fruto") e texto, sem acento; filtro doença/praga. Sem resultado, a tela oferece **atalhos** "Procurar na Embrapa" e "Procurar no Incaper" (abrem a pesquisa em outra aba; o sistema não consulta nem copia nada por trás).
- **Suspeito disso na minha lavoura:** o produtor abre um pedido do Connect com assunto, tipo "problema na lavoura" e origem `atlas` (a equipe vê "veio de uma ficha do Atlas").
- **Resposta com ficha:** na conversa, a equipe escolhe uma ficha; o texto ganha a frase e a conversa mostra um link para ela.

## Fonte e autorização

O conteúdo vem da **Embrapa Rondônia** (capítulos 1 e 2 do guia de diagnose e manejo de doenças e pragas do cafeeiro na Amazônia, links do original em cada ficha). **O dono do sistema informou em 09/10/2026 que a Embrapa autoriza a reprodução**; guarde essa autorização por escrito (e-mail ou termo). Cada ficha mostra a instituição, os autores, o título, o link do documento e a autoria das fotos.

Escolhas editoriais (política de aprovação):
- **Sem produto e sem dose.** As tabelas de defensivos do documento (princípios ativos, doses, volumes de calda) **não** foram trazidas. Onde o texto fala em controle químico, a ficha diz que existe e que **produto, dose e época são do agrônomo, com receituário** (teste automático confere que não entra dose nem princípio ativo).
- **Condições da Amazônia.** Épocas, níveis e variedades (ex.: BRS Ouro Preto) são de Rondônia; cada tela avisa que podem ser diferentes no município. O Incaper tem material próprio do conilon do Espírito Santo, que o escritório pode acrescentar.
- O conteúdo é de **apoio ao reconhecimento**; o diagnóstico é do agrônomo.

## Próximas fatias

- Fichas **do escritório** (manual técnico do agrônomo): cadastro no Estúdio com fotos próprias, entrando na mesma busca e na indicação ao produtor. Exige migração (novo tipo `ficha` + fotos) e fica na frente do que já existe.
- Mais culturas e o material do Incaper (conilon do ES), se houver autorização.
- Foto do produtor + "qual ficha parece?" (IA com visão): serviço pago e envio de imagem a terceiro — só com aprovação.
