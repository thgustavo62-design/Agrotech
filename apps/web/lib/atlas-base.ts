/**
 * Atlas de doenças e pragas — fichas-base do café conilon (Coffea canephora).
 *
 * Conteúdo da Embrapa Rondônia (reprodução autorizada, informada pelo dono do sistema em 09/10/2026), com fonte, autoria das
 * fotos e link do documento original em cada ficha. As condições descritas são as da Amazônia: épocas, níveis e variedades
 * podem ser diferentes no seu município, e cada tela diz isso.
 *
 * Escolha editorial: ficam de fora os NOMES de produtos, os princípios ativos e as DOSES (tabelas de defensivos do documento).
 * Quem escolhe produto e dose é o agrônomo, com receituário. O texto de manejo cultural, biológico e de monitoramento foi mantido.
 */

export type TipoFicha = 'doenca' | 'praga';

export interface FonteAtlas {
  titulo: string;
  autores: string;
  instituicao: string;
  url: string;
}

export const FONTES: Record<'doencas' | 'pragas', FonteAtlas> = {
  doencas: {
    titulo: 'Identificação e manejo de doenças do cafeeiro (Coffea canephora) — capítulo 1 do guia sobre diagnose e manejo de doenças e pragas do cafeeiro na Amazônia',
    autores: 'José Roberto Vieira Júnior, Aline Souza da Fonseca e Tamiris Chaves Freire',
    instituicao: 'Embrapa Rondônia',
    url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1126495/1/cpafro-18471-cap1.pdf',
  },
  pragas: {
    titulo: 'Identificação e manejo de pragas do cafeeiro (Coffea canephora) — capítulo 2 do guia sobre diagnose e manejo de doenças e pragas do cafeeiro na Amazônia',
    autores: 'José Nilton Medeiros Costa, Aline Souza da Fonseca, Tamiris Chaves Freire e Alessandra Pascoal Costa Lima',
    instituicao: 'Embrapa Rondônia',
    url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1126497/1/cpafro-18472-cap2.pdf',
  },
};

export interface FichaAtlas {
  slug: string;
  tipo: TipoFicha;
  nome: string;
  cientifico: string;
  outrosNomes?: string[];
  /** onde a parte da planta aparece: ajuda a achar "folha", "raiz", "fruto"… na busca */
  partes: string[];
  importancia: { campo: string; viveiro: string };
  sobre: string[];
  favorecem: string[];
  manejo: string[];
  monitoramento?: string[];
  confunde?: string;
  /** quantas fotos existem em /atlas/{slug}-{n}.jpg */
  fotos: number;
  creditos: string;
}

const C_DOENCAS = 'José R. Vieira Júnior — Embrapa Rondônia';
const C_PRAGAS = 'J. Nilton M. Costa — Embrapa Rondônia';

