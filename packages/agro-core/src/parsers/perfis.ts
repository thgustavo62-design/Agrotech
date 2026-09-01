import type { PerfilLab } from './tipos.js';

/**
 * Perfis declarativos de parsing por laboratório. Em vez de um parser genérico
 * frágil, cada laboratório ganha o seu; o genérico-mehlich é o fallback.
 *
 * Novos perfis: acrescente aqui e um caso de teste em test/parser.test.ts com
 * um laudo real anonimizado.
 */
export const PERFIS: PerfilLab[] = [
  {
    id: 'generico-mehlich',
    assinatura: [/mehlich/i, /cmolc/i],
    campos: {
      ph: { rotulos: ['pH em água', 'pH H2O', 'pH (H2O)', 'pH água', 'pH CaCl2', 'pH'], unidade: '-' },
      mo: {
        rotulos: ['M.O.', 'MO', 'Matéria orgânica', 'Carbono orgânico', 'C orgânico'],
        unidade: 'dag/kg',
        transform: (v, rotulo) => (/carbono|c org/i.test(rotulo) ? v * 1.724 : v),
      },
      p: { rotulos: ['P (Mehlich)', 'P Mehlich', 'P disponível', 'Fósforo', 'P'], unidade: 'mg/dm3' },
      k: {
        rotulos: ['K', 'Potássio'],
        unidade: 'mg/dm3',
        transform: (v, _r, unidade) => (/cmolc/i.test(unidade) ? v * 391 : v),
      },
      na: { rotulos: ['Na', 'Sódio'], unidade: 'mg/dm3' },
      ca: { rotulos: ['Ca2+', 'Ca²⁺', 'Cálcio', 'Ca'], unidade: 'cmolc/dm3' },
      mg: { rotulos: ['Mg2+', 'Mg²⁺', 'Magnésio', 'Mg'], unidade: 'cmolc/dm3' },
      al: { rotulos: ['Al3+', 'Al³⁺', 'Alumínio', 'Al'], unidade: 'cmolc/dm3' },
      h_al: { rotulos: ['H+Al', 'H + Al', 'Acidez potencial'], unidade: 'cmolc/dm3' },
      s: { rotulos: ['S', 'Enxofre', 'S-SO4'], unidade: 'mg/dm3' },
      b: { rotulos: ['B', 'Boro'], unidade: 'mg/dm3' },
      zn: { rotulos: ['Zn', 'Zinco'], unidade: 'mg/dm3' },
      cu: { rotulos: ['Cu', 'Cobre'], unidade: 'mg/dm3' },
      mn: { rotulos: ['Mn', 'Manganês'], unidade: 'mg/dm3' },
      fe: { rotulos: ['Fe', 'Ferro'], unidade: 'mg/dm3' },
      argila: { rotulos: ['Argila', 'Teor de argila'], unidade: '%' },
    },
    identificacao: {
      produtor: ['Cliente', 'Produtor', 'Interessado', 'Requerente'],
      propriedade: ['Propriedade', 'Fazenda', 'Sítio', 'Local'],
      amostra: ['Amostra', 'Identificação', 'Talhão', 'Gleba'],
      protocolo: ['Protocolo', 'Nº', 'Laudo', 'Registro'],
      data: ['Data de coleta', 'Coleta', 'Recebimento', 'Emissão'],
      profundidade: ['Profundidade', 'Camada'],
    },
  },
];

/** Escolhe o primeiro perfil cuja assinatura inteira casa no texto. */
export function detectarPerfil(texto: string, perfis: PerfilLab[] = PERFIS): PerfilLab | null {
  return perfis.find((p) => p.assinatura.every((re) => re.test(texto))) ?? null;
}
