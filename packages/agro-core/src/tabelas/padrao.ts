import type { TabelasReferencia } from '../tipos.js';

/**
 * TABELAS DE REFERÊNCIA PADRÃO
 *
 * Base de interpretação: Alvarez V. et al. — 5ª Aproximação/MG, com ajustes
 * para as culturas do Espírito Santo (Incaper). São valores de LITERATURA,
 * ponto de partida — cada escritório recebe sua cópia e calibra.
 *
 * A recomendação do sistema segue exatamente o que estiver aqui (ou na cópia
 * calibrada da organização). Mudou número aqui, mudou o laudo.
 */
export const PADRAO: TabelasReferencia = {
  // faixas: 4 quebras => 5 classes (muito baixo, baixo, médio, bom, muito bom)
  faixas: {
    pH:  { rot: 'pH em água', un: '', q: [4.5, 5.4, 6.0, 7.0],
           nomes: ['Ac. muito elevada', 'Ac. elevada', 'Ac. média', 'Adequado', 'Alcalino'],
           cores: ['mb', 'b', 'm', 'mbom', 'm'] },
    MO:  { rot: 'Matéria orgânica', un: 'dag/kg', q: [0.7, 2.0, 4.0, 7.0] },
    P:   { rot: 'Fósforo (Mehlich-1)', un: 'mg/dm³', q: null }, // depende da argila
    K:   { rot: 'Potássio', un: 'mg/dm³', q: [15, 40, 70, 120] },
    Ca:  { rot: 'Cálcio', un: 'cmolc/dm³', q: [0.4, 1.2, 2.4, 4.0] },
    Mg:  { rot: 'Magnésio', un: 'cmolc/dm³', q: [0.15, 0.45, 0.90, 1.50] },
    Al:  { rot: 'Alumínio trocável', un: 'cmolc/dm³', q: [0.2, 0.5, 1.0, 2.0], inv: true },
    HAl: { rot: 'Acidez potencial (H+Al)', un: 'cmolc/dm³', q: [1.0, 2.5, 5.0, 9.0], inv: true },
    S:   { rot: 'Enxofre', un: 'mg/dm³', q: [2.5, 5.0, 10.0, 15.0] },
    B:   { rot: 'Boro', un: 'mg/dm³', q: [0.15, 0.35, 0.60, 0.90] },
    Zn:  { rot: 'Zinco', un: 'mg/dm³', q: [0.4, 0.9, 1.5, 2.2] },
    Cu:  { rot: 'Cobre', un: 'mg/dm³', q: [0.3, 0.7, 1.2, 1.8] },
    Mn:  { rot: 'Manganês', un: 'mg/dm³', q: [2, 5, 8, 12] },
    Fe:  { rot: 'Ferro', un: 'mg/dm³', q: [8, 18, 30, 45] },
    SB:  { rot: 'Soma de bases', un: 'cmolc/dm³', q: [0.6, 1.8, 3.6, 6.0] },
    t:   { rot: 'CTC efetiva (t)', un: 'cmolc/dm³', q: [0.8, 2.3, 4.6, 8.0] },
    T:   { rot: 'CTC a pH 7 (T)', un: 'cmolc/dm³', q: [1.6, 4.3, 8.6, 15.0] },
    V:   { rot: 'Saturação por bases (V)', un: '%', q: [20, 40, 60, 80] },
    m:   { rot: 'Saturação por alumínio (m)', un: '%', q: [15, 30, 50, 75], inv: true },
  },

  // fósforo por classe de argila (Mehlich-1), mg/dm³
  fosforo: [
    { argila: '60–100%', min: 60, q: [2.7, 5.4, 8.0, 12.0] },
    { argila: '35–60%',  min: 35, q: [4.0, 8.0, 12.0, 18.0] },
    { argila: '15–35%',  min: 15, q: [6.6, 12.0, 20.0, 30.0] },
    { argila: '0–15%',   min: 0,  q: [10.0, 20.0, 30.0, 45.0] },
  ],

  culturas: {
    'cafe-conilon': {
      nome: 'Café conilon – produção', un: 'sc/ha (60 kg benef.)', ref: 60, V2: 60, m_max: 20,
      N: 350, P: [80, 60, 45, 30, 20], K: [320, 280, 240, 180, 120],
      parc: [
        'Set–out (após 1ª chuva) – 30% N, todo o P, 30% K',
        'Nov–dez – 40% N, 40% K',
        'Jan–fev – 30% N, 30% K',
      ],
      obs: 'Conilon responde bem a K; manter relação K/Mg equilibrada. Boro em cobertura ou foliar na florada.',
    },
    'cafe-arabica': {
      nome: 'Café arábica – produção', un: 'sc/ha (60 kg benef.)', ref: 30, V2: 60, m_max: 20,
      N: 300, P: [70, 50, 40, 25, 15], K: [280, 240, 200, 150, 100],
      parc: [
        'Out–nov – 1/3 N, todo o P, 1/3 K',
        'Dez–jan – 1/3 N, 1/3 K',
        'Fev–mar – 1/3 N, 1/3 K',
      ],
      obs: 'Aplicar na projeção da saia. Zn e B foliares no pré-florada e chumbinho.',
    },
    'pimenta-do-reino': {
      nome: 'Pimenta-do-reino', un: 't/ha (grão seco)', ref: 3, V2: 60, m_max: 15,
      N: 200, P: [120, 90, 70, 50, 30], K: [220, 180, 150, 120, 80],
      parc: [
        'Início das chuvas – 25% N, todo o P, 25% K',
        '60 dias – 25% N, 25% K',
        '120 dias – 25% N, 25% K',
        '180 dias – 25% N, 25% K',
      ],
      obs: 'Sensível a encharcamento e a Fusarium; evitar ferir raízes na adubação. Matéria orgânica é decisiva.',
    },
    'mamao': {
      nome: 'Mamão', un: 't/ha', ref: 60, V2: 70, m_max: 10,
      N: 350, P: [180, 140, 100, 70, 40], K: [450, 380, 300, 240, 160],
      parc: [
        'Mensal a partir do 1º mês pós-plantio, 12 parcelas iguais de N e K',
        'Todo o P no plantio (cova)',
      ],
      obs: 'Alta exigência em B e Ca – deficiência causa deformação e "pé-de-galinha". Fertirrigação é o padrão.',
    },
    'banana': {
      nome: 'Banana', un: 't/ha', ref: 30, V2: 70, m_max: 10,
      N: 300, P: [100, 80, 60, 40, 20], K: [500, 420, 350, 280, 200],
      parc: [
        '4 a 6 parcelas ao longo do período chuvoso',
        'Todo o P na cova/plantio',
      ],
      obs: 'Cultura extratora de K. Aplicar em meia-lua a 30–40 cm do pseudocaule.',
    },
    'tomate': {
      nome: 'Tomate', un: 't/ha', ref: 80, V2: 70, m_max: 10,
      N: 250, P: [600, 450, 300, 200, 100], K: [500, 400, 300, 220, 150],
      parc: [
        'Plantio – todo o P, 20% N, 20% K',
        'Semanal via fertirrigação – restante',
      ],
      obs: 'Exige Ca alto (evita fundo-preto) e boro. Não aplicar N em excesso no início.',
    },
    'milho': {
      nome: 'Milho – grão', un: 't/ha', ref: 8, V2: 60, m_max: 15,
      N: 140, P: [120, 90, 70, 50, 30], K: [100, 80, 60, 40, 30],
      parc: [
        'Plantio – todo o P, 20–30 kg N, metade do K',
        'V4 – 40% N',
        'V8 – 40% N e restante do K',
      ],
      obs: 'Zn é o micro mais limitante. Não ultrapassar 60 kg/ha de K2O no sulco.',
    },
    'feijao': {
      nome: 'Feijão', un: 't/ha', ref: 2.5, V2: 60, m_max: 15,
      N: 70, P: [90, 70, 50, 40, 20], K: [80, 60, 40, 30, 20],
      parc: [
        'Plantio – todo o P e K, 20 kg N',
        'V4 – restante do N',
      ],
      obs: 'Ciclo curto: parcelar pouco. Atenção a Mo e Zn.',
    },
    'cana': {
      nome: 'Cana-de-açúcar', un: 't/ha', ref: 90, V2: 60, m_max: 20,
      N: 120, P: [150, 120, 90, 60, 30], K: [180, 150, 120, 90, 60],
      parc: [
        'Plantio – todo o P, N e K no sulco',
        'Soqueira – N e K após o corte',
      ],
      obs: 'Considerar o aporte de K da vinhaça, se houver.',
    },
    'pastagem': {
      nome: 'Pastagem – braquiária', un: 'UA/ha', ref: 2, V2: 50, m_max: 30,
      N: 100, P: [90, 70, 50, 40, 20], K: [80, 60, 40, 30, 20],
      parc: [
        'Início das chuvas – todo o P, metade de N e K',
        'Meio da estação – restante',
      ],
      obs: 'Adubação de manutenção anual conforme a lotação. Corrigir P antes de aumentar N.',
    },
    'eucalipto': {
      nome: 'Eucalipto', un: 'm³/ha/ano', ref: 40, V2: 50, m_max: 40,
      N: 60, P: [150, 120, 90, 60, 40], K: [120, 100, 80, 60, 40],
      parc: [
        'Plantio – todo o P na cova',
        '30 e 90 dias – N e K em coroamento',
        '12 meses – manutenção',
      ],
      obs: 'Tolerante a acidez. B é limitante em solos arenosos (seca-de-ponteiro).',
    },
  },

  fertilizantes: [
    { nome: 'Ureia',                N: 45, P: 0,  K: 0,  extra: '—' },
    { nome: 'Sulfato de amônio',    N: 20, P: 0,  K: 0,  extra: '24% S' },
    { nome: 'Nitrato de amônio',    N: 32, P: 0,  K: 0,  extra: '—' },
    { nome: 'MAP',                  N: 11, P: 52, K: 0,  extra: '—' },
    { nome: 'Superfosfato simples', N: 0,  P: 18, K: 0,  extra: '16% Ca, 10% S' },
    { nome: 'Superfosfato triplo',  N: 0,  P: 41, K: 0,  extra: '12% Ca' },
    { nome: 'Cloreto de potássio',  N: 0,  P: 0,  K: 60, extra: '—' },
    { nome: 'Sulfato de potássio',  N: 0,  P: 0,  K: 48, extra: '16% S' },
    { nome: 'NPK 20-05-20',         N: 20, P: 5,  K: 20, extra: 'formulado' },
    { nome: 'NPK 20-00-20',         N: 20, P: 0,  K: 20, extra: 'formulado' },
  ],

  pragas: [
    { cultura: 'cafe-conilon', alvo: 'Broca-do-café', nivel: '3–5% de frutos brocados', metodo: 'Amostrar 100 frutos em 10 plantas/talhão' },
    { cultura: 'cafe-conilon', alvo: 'Ácaro-da-mancha-anular', nivel: 'Presença em 10% das folhas', metodo: 'Lupa de campo, folhas do terço médio' },
    { cultura: 'cafe-conilon', alvo: 'Ferrugem', nivel: '5% de incidência foliar', metodo: 'Contar folhas com pústulas em 30 plantas' },
    { cultura: 'cafe-arabica', alvo: 'Bicho-mineiro', nivel: '20–30% de folhas minadas', metodo: '2 folhas do 3º/4º par, 30 plantas' },
    { cultura: 'cafe-arabica', alvo: 'Ferrugem', nivel: '5% de incidência foliar', metodo: 'Contar folhas com pústulas em 30 plantas' },
    { cultura: 'mamao', alvo: 'Ácaro-rajado', nivel: '10% de folhas com colônia', metodo: 'Folha nº 5 a partir do ápice' },
    { cultura: 'mamao', alvo: 'Mosca-branca', nivel: '5 adultos/folha', metodo: 'Batida de folha ao amanhecer' },
    { cultura: 'banana', alvo: 'Sigatoka-negra', nivel: 'Estádio 4 na folha 2–4', metodo: 'Sistema de pré-aviso (10 plantas)' },
    { cultura: 'banana', alvo: 'Moleque-da-bananeira', nivel: '5 insetos/isca', metodo: 'Iscas tipo telha, 20/ha' },
    { cultura: 'pimenta-do-reino', alvo: 'Fusariose', nivel: 'Qualquer planta com sintoma', metodo: 'Inspeção e erradicação imediata' },
    { cultura: 'tomate', alvo: 'Traça-do-tomateiro', nivel: '2 lagartas/planta', metodo: 'Armadilha de feromônio + inspeção' },
    { cultura: 'milho', alvo: 'Lagarta-do-cartucho', nivel: '20% de plantas raspadas', metodo: '10 plantas em 5 pontos' },
  ],
};

/** Cópia profunda das tabelas padrão (para seed e para snapshot). */
export function clonarPadrao(): TabelasReferencia {
  return JSON.parse(JSON.stringify(PADRAO)) as TabelasReferencia;
}
