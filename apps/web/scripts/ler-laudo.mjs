// Lê um laudo de solo em PDF pelo mesmo caminho do app e mostra o que foi extraído.
//   node apps/web/scripts/ler-laudo.mjs caminho/do/laudo.pdf [--json]
// Pré-requisito: `npm run build --workspace @agrotech/agro-core`.
// Útil para calibrar um laboratório novo: rode, compare com o PDF e leve o texto ao teste.
import { readFileSync } from 'node:fs';
import { extrairDeTexto, extrairDeLeiturasOcr } from '@agrotech/agro-core/parsers';
import { lerPdfEscaneado } from '../lib/ocr-pdf.ts';

const [arquivo, ...flags] = process.argv.slice(2);
if (!arquivo) {
  console.error('uso: node apps/web/scripts/ler-laudo.mjs <laudo.pdf> [--json]');
  process.exit(1);
}

const bytes = new Uint8Array(readFileSync(arquivo));
const { getDocumentProxy, extractText } = await import('unpdf');
const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
const nativo = Array.isArray(text) ? text.join('\n') : text;

let extracao;
let origem;
if (nativo.trim().length >= 200) {
  origem = 'texto nativo do PDF';
  extracao = extrairDeTexto(nativo);
} else {
  origem = 'PDF escaneado -> OCR em 4 resoluções';
  const t0 = Date.now();
  const leituras = await lerPdfEscaneado(bytes);
  console.error(`OCR: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  extracao = extrairDeLeiturasOcr(leituras);
}

if (flags.includes('--json')) {
  console.log(JSON.stringify(extracao, null, 2));
  process.exit(0);
}

console.log(`\nOrigem: ${origem}`);
console.log(`Perfil: ${extracao.perfil ?? '(nenhum)'} · confiança média ${Math.round(extracao.confianca_media * 100)}%`);
console.log('Identificação:', JSON.stringify(extracao.identificacao));
const amostras = extracao.amostras ?? [{ indice: 1, rotulo: null, campos: extracao.campos }];
for (const a of amostras) {
  console.log(`\n--- Amostra ${a.indice}${a.rotulo ? ` · ${a.rotulo}` : ''}`);
  for (const [chave, c] of Object.entries(a.campos)) {
    const marca = c.valor === null ? '??' : c.confianca >= 0.9 ? 'ok' : 'CONFIRA';
    console.log(`  ${chave.padEnd(6)} ${String(c.valor ?? '—').padStart(8)}  ${String(Math.round(c.confianca * 100)).padStart(3)}%  ${marca.padEnd(7)} ${c.origem}`);
  }
}
if (extracao.avisos.length) console.log('\nAvisos:\n' + extracao.avisos.map((a) => '  - ' + a).join('\n'));