export const FICHAS: FichaAtlas[] = [
  // ───────────── doenças ─────────────
  {
    slug: 'ferrugem-alaranjada', tipo: 'doenca', nome: 'Ferrugem-alaranjada', cientifico: 'Hemileia vastatrix', partes: ['folha'],
    importancia: { campo: 'Extrema', viveiro: 'Baixa' },
    sobre: [
      'Principal doença da parte aérea da cultura: sem controle, pode reduzir a produção em até 30%.',
      'Dependendo do estado nutricional e do grau de suscetibilidade da planta, provoca intensa desfolha.',
    ],
    favorecem: [
      'Meses de fevereiro a julho (na Amazônia).',
      'Disseminada com facilidade pelo vento.',
      'Temperaturas entre 25 e 28 °C.',
      'Umidade relativa maior que 90% à noite.',
      'Costuma aparecer 20 a 30 dias depois de chuvas leves ou moderadas.',
    ],
    manejo: [
      'Monitoramento constante para decidir o momento do controle.',
      'Controle com fungicidas protetores e sistêmicos — produto, dose e época são decisão do agrônomo, com receituário.',
      'Variedades resistentes (para Rondônia, Acre e Mato Grosso a Embrapa recomenda a BRS Ouro Preto; em outras regiões, pergunte ao seu técnico qual serve).',
      'Espaçamento maior (2 × 3 m; 3 × 1,5 m) melhora a ventilação entre as linhas, reduz o molhamento das folhas e aumenta a luz direta: cai a umidade sob a copa e, com ela, a incidência e a severidade.',
      'Vários clones híbridos de Robusta × Conilon têm resistência de média a alta, principalmente os mais aparentados com o Robusta.',
    ],
    monitoramento: [
      '% de incidência = nº de folhas com ferrugem ÷ nº total de folhas avaliadas.',
      'Abaixo de 1%: não aplicar. Entre 1% e 5%: duas aplicações de fungicida protetor. Acima de 5%: série de sistêmico + protetor + protetor (regra da Embrapa; a decisão final é do agrônomo).',
    ],
    fotos: 3, creditos: C_DOENCAS,
  },
  {
    slug: 'cercosporiose', tipo: 'doenca', nome: 'Cercosporiose', cientifico: 'Cercospora coffeicola', outrosNomes: ['Mancha-de-olho-pardo', 'Olho-de-perdiz'], partes: ['folha', 'fruto', 'muda'],
    importancia: { campo: 'Moderada', viveiro: 'Elevada' },
    sobre: [
      'Está associada a cafezais com manejo nutricional ruim, a aplicação intensiva de fungicidas/inseticidas sistêmicos via solo, a lavouras que recebem o sol da tarde diretamente e a solos arenosos.',
      'No viveiro é severa e pode desfolhar completamente as mudas.',
    ],
    favorecem: ['Temperaturas entre 25 e 30 °C.', 'Plantas com deficiências nutricionais.'],
    manejo: [
      'No viveiro: evitar o molhamento excessivo das folhas; adubar o substrato ou usar solo fértil para as mudas; evitar insolação das mudas (aclimatação controlada); fazer aplicações preventivas escalonadas na aclimatação, com orientação do agrônomo.',
      'No campo: pulverizações preventivas com fungicida protetor a cada 15 dias no período chuvoso — produto e dose com o agrônomo.',
      'Vários clones híbridos de Robusta × Conilon têm resistência de média a alta.',
      'Cuidado com a adubação, principalmente a nitrogenada: parcelar quando a dose for alta.',
    ],
    confunde: 'Pode ser confundida com a mancha-de-corynespora.',
    fotos: 3, creditos: C_DOENCAS,
  },
  {
    slug: 'queima-do-fio', tipo: 'doenca', nome: 'Queima-do-fio', cientifico: 'Ceratobasidium noxium', outrosNomes: ['Koleroga'], partes: ['folha', 'ramo'],
    importancia: { campo: 'Elevada', viveiro: 'Mediana' },
    sobre: [
      'Doença típica da Amazônia. Ocorre mais no arábica, mas também causa danos no conilon, principalmente em lavouras mal cuidadas e adensadas.',
      'As folhas ficam presas ao ramo pelo micélio (os "fios") do fungo.',
    ],
    favorecem: [
      'Período mais chuvoso e quente.',
      'Plantios velhos e adensados.',
      'Excesso de restos de cultura no solo.',
      'Cultivos sombreados ou intercalados com hospedeiros secundários (pimenta-longa, seringueira, cacaueiro).',
    ],
    manejo: [
      'Poda dos ramos doentes.',
      'Reduzir o adensamento da lavoura.',
      'Fungicidas à base de cobre, com orientação do agrônomo.',
      'Eliminar plantas daninhas hospedeiras, como a jurubeba e as fabáceas silvestres.',
    ],
    fotos: 2, creditos: C_DOENCAS,
  },
  {
    slug: 'mancha-de-corynespora', tipo: 'doenca', nome: 'Mancha-de-corynespora', cientifico: 'Corynespora cassiicola', partes: ['folha', 'fruto'],
    importancia: { campo: 'Moderada', viveiro: 'Baixa' },
    sobre: [
      'Descrita pela primeira vez em 2008, em plantas de conilon da variedade clonal "Vitória" (clone CV3), em Castelo, no Espírito Santo.',
      'Provoca intensa desfolha.',
    ],
    favorecem: [
      'Temperaturas entre 20 e 32 °C e longos períodos (16 a 44 horas) de umidade relativa alta.',
      'Regiões chuvosas sem períodos secos prolongados.',
      'Plantios adensados e pouco ventilados.',
    ],
    manejo: [
      'Fungicidas dos grupos ditiocarbamatos e triazóis mostraram eficiência em pesquisa — a escolha do produto e da dose é do agrônomo.',
      'Uso de quebra-ventos.',
      'Uso de mudas certificadas.',
      'Se as mudas forem produzidas por sementes, tratar as sementes com fungicida (com orientação técnica).',
    ],
    confunde: 'Pode ser confundida com a cercosporiose (veja as fotos comparativas).',
    fotos: 2, creditos: C_DOENCAS,
  },
  {
    slug: 'seca-dos-ponteiros', tipo: 'doenca', nome: 'Seca-dos-ponteiros', cientifico: 'agente causal indeterminado', partes: ['ramo', 'ponteiro'],
    importancia: { campo: 'Média', viveiro: 'Baixíssima' },
    sobre: [
      'O agente causal não está definido. Uma corrente acredita que fatores abióticos disparam o processo: carga alta de frutos, deficiência nutricional, impedimentos físicos e químicos no solo, podas e desbrotas mal feitas. Outra atribui a doença ao fungo Colletotrichum gloeosporioides.',
      'Ocorre tanto no período chuvoso quanto no seco. Acredita-se que, na seca, esteja ligada ao estresse hídrico: o tecido brota depois de chuvas esporádicas e morre por falta de água.',
    ],
    favorecem: [
      'Períodos quentes e chuvosos (25 a 29 °C e umidade relativa de 100%).',
      'Excesso de adubação nitrogenada.',
    ],
    manejo: [
      'Uso de quebra-ventos.',
      'Adubação equilibrada.',
      'Eliminar os ramos depois da colheita.',
      'Caldas fungicidas aplicadas de forma preventiva, com orientação do agrônomo.',
    ],
    fotos: 2, creditos: C_DOENCAS,
  },
  {
    slug: 'mancha-manteigosa', tipo: 'doenca', nome: 'Mancha-manteigosa', cientifico: 'Colletotrichum spp.', partes: ['folha', 'fruto'],
    importancia: { campo: 'Média', viveiro: 'Baixa' },
    sobre: [
      'É importante nos cafezais das variedades conilon e robusta, onde chega a atacar de 10% a 15% das lavouras. Ocorre em menor escala em híbridos arábica × canéfora (tipo Icatu) e, mais raramente, no arábica.',
    ],
    favorecem: ['Período chuvoso.', 'Plantios com desequilíbrio nutricional.'],
    manejo: [
      'O controle químico pode ser feito de forma semelhante e junto ao da ferrugem — com orientação do agrônomo.',
      'Usar quebra-ventos nas áreas de plantio, para evitar a disseminação do patógeno.',
      'Eliminar as partes doentes da planta e não usar essas plantas para produzir mudas.',
      'Plantas com sintomas avançados devem, de preferência, ser erradicadas.',
    ],
    fotos: 3, creditos: C_DOENCAS,
  },
  {
    slug: 'mancha-aureolada', tipo: 'doenca', nome: 'Mancha-aureolada', cientifico: 'Pseudomonas syringae pv. garcae', outrosNomes: ['Mancha-bacteriana'], partes: ['folha', 'ramo', 'fruto'],
    importancia: { campo: 'Alta', viveiro: 'Alta' },
    sobre: [
      'No campo pode causar intensa desfolha e, em alguns casos, a seca de ramos e frutos, com redução da produção se não for controlada.',
    ],
    favorecem: [
      'Meses de janeiro a abril (na Amazônia), geralmente os mais chuvosos.',
      'Umidade e temperaturas elevadas.',
      'Adensamento de mudas no viveiro.',
    ],
    manejo: [
      'As medidas devem ser preventivas: não existem produtos químicos eficientes contra bacterioses de plantas.',
      'Comprar mudas de viveiros idôneos, com certificado fitossanitário de origem (CFO).',
      'Evitar trazer material de regiões onde a doença é endêmica.',
      'Nos viveiros, fiscalizar com frequência e eliminar mudas com necrose de bordos cloróticos (amarelados) nas folhas.',
      'Onde a doença já ocorre: podar as partes afetadas e aplicar pasta de calda bordalesa; aplicações periódicas de fungicidas à base de cobre, principalmente no período chuvoso, com orientação do agrônomo.',
    ],
    fotos: 2, creditos: C_DOENCAS,
  },
  {
    slug: 'fusariose', tipo: 'doenca', nome: 'Fusariose', cientifico: 'Fusarium oxysporum; Fusarium spp.', partes: ['caule', 'colo', 'raiz'],
    importancia: { campo: 'Elevada', viveiro: 'Baixa' },
    sobre: [
      'Até pouco tempo atrás não era importante. Nos últimos anos muitas lavouras apresentaram a doença, com perdas severas; a maioria dos casos no campo ocorreu em plantas jovens, de até três anos.',
    ],
    favorecem: ['Solos encharcados.', 'Acúmulo de solo no colo da planta.', 'Umidade e temperaturas elevadas.', 'Ferimentos mecânicos na hora do plantio.'],
    manejo: [
      'Eliminar a planta infectada no local, queimar o material doente e enterrar em seguida.',
      'Não há fungicidas nem variedades resistentes recomendados até o momento; há limpeza de viveiros com produtos de bulário, com orientação técnica.',
      'Comprar mudas de viveiros idôneos, com CFO.',
      'Evitar trazer material de regiões onde a doença é endêmica.',
      'Pulverizar o substrato com fungicida antes de semear ou transplantar as mudas cria proteção contra infestação por novas estruturas do patógeno (com orientação técnica).',
    ],
    confunde: 'Pode ser confundida com a roseliniose e a rizoctoniose (veja a tabela de diferenças na ficha da roseliniose).',
    fotos: 1, creditos: C_DOENCAS,
  },
  {
    slug: 'escaldadura', tipo: 'doenca', nome: 'Escaldadura das folhas', cientifico: 'queima abiótica (não é causada por organismo)', outrosNomes: ['Queima abiótica'], partes: ['folha', 'ramo'],
    importancia: { campo: 'Elevada', viveiro: 'Moderada' },
    sobre: [
      'A frequência aumentou nos últimos anos. Está associada à suscetibilidade de clones ao excesso de sol.',
      'No campo é severa e pode desfolhar completamente as plantas.',
    ],
    favorecem: ['Temperaturas elevadas, entre 26 e 35 °C.', 'Plantas com deficiências nutricionais.', 'Mudas com idade entre 180 dias e 1,5 ano.'],
    manejo: [
      'No viveiro: evitar estacas muito longas (maiores que 5 cm) e muito velhas; prolongar a permanência da muda para aumentar a rusticidade aos poucos.',
      'No campo: podar os ramos atacados e usar quebra-sol até a muda chegar a 2 anos; se possível, proteger com palha as mudas levadas ao campo nos primeiros 45 dias.',
      'Usar mais clones, para garantir adaptação a diferentes condições de clima.',
      'Em lavouras adultas, fazer os tratos (poda e desbrota) na época certa, evitando o abafamento da copa.',
      'Evitar excesso de adubação nitrogenada, que deixa os tecidos mais sensíveis à luz solar.',
    ],
    confunde: 'Pode ser confundida com doenças causadas por fungos e bactérias.',
    fotos: 4, creditos: C_DOENCAS,
  },
  {
    slug: 'rizoctoniose', tipo: 'doenca', nome: 'Rizoctoniose', cientifico: 'Rhizoctonia solani', partes: ['colo', 'caule', 'muda'],
    importancia: { campo: 'Baixa', viveiro: 'Moderada' },
    sobre: [
      'Costuma aparecer em viveiros: o ataque é no colo da muda, com anelamento escuro. A parte aérea amarelece de uma vez, com murcha severa e queda de folhas.',
      'No campo pode reduzir muito a área plantada: o colo fica enegrecido e molhado ou entumecido.',
    ],
    favorecem: ['Temperatura elevada e chuva.'],
    manejo: [
      'No viveiro: evitar substrato com muita matéria orgânica; esterilizar sacolas, tubetes e bancadas com hipoclorito de sódio a 2%; eliminar mudas com tombamento e sacolas com sementes que não germinaram; evitar acúmulo de água, mantendo ventilação e luminosidade adequadas.',
      'Tratamento de sementes e irrigação do substrato com fungicida, e aplicações dirigidas no campo: só com orientação do agrônomo.',
    ],
    confunde: 'Pode ser confundida com a fusariose e a roseliniose.',
    fotos: 1, creditos: C_DOENCAS,
  },
  {
    slug: 'nematoide-das-galhas', tipo: 'doenca', nome: 'Nematoide-das-galhas', cientifico: 'Meloidogyne incognita; Meloidogyne spp.', partes: ['raiz'],
    importancia: { campo: 'Extrema', viveiro: 'Extrema' },
    sobre: [
      'Doença de maior importância na agricultura. Reduz a produção e pode matar as plantas. Uma vez infestada a área, é impossível eliminar o nematoide do solo.',
      'Mudas infectadas e cafezais novos infestados têm crescimento reduzido, clorose, queda de folhas, e muitas plantas não sobrevivem ao período seco.',
    ],
    favorecem: ['Compra de mudas não certificadas.', 'Plantas com deficiências nutricionais.'],
    manejo: [
      'No viveiro: eliminar as plantas doentes.',
      'No campo: usar variedades resistentes e plantas-isca, como a crotalária.',
      'Evitar a entrada do nematoide nas áreas de produção.',
      'Existem nematicidas recomendados para uso em covas de plantio — escolha e dose com o agrônomo.',
    ],
    fotos: 1, creditos: C_DOENCAS,
  },
  {
    slug: 'roseliniose', tipo: 'doenca', nome: 'Roseliniose', cientifico: 'Rosellinia spp.', partes: ['raiz', 'colo'],
    importancia: { campo: 'Moderada', viveiro: 'Rara' },
    sobre: [
      'Ataca o sistema radicular, escurecendo as raízes, e causa amarelecimento, desfolha, murcha e morte dos ramos. Está fortemente associada a restos de matéria orgânica no solo, como tocos e palhadas.',
      'Diferenças em relação à rizoctoniose e à fusariose: a roseliniose ocorre depois dos 3 anos de idade, tem micélio claro a branco sob a casca das raízes, com pontuações negras, a casca se solta ao toque e é favorecida por restos de queimada, destoca e galhos; a rizoctoniose e a fusariose ocorrem em plantios jovens (até 1,5 ano), a rizoctoniose é comum em viveiro e a fusariose é favorecida por solo encharcado.',
    ],
    favorecem: ['Temperatura e umidade altas.'],
    manejo: [
      'Não há produtos especificamente recomendados: usar medidas preventivas, como evitar plantar cafeeiros em áreas recém-destocadas.',
      'Retirar tocos, pedaços de madeira e outros restos lignificados da lavoura.',
      'Eliminar as plantas doentes, removendo também o sistema radicular da planta doente ou morta.',
      'Nas reboleiras da doença, aplicar cal virgem (a Embrapa cita 700 g/m²; confirme com o agrônomo antes).',
    ],
    confunde: 'Pode ser confundida com a rizoctoniose e a fusariose.',
    fotos: 3, creditos: C_DOENCAS,
  },

  // ───────────── pragas ─────────────
  {
    slug: 'broca-do-cafe', tipo: 'praga', nome: 'Broca-do-café', cientifico: 'Hypothenemus hampei', partes: ['fruto'],
    importancia: { campo: 'Extrema', viveiro: 'Nula' },
    sobre: [
      'As fases (ovo, larva, pupa e adulto) ocorrem dentro do fruto. O adulto é um pequeno besouro preto: a fêmea mede cerca de 2,0 mm e o macho 1,4 mm.',
      'A perfuração do fruto geralmente começa pela região da cicatriz floral (a "coroa").',
    ],
    favorecem: ['Chuvas normais de setembro a dezembro e abaixo do normal de janeiro a março.', 'Plantios adensados.', 'Cultivos sombreados.'],
    manejo: [
      'Controle cultural: colheita bem feita (sem deixar frutos no chão nem na planta) e repasse (catação dos frutos que sobraram da colheita).',
      'Existem inseticidas e um agente biológico registrados para a broca — produto e dose com o agrônomo.',
    ],
    monitoramento: [
      'Amostragem: 30 cafeeiros por hectare, 20 frutos por planta (5 de cada face de um ramo do terço mediano).',
      '% de infestação = nº de frutos brocados ÷ total de frutos. Nível de controle: 3% de frutos brocados.',
    ],
    fotos: 2, creditos: C_PRAGAS,
  },
  {
    slug: 'acaro-vermelho', tipo: 'praga', nome: 'Ácaro-vermelho', cientifico: 'Oligonychus ilicis', partes: ['folha'],
    importancia: { campo: 'Extrema', viveiro: 'Rara' },
    sobre: [
      'O ácaro perfura as células e suga parte do conteúdo. O ataque bronzeia as folhas, reduz a área foliar e derruba a produção da safra.',
    ],
    favorecem: ['Períodos de seca, com estiagem prolongada.'],
    manejo: [
      'Controle biológico: ácaros predadores da família Phytoseiidae e besouros do gênero Stethorus.',
      'Existem acaricidas registrados — produto e dose com o agrônomo.',
    ],
    monitoramento: [
      'Amostragem: 20 cafeeiros por hectare, duas folhas por planta (do 3º nó de um ramo plagiotrópico do terço médio).',
      '% de infestação = nº de folhas atacadas (com ácaros) ÷ total de folhas. Nível de controle: 30% de folhas atacadas.',
    ],
    fotos: 2, creditos: C_PRAGAS,
  },
  {
    slug: 'bicho-mineiro', tipo: 'praga', nome: 'Bicho-mineiro', cientifico: 'Perileucoptera coffeella', partes: ['folha'],
    importancia: { campo: 'Extrema', viveiro: 'Moderada' },
    sobre: [
      'O adulto é uma pequena mariposa cinza, de asas franjadas. As lagartas são amareladas, de corpo segmentado, e ficam dentro das galerias ("minas") que abrem nas folhas.',
      'As minas provocam a queda e a destruição das folhas, reduzindo a fotossíntese e, por consequência, a produção.',
    ],
    favorecem: ['Período seco.'],
    manejo: [
      'Controle biológico natural: parasitoides (microhimenópteros) e vespas predadoras procuram as lagartas dentro das minas.',
      'Existem inseticidas registrados — produto e dose com o agrônomo, respeitando o equilíbrio dos inimigos naturais.',
    ],
    monitoramento: [
      'Amostragem: 20 cafeeiros por hectare, terceiro par de folhas de um ramo do terço superior, nas faces leste e oeste.',
      '% de infestação = nº de folhas atacadas (com lagartas vivas nas lesões) ÷ total de folhas. Nível de controle: 30% de folhas atacadas.',
    ],
    fotos: 4, creditos: C_PRAGAS,
  },
  {
    slug: 'cochonilha-da-roseta', tipo: 'praga', nome: 'Cochonilha-da-roseta', cientifico: 'Planococcus sp.', outrosNomes: ['Cochonilha-branca'], partes: ['fruto', 'flor', 'raiz'],
    importancia: { campo: 'Extrema', viveiro: 'Nula' },
    sobre: [
      'O adulto é castanho-amarelado, oval, de 3 a 4 mm, com 17 apêndices de cada lado e dois apêndices terminais maiores.',
      'Suga a seiva de botões florais e frutos em desenvolvimento, causando danos nas rosetas da floração até a colheita. Os frutos atacados caem cedo; em alta infestação o prejuízo pode chegar perto de 100%.',
    ],
    favorecem: ['Na Amazônia, a época de maior incidência é a partir de maio, com a queda da chuva e a estiagem de junho a setembro; o ataque muitas vezes vai até o início da estação chuvosa.'],
    manejo: [
      'Controle biológico: predadores (joaninha Azya luteipes, bicho-lixeiro Ceraeochrysa cubana), vários parasitoides e fungos (Verticillium lecanii, Neozygites fumosa).',
      'Há um inseticida registrado — produto e dose com o agrônomo.',
    ],
    monitoramento: [
      'Avaliação visual em duas fases: (1) tronco, colo e raízes; (2) rosetas dos ramos produtivos.',
      'Nível de controle não determinado: controlar o foco inicial (reboleira).',
    ],
    fotos: 2, creditos: C_PRAGAS,
  },
  {
    slug: 'cochonilha-verde', tipo: 'praga', nome: 'Cochonilha-verde', cientifico: 'Coccus sp.', partes: ['folha', 'muda'],
    importancia: { campo: 'Moderada', viveiro: 'Moderada' },
    sobre: [
      'As fases são ovo, ninfa (três ínstares; só a de primeiro ínstar se movimenta) e adulto. As fêmeas adultas são fixas, ovais e achatadas, de 2 a 3 mm; reproduzem-se por partenogênese. Só o macho é alado.',
    ],
    favorecem: ['Período chuvoso, de novembro a fevereiro.'],
    manejo: [
      'Controle biológico: a joaninha Azya luteipes (larva e adulto) preda a cochonilha em todas as fases; fungos como Acrostalagmus albus, Myriangium duriaei e Verticillium lecanii também a controlam.',
      'Há um produto registrado (óleo mineral) — uso com orientação do agrônomo.',
    ],
    monitoramento: [
      'Avaliação visual das folhas (face de baixo).',
      'Nível de controle não determinado: controlar o foco inicial (reboleira).',
    ],
    fotos: 2, creditos: 'J. Nilton M. Costa e Flávio F. Souza — Embrapa Rondônia',
  },
  {
    slug: 'broca-dos-ramos', tipo: 'praga', nome: 'Broca-dos-ramos', cientifico: 'Xylosandrus compactus', partes: ['ramo'],
    importancia: { campo: 'Moderada', viveiro: 'Nula' },
    sobre: [
      'O adulto é um besouro preto de cerca de 2,6 mm. Todas as fases ocorrem dentro do ramo; o adulto perfura os ramos (ortotrópicos e plagiotrópicos) para pôr os ovos.',
    ],
    favorecem: ['Ramos atacados e podados deixados perto da lavoura.', 'Plantios adensados.', 'Cultivos sombreados.'],
    manejo: [
      'Controle cultural: podar e queimar os ramos atacados, para matar ovos, larvas, pupas e adultos que estão dentro deles.',
      'Não há inseticidas registrados para a broca-dos-ramos.',
    ],
    monitoramento: ['Avaliação visual dos ramos.', 'Nível de controle não determinado: controlar o foco inicial (reboleira).'],
    fotos: 3, creditos: 'J. Nilton M. Costa e Paulo Rabelles Reis — Embrapa Rondônia',
  },
  {
    slug: 'lagarta-dos-cafezais', tipo: 'praga', nome: 'Lagarta-dos-cafezais', cientifico: 'Eacles imperialis', partes: ['folha', 'ramo'],
    importancia: { campo: 'Moderada', viveiro: 'Nula' },
    sobre: [
      'Passa por ovo, lagarta, pupa e adulto. Os adultos são mariposas amarelas com muitos pontos escuros nas asas. A lagarta chega a 12 cm e varia de cor (verde-alaranjado, amarelo e marrom).',
    ],
    favorecem: [
      'O primeiro surto costuma ocorrer na passagem do período chuvoso para o seco (abril/maio) e o segundo no fim da seca e início das chuvas (setembro/outubro) — datas da Amazônia.',
    ],
    manejo: [
      'As lagartas costumam ser controladas por inimigos naturais (parasitoides e predadores).',
      'Inseticidas biológicos à base de Bacillus thuringiensis são eficientes quando aplicados no início do ataque; também há inseticida químico registrado — produto e dose com o agrônomo.',
    ],
    monitoramento: ['Avaliação visual dos ramos.', 'Nível de controle não determinado: controlar o foco inicial (reboleira).'],
    fotos: 2, creditos: 'J. Nilton M. Costa e Danilo P. Avilés — Embrapa Rondônia',
  },
];

export const fonteDaFicha = (f: FichaAtlas): FonteAtlas => (f.tipo === 'doenca' ? FONTES.doencas : FONTES.pragas);
export const fotosDaFicha = (f: FichaAtlas): string[] => Array.from({ length: f.fotos }, (_, i) => `/atlas/${f.slug}-${i + 1}.jpg`);
export const fichaPorSlug = (slug: string): FichaAtlas | undefined => FICHAS.find((f) => f.slug === slug);
