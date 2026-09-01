import type {
  CampoExtraido, ChaveCampoLaudo, ExtracaoLaudo, PerfilLab,
} from './tipos.js';
import { PERFIS, detectarPerfil } from './perfis.js';
import { parseNumeroBR, norm } from './numero.js';
import { dentroDaFaixa } from './sanidade.js';

/** Detecta a unidade impressa na linha, em forma canônica. */
function unidadeNaLinha(linhaNorm: string): string {
  if (/cmolc/.test(linhaNorm)) return 'cmolc/dm3';
  if (/mg\/?dm|mg\/l|ppm/.test(linhaNorm)) return 'mg/dm3';
  if (/dag\/kg|g\/kg|%/.test(linhaNorm)) return linhaNorm.includes('dag') ? 'dag/kg' : '%';
  return '';
}

function unidadeBate(esperada: string, detectada: string): boolean {
  if (esperada === '-' || esperada === '') return false; // pH: sem unidade a bater
  if (!detectada) return false;
  const e = esperada.replace(/[³2]/g, '').replace('dm3', 'dm');
  const d = detectada.replace('dm3', 'dm');
  return d.includes(e.split('/')[0] ?? e);
}

/** A linha começa exatamente pelo rótulo (não "P" casando dentro de "pH"). */
function linhaComecaCom(linhaNorm: string, rotuloNorm: string): boolean {
  if (!linhaNorm.startsWith(rotuloNorm)) return false;
  const proximo = linhaNorm.charAt(rotuloNorm.length);
  return proximo === '' || !/[a-z0-9]/.test(proximo);
}

function extrairCampo(
  linhas: string[],
  linhasNorm: string[],
  chave: ChaveCampoLaudo,
  perfil: PerfilLab,
): CampoExtraido | null {
  const campo = perfil.campos[chave];
  if (!campo) return null;

  for (let ri = 0; ri < campo.rotulos.length; ri++) {
    const rotulo = campo.rotulos[ri] as string;
    const rotuloNorm = norm(rotulo);

    for (let li = 0; li < linhasNorm.length; li++) {
      const ln = linhasNorm[li] as string;
      if (!linhaComecaCom(ln, rotuloNorm)) continue;

      const resto = (linhas[li] as string).slice(rotulo.length);
      const bruto = parseNumeroBR(resto);
      if (bruto == null) continue;

      const unidadeDetectada = unidadeNaLinha(ln);
      let valor = campo.transform ? campo.transform(bruto, rotulo, unidadeDetectada) : bruto;
      valor = Math.round(valor * 1000) / 1000;

      let confianca: number;
      if (ri === 0 && unidadeBate(campo.unidade, unidadeDetectada)) confianca = 0.98;
      else if (ri === 0) confianca = 0.9;
      else confianca = 0.8;

      const origem = ri === 0 ? `rótulo "${rotulo}"` : `sinônimo "${rotulo}"`;

      if (!dentroDaFaixa(chave, valor)) {
        return {
          valor: null,
          confianca: 0,
          origem: `${origem} — valor ${valor} fora da faixa plausível, rejeitado`,
          bruto: (linhas[li] as string).trim(),
        };
      }

      return { valor, confianca, origem, bruto: (linhas[li] as string).trim() };
    }
  }
  return null;
}

function extrairIdentificacao(
  linhas: string[],
  linhasNorm: string[],
  perfil: PerfilLab,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [chave, rotulos] of Object.entries(perfil.identificacao)) {
    out[chave] = null;
    for (const rotulo of rotulos) {
      const rn = norm(rotulo);
      const idx = linhasNorm.findIndex((ln) => linhaComecaCom(ln, rn));
      if (idx === -1) continue;
      const linha = linhas[idx] as string;
      const depois = linha.includes(':') ? linha.slice(linha.indexOf(':') + 1) : linha.slice(rotulo.length);
      const valor = depois.trim().replace(/^[-–—.\s]+/, '').trim();
      if (valor) {
        out[chave] = valor;
        break;
      }
    }
  }
  return out;
}

const TODAS: ChaveCampoLaudo[] = [
  'argila', 'ph', 'mo', 'p', 'k', 'na', 'ca', 'mg', 'al', 'h_al',
  's', 'b', 'zn', 'cu', 'mn', 'fe',
];

/**
 * Extrai campos e identificação de um laudo em TEXTO (já extraído do PDF).
 * Não faz OCR e não chama LLM — isso é etapa posterior do pipeline.
 */
export function extrairDeTexto(
  texto: string,
  perfis: PerfilLab[] = PERFIS,
): ExtracaoLaudo {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const linhasNorm = linhas.map(norm);
  const avisos: string[] = [];

  const perfil = detectarPerfil(texto, perfis);
  if (!perfil) {
    return {
      perfil: null,
      laboratorio: null,
      campos: {},
      identificacao: {},
      confianca_media: 0,
      avisos: ['Nenhum perfil de laboratório reconhecido — enviar para normalização por LLM ou lançamento manual.'],
    };
  }

  const campos: Partial<Record<ChaveCampoLaudo, CampoExtraido>> = {};
  for (const chave of TODAS) {
    const c = extrairCampo(linhas, linhasNorm, chave, perfil);
    if (c) {
      campos[chave] = c;
      if (c.valor === null) avisos.push(`${chave}: ${c.origem}`);
    }
  }

  const validos = Object.values(campos).filter((c) => c.valor !== null);
  const confianca_media = validos.length
    ? validos.reduce((s, c) => s + c.confianca, 0) / validos.length
    : 0;

  if (validos.length < 6) {
    avisos.push('Menos de 6 parâmetros extraídos — provável layout novo, revisar na tela de conferência.');
  }

  return {
    perfil: perfil.id,
    laboratorio: perfil.id,
    campos,
    identificacao: extrairIdentificacao(linhas, linhasNorm, perfil),
    confianca_media: Math.round(confianca_media * 1000) / 1000,
    avisos,
  };
}
