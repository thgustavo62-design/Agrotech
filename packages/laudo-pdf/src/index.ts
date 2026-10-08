import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { nomeCorretivo, type Recomendacao } from '@agrotech/agro-core';

/** Contexto gravado junto da recomendação por `emitirRecomendacao` (o PDF não lê profiles). */
export interface ContextoPdf {
  produtor: string;
  propriedade: string;
  municipio: string;
  talhao: string;
  variedade: string;
  culturaNome: string;
  culturaUn: string;
  culturaParc: string[];
  culturaObs: string;
  dataColeta: string;
  profundidade: string;
  laboratorio: string;
  consultor: { nome: string; crea: string; fone: string; empresa: string };
}

/** Conteúdo de `agro.recomendacoes.resultado`. */
export type ResultadoLaudo = Recomendacao & {
  contexto: ContextoPdf;
  analise_valores: Record<string, unknown>;
};

const A4 = { w: 595.28, h: 841.89 };
const MARGEM = 48;
const VERDE = rgb(0.13, 0.4, 0.2);
const TINTA = rgb(0.1, 0.1, 0.1);
const CINZA = rgb(0.4, 0.4, 0.4);
const LINHA = rgb(0.8, 0.8, 0.8);

const SUBSTITUI: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '→': '->', '≥': '>=', '≤': '<=',
};

