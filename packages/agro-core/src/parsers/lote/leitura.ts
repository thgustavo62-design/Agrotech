import { norm } from '../numero.js';
import { LINHAS, RE_AMOSTRA } from './formato.js';
import type { Peso } from './tipos.js';

/** Lê UMA passada de texto: a lista de amostras, as células de cada linha e a identificação do laudo. */

/** Limpa um token de célula; devolve o número e como foi obtido, ou null se for lixo. */
export function lerCelula(bruto: string): { valor: number; peso: Peso } | null {
  const t = bruto.replace(/[^0-9.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!t) return null;
  const virgula = t.replace('.', ',');
  if (/^\d{1,3},\d{2}$/.test(virgula)) return { valor: Number(virgula.replace(',', '.')), peso: 'limpo' };
  // vírgula perdida: "145" -> 1,45 ; "7572" -> 75,72 (3 a 5 dígitos, sem separador)
  if (/^\d{3,5}$/.test(t)) return { valor: Number(`${t.slice(0, -2)}.${t.slice(-2)}`), peso: 'reconstituido' };
  return null;
}

export interface Passada {
  amostras: Array<{ numero_lab: string; rotulo: string; indice: number }>;
  /** chave da linha -> células (uma por amostra, null quando ilegível) */
  celulas: Map<string, Array<{ valor: number; peso: Peso } | null>>;
  ident: Record<string, string | null>;
}

export function lerPassada(texto: string): Passada {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const amostras: Passada['amostras'] = [];
  for (const l of linhas) {
    const m = l.match(RE_AMOSTRA);
    if (m && /-\d+-\d+/.test(m[1]!)) amostras.push({ numero_lab: m[1]!, indice: Number(m[2]), rotulo: m[3]!.trim() });
  }
  const n = amostras.length;
  const celulas: Passada['celulas'] = new Map();

  if (n > 0) {
    const tokensDe = (linha: string) => linha.split(/\s+/).slice(-n).map(lerCelula);
    linhas.forEach((linha, i) => {
      const ln = norm(linha);
      const def = LINHAS.find((d) => d.re.test(ln));
      if (!def || celulas.has(def.chave)) return;
      celulas.set(def.chave, tokensDe(linha));

      // pH em água: o "H₂O" subscrito costuma estragar o rótulo no OCR. Se a linha de pH
      // não foi reconhecida, a linha logo ANTES da de pH CaCl2 é a dele (posição, confiança baixa).
      if (def.chave === 'ph_cacl2' && !celulas.has('ph') && i > 0) {
        const anterior = tokensDe(linhas[i - 1]!);
        if (anterior.filter(Boolean).length >= 2) {
          celulas.set('ph', anterior.map((c) => (c ? { valor: c.valor, peso: 'posicional' as const } : null)));
        }
      }
    });
  }

  return { amostras, celulas, ident: lerIdentificacao(linhas) };
}

function lerIdentificacao(linhas: string[]): Record<string, string | null> {
  const junto = linhas.join('\n');
  const pega = (re: RegExp) => junto.match(re)?.[1]?.trim() || null;
  const dataBR = (rotulo: string) => pega(new RegExp(`${rotulo}\\s*:?\\s*(\\d{2}/\\d{2}/\\d{4})`, 'i'));
  return {
    produtor: pega(/Cliente\s*:\s*(.+?)(?:\s+Registro\b|$)/im),
    propriedade: pega(/Propriedade\s*:\s*(.+?)(?:\s+Data\s+Entrada|$)/im),
    municipio: pega(/Munic[ií]pio\s*:\s*(.+?)(?:\s+Data\s+Emiss|$)/im),
    protocolo: pega(/Registro\s+lote\s*:\s*(\w+)/i),
    // o laudo traz entrada e emissão, não a data de coleta: a entrada é a mais próxima
    data: dataBR('Data\\s+Entrada'),
    data_emissao: dataBR('Data\\s+Emiss[aã]o'),
    convenio: pega(/Conv[eê]nio\s*:\s*(.+?)(?:\s+Material\b|$)/im),
  };
}
