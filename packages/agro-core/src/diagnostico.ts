import type {
  Analise, Cultura, ItemDiagnostico, ResultadoCalculo, TabelasReferencia,
} from './tipos.js';
import { n } from './num.js';
import { f0, f1 } from './formato.js';
import { nomeClasse } from './interpretacao.js';
import { V2_PADRAO, M_MAX_PADRAO } from './calagem.js';

/**
 * Regras encadeadas de leitura agronômica. Produzem texto corrido classificado
 * em `crit` (crítico), `atencao` ou `ok`. Ordem = prioridade de leitura.
 */
export function gerarDiagnostico(
  a: Analise,
  r: ResultadoCalculo,
  cultura: Cultura | undefined,
  tab: TabelasReferencia,
): ItemDiagnostico[] {
  const d: ItemDiagnostico[] = [];
  const add = (g: ItemDiagnostico['g'], txt: string) => d.push({ g, txt });

  const V2 = cultura?.V2 ?? V2_PADRAO;
  const mMax = cultura?.m_max ?? M_MAX_PADRAO;
  const pH = n(a.pH);
  const limiteBaixo = (chave: 'S' | 'B' | 'Zn') => tab.faixas[chave].q?.[1] ?? 0;

  if (pH < 5.0) {
    add('crit', 'pH abaixo de 5,0 – acidez elevada limita a absorção de P, Ca, Mg e a atividade microbiana.');
  } else if (pH > 6.8) {
    add('atencao', 'pH acima de 6,8 – risco de indisponibilizar Zn, Mn, Fe e B.');
  }

  if (r.m > mMax) {
    add('crit', `Saturação por alumínio de ${f0(r.m)}% acima do limite da cultura (${mMax}%) – o alumínio está podando o sistema radicular.`);
  }

  if (r.V < V2 - 10) {
    add('crit', `Saturação por bases em ${f0(r.V)}%, contra os ${V2}% desejados. Calagem é a primeira intervenção.`);
  }

  if (r.classeP <= 1) {
    add('crit', `Fósforo ${nomeClasse(r.classeP).toLowerCase()} para solo com ${f0(n(a.argila))}% de argila – resposta esperada à adubação fosfatada é alta.`);
  }

  if (r.classeK <= 1) {
    add('atencao', `Potássio ${nomeClasse(r.classeK).toLowerCase()} – priorize o parcelamento para reduzir perda por lixiviação.`);
  }

  if (n(a.MO) < 2) {
    add('atencao', `Matéria orgânica baixa (${f1(n(a.MO))} dag/kg) – avaliar adubação orgânica, cobertura morta ou braquiária na entrelinha.`);
  }

  if (r.CaMg > 0 && (r.CaMg < 2 || r.CaMg > 5)) {
    add('atencao', `Relação Ca/Mg em ${f1(r.CaMg)}:1, fora da faixa de 2:1 a 5:1 – escolha o corretivo (calcítico ou dolomítico) por essa relação.`);
  }

  if (r.MgK > 0 && r.MgK < 3) {
    add('atencao', `Relação Mg/K em ${f1(r.MgK)}:1 – excesso relativo de K pode induzir deficiência de Mg.`);
  }

  if (n(a.B) <= limiteBaixo('B')) {
    add('atencao', 'Boro baixo – corrigir via solo (bórax/ulexita) ou foliar, principalmente em café, mamão e eucalipto.');
  }

  if (n(a.Zn) <= limiteBaixo('Zn')) {
    add('atencao', 'Zinco baixo – aplicar via solo com o formulado ou foliar no crescimento vegetativo.');
  }

  if (n(a.S) <= limiteBaixo('S')) {
    add('atencao', 'Enxofre baixo – preferir superfosfato simples ou sulfato de amônio como fonte.');
  }

  if (d.length === 0) {
    add('ok', 'Nenhuma limitação química relevante na camada analisada. Manter a fertilidade com adubação de reposição.');
  }

  return d;
}