/** pt-BR sem depender de ICU (Deno e Node formatam igual). */
export function fmt(v: unknown, casas = 1): string {
  // em branco é "não informado", não zero
  if (v == null || String(v).trim() === '') return '—';
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  const [int, dec] = (Number.isFinite(x) ? x : 0).toFixed(casas).split('.');
  const milhar = int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${milhar},${dec}` : milhar;
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Helvetica padrão só codifica WinAnsi: troca subscritos/símbolos e troca o resto por "?". */
function limpar(txt: string, fonte: PDFFont): string {
  const suportado = new Set(fonte.getCharacterSet());
  let out = '';
  for (const ch of txt.replace(/[₀-₉→≥≤]/g, (c) => SUBSTITUI[c] ?? c)) {
    out += suportado.has(ch.codePointAt(0)!) ? ch : '?';
  }
  return out;
}

class Pagina {
  page!: PDFPage;
  y = 0;

  constructor(readonly doc: PDFDocument, readonly normal: PDFFont, readonly negrito: PDFFont) {
    this.nova();
  }

  nova() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - MARGEM;
  }

  garantir(altura: number) {
    if (this.y - altura < MARGEM + 20) this.nova();
  }

  texto(txt: string, x: number, o: { tam?: number; negrito?: boolean; cor?: ReturnType<typeof rgb> } = {}) {
    const fonte = o.negrito ? this.negrito : this.normal;
    this.page.drawText(limpar(txt, fonte), { x, y: this.y, size: o.tam ?? 10, font: fonte, color: o.cor ?? TINTA });
  }

  /** Quebra por largura e escreve; avança o cursor. */
  paragrafo(txt: string, o: { tam?: number; x?: number } = {}) {
    const tam = o.tam ?? 10;
    const x = o.x ?? MARGEM;
    const largura = A4.w - MARGEM - x;
    let linha = '';
    const linhas: string[] = [];
    for (const palavra of limpar(txt, this.normal).split(/\s+/).filter(Boolean)) {
      const tenta = linha ? `${linha} ${palavra}` : palavra;
      if (this.normal.widthOfTextAtSize(tenta, tam) > largura && linha) {
        linhas.push(linha);
        linha = palavra;
      } else linha = tenta;
    }
    if (linha) linhas.push(linha);
    for (const l of linhas) {
      this.garantir(tam + 4);
      this.texto(l, x, { tam });
      this.y -= tam + 4;
    }
  }

  titulo(txt: string) {
    this.garantir(40);
    this.y -= 10;
    this.texto(txt, MARGEM, { tam: 12, negrito: true, cor: VERDE });
    this.y -= 4;
    this.page.drawLine({ start: { x: MARGEM, y: this.y }, end: { x: A4.w - MARGEM, y: this.y }, thickness: 0.6, color: LINHA });
    this.y -= 14;
  }

  /** Linha de tabela: colunas proporcionais a `pesos` (iguais por padrão). */
  linha(celulas: string[], o: { cabecalho?: boolean; direita?: boolean; pesos?: number[] } = {}) {
    this.garantir(18);
    const total = A4.w - 2 * MARGEM;
    const pesos = o.pesos ?? celulas.map(() => 1);
    const soma = pesos.reduce((s, p) => s + p, 0);
    const fonte = o.cabecalho ? this.negrito : this.normal;
    let x = MARGEM;
    celulas.forEach((c, i) => {
      const w = (total * pesos[i]!) / soma;
      const txt = limpar(c, fonte);
      const larg = fonte.widthOfTextAtSize(txt, 9.5);
      this.texto(txt, o.direita ? x + w - larg - 4 : x, { tam: 9.5, ...(o.cabecalho ? { negrito: true } : {}) });
      x += w;
    });
    this.y -= 15;
  }
}

/**
 * Renderiza o laudo em PDF A4. Conteúdo vem 100% da recomendação persistida —
 * nada é recalculado, para o PDF bater com o que foi emitido (mesma regra do
 * LaudoView). `emitidaEm` é `recomendacoes.emitida_em` (ISO).
 */
export async function renderizarLaudoPdf(res: ResultadoLaudo, emitidaEm: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Laudo de recomendação agronômica');
  doc.setProducer('AgroTech');
  const p = new Pagina(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  const { contexto: c, calculo: r, calagem: cal, adubacao: ad } = res;
  const a = res.analise_valores;
  const v = (k: string, casas: number) => fmt(a[k], casas);

  p.texto('Laudo de recomendação agronômica', MARGEM, { tam: 17, negrito: true });
  p.y -= 15;
  p.texto(`${c.consultor.empresa} · emitido em ${dataBR(emitidaEm)} · motor ${res.motor_versao}`, MARGEM, { tam: 9, cor: CINZA });
  p.y -= 12;
  const quem = [c.consultor.nome || '—', c.consultor.crea && `CREA ${c.consultor.crea}`, c.consultor.fone].filter(Boolean).join(' · ');
  p.texto(quem, MARGEM, { tam: 9, cor: CINZA });
  p.y -= 8;

  p.titulo('1. Identificação');
  const pares = { pesos: [1, 2, 1, 2] };
  p.linha(['Produtor', c.produtor || '—', 'Propriedade', c.propriedade || '—'], pares);
  p.linha(['Município', c.municipio || '—', 'Talhão', `${c.talhao || '—'} · ${fmt(res.areaHa, 1)} ha`], pares);
  p.linha(['Cultura', c.culturaNome || '—', 'Variedade', c.variedade || '—'], pares);
  p.linha(['Coleta', `${dataBR(c.dataColeta)} · ${c.profundidade} cm`, 'Laboratório', c.laboratorio || '—'], pares);

  p.titulo('2. Resultado da análise');
  p.linha(['pH', 'M.O.', 'P', 'K', 'Ca', 'Mg', 'Al', 'H+Al'], { direita: true, cabecalho: true });
  p.linha([v('pH', 1), v('MO', 1), v('P', 1), v('K', 0), v('Ca', 2), v('Mg', 2), v('Al', 2), v('HAl', 2)], { direita: true });
  p.linha(['SB', 'CTC (t)', 'CTC (T)', 'V%', 'm%', 'Ca/Mg', 'Argila', 'S'], { direita: true, cabecalho: true });
  p.linha([fmt(r.SB, 2), fmt(r.t, 2), fmt(r.T, 2), fmt(r.V, 1), fmt(r.m, 1), fmt(r.CaMg, 1), `${v('argila', 0)}%`, v('S', 1)], { direita: true });
  p.linha(['B', 'Zn', 'Cu', 'Mn', 'Fe'], { direita: true, cabecalho: true });
  p.linha([v('B', 2), v('Zn', 1), v('Cu', 1), v('Mn', 1), v('Fe', 1)], { direita: true });

  p.titulo('3. Diagnóstico');
  for (const d of res.diagnostico) p.paragrafo(`• ${d.txt}`, { x: MARGEM + 6 });

  p.titulo('4. Correção do solo');
  const prnt = Number(a['prnt']) || 85;
  p.paragrafo(
    `Elevação da saturação por bases para ${cal.V2}%, com ${nomeCorretivo(res.corretivo.corretivo).toLowerCase()} de PRNT ${prnt}% incorporado a 0-${a['incorp'] ?? 20} cm. ${res.corretivo.motivo}`,
  );
  p.y -= 4;
  p.linha(['Calcário', `${fmt(cal.corrigido, 2)} t/ha`, `${fmt(res.totais.calcario_t, 1)} t no talhão`], { pesos: [1, 1, 1.4] });
  if (res.gessagem.precisa) p.linha(['Gesso agrícola', 'investigar', 'exige análise de 20-40 cm'], { pesos: [1, 1, 1.4] });

  if (ad) {
    p.titulo(`5. Adubação - produtividade esperada de ${fmt(res.produtividade, 1)} ${c.culturaUn}`);
    p.linha(['Nutriente', 'kg/ha', `Total (${fmt(res.areaHa, 1)} ha)`], { cabecalho: true });
    p.linha(['N', String(ad.N), `${fmt(res.totais.N_kg, 0)} kg`]);
    p.linha(['P₂O₅', String(ad.P2O5), `${fmt(res.totais.P2O5_kg, 0)} kg`]);
    p.linha(['K₂O', String(ad.K2O), `${fmt(res.totais.K2O_kg, 0)} kg`]);
    p.y -= 6;
    p.texto('Fontes sugeridas', MARGEM, { tam: 10, negrito: true });
    p.y -= 14;
    for (const ft of res.fontes) p.paragrafo(`• ${ft.nome} - ${fmt(ft.dose, 0)} kg/ha (${ft.obs})`, { x: MARGEM + 6 });

    if (c.culturaParc.length > 0) {
      p.titulo('6. Parcelamento e manejo');
      c.culturaParc.forEach((t, i) => p.paragrafo(`${i + 1}. ${t}`, { x: MARGEM + 6 }));
      if (c.culturaObs) {
        p.y -= 4;
        p.paragrafo(c.culturaObs);
      }
    }
  }

  p.garantir(70);
  p.y -= 30;
  p.page.drawLine({ start: { x: MARGEM, y: p.y }, end: { x: MARGEM + 220, y: p.y }, thickness: 0.6, color: TINTA });
  p.y -= 13;
  p.texto(c.consultor.nome || '—', MARGEM, { tam: 10, negrito: true });
  p.y -= 12;
  p.texto(`Engenheiro(a) Agrônomo(a) - CREA ${c.consultor.crea || '—'}`, MARGEM, { tam: 9, cor: CINZA });

  const paginas = doc.getPages();
  paginas.forEach((pg, i) => {
    pg.drawText(limpar(`AgroTech · motor ${res.motor_versao} · página ${i + 1}/${paginas.length}`, p.normal), {
      x: MARGEM, y: 28, size: 8, font: p.normal, color: CINZA,
    });
  });

  return doc.save();
}
