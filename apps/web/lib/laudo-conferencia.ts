/** Tipos e regras puras da tela de conferência de laudo (o que o OCR/parser extraiu e como mostrar). */

export type CampoExtraido = { valor: number | null; confianca: number; origem: string; bruto?: string };

export type AmostraExtraida = {
  indice: number;
  numero_lab: string | null;
  rotulo: string | null;
  campos: Partial<Record<string, CampoExtraido>>;
  extras: Record<string, CampoExtraido>;
};

export type Extracao = {
  perfil: string | null;
  laboratorio: string | null;
  fonte?: 'texto' | 'ocr';
  amostras?: AmostraExtraida[];
  campos: Partial<Record<string, CampoExtraido>>;
  identificacao: Record<string, string | null>;
  confianca_media: number;
  avisos: string[];
};

/** [chave do campo, rótulo, unidade] na ordem em que aparecem no formulário. */
export const CAMPOS: Array<[string, string, string]> = [
  ['argila', 'Argila', '%'], ['ph', 'pH', 'H₂O'], ['mo', 'M.O.', 'dag/kg'], ['p', 'P', 'mg/dm³'],
  ['k', 'K', 'mg/dm³'], ['na', 'Na', 'mg/dm³'], ['ca', 'Ca', 'cmolc/dm³'], ['mg', 'Mg', 'cmolc/dm³'],
  ['al', 'Al', 'cmolc/dm³'], ['h_al', 'H+Al', 'cmolc/dm³'], ['s', 'S', 'mg/dm³'], ['b', 'B', 'mg/dm³'],
  ['zn', 'Zn', 'mg/dm³'], ['cu', 'Cu', 'mg/dm³'], ['mn', 'Mn', 'mg/dm³'], ['fe', 'Fe', 'mg/dm³'],
];

/** Valores impressos no laudo que o motor recalcula: só para o técnico conferir. */
export const EXTRAS_IMPRESSOS = [['sb', 'SB'], ['t_ctc', 'CTC (T)'], ['v_pct', 'V%'], ['m_pct', 'm%'], ['ph_cacl2', 'pH CaCl₂']] as const;

export function tomConfianca(c: number | undefined): { tom: 'ok' | 'alerta' | 'ruim' | 'cinza'; txt: string } {
  if (c == null) return { tom: 'cinza', txt: 'não encontrado' };
  if (c >= 0.9) return { tom: 'ok', txt: `${Math.round(c * 100)}% confiança` };
  if (c >= 0.8) return { tom: 'alerta', txt: `${Math.round(c * 100)}% — confira` };
  return { tom: 'ruim', txt: `${Math.round(c * 100)}% — confira` };
}

/** yyyy-mm-dd a partir de datas em formato BR ou ISO livre no laudo; senão vazio. */
export function paraDataInput(bruto: string | null | undefined): string {
  if (!bruto) return '';
  const br = bruto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = bruto.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

/** Qual amostra mostrar: a pedida na URL; senão a primeira ainda não confirmada; senão a primeira. */
export function escolherAmostra(amostras: AmostraExtraida[], pedida: number, confirmadas: Set<number>): AmostraExtraida | undefined {
  if (amostras.length < 2) return undefined;
  return amostras.find((a) => a.indice === pedida) ?? amostras.find((a) => !confirmadas.has(a.indice)) ?? amostras[0];
}

/** Abaixo disso o valor vai destacado e só é aceito depois de corrigido ou marcado como conferido pelo técnico. */
export const LIMIAR_CONFERENCIA = 0.9;

export function campoExigeConferencia(c: CampoExtraido | undefined): boolean {
  return c != null && c.valor != null && c.confianca < LIMIAR_CONFERENCIA;
}

/**
 * Campos duvidosos que o técnico nem corrigiu nem marcou como "conferi". Devolve os rótulos para a mensagem.
 * É a trava de fim de linha: nenhuma leitura automática é 100%, então o que o sistema não consegue garantir só entra
 * por decisão explícita de uma pessoa (corrigir o número também conta — digitar é conferir).
 */
export function pendenciasDeConferencia(
  extracao: Extracao | null,
  indice: number | null,
  enviados: Record<string, number | null>,
  conferidos: Set<string>,
): string[] {
  if (!extracao) return [];
  const campos = (indice != null ? extracao.amostras?.find((a) => a.indice === indice)?.campos : undefined) ?? extracao.campos;
  return CAMPOS
    .filter(([chave]) => campoExigeConferencia(campos[chave]))
    .filter(([chave]) => {
      const original = campos[chave]!.valor as number;
      const enviado = enviados[chave];
      const corrigido = enviado == null || Math.abs(enviado - original) > 1e-9;
      return !corrigido && !conferidos.has(chave);
    })
    .map(([, rotulo]) => rotulo);
}
