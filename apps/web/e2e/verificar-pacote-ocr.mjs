// Prova que o PACOTE PUBLICADO da página de envio de laudo consegue fazer OCR sozinho, sem o node_modules do repositório.
// Copia só os arquivos que o `next build` rastreou (page.js.nft.json) para uma pasta isolada (fora do repo) e roda o OCR lá.
// Foi a falta de arquivos aqui (o .wasm do tesseract) que deixava o laudo escaneado preso em "lendo…" no Vercel.
// uso (depois do next build):  node e2e/verificar-pacote-ocr.mjs
import { copyFileSync, existsSync, statSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const web = resolve(fileURLToPath(new URL('..', import.meta.url)));
const raiz = resolve(web, '..', '..');
const nft = join(web, '.next/server/app/(consultor)/app/laudos/novo/page.js.nft.json');
if (!existsSync(nft)) { console.error('rode o next build antes'); process.exit(2); }

const iso = mkdtempSync(join(tmpdir(), 'pacote-ocr-'));
const arquivos = JSON.parse(readFileSync(nft, 'utf8')).files.map((f) => resolve(dirname(nft), f));
let copiados = 0, bytes = 0;
for (const abs of arquivos) {
  if (!existsSync(abs) || !abs.startsWith(raiz)) continue;
  if (!statSync(abs).isFile()) continue;
  const alvo = join(iso, relative(raiz, abs));
  mkdirSync(dirname(alvo), { recursive: true });
  copyFileSync(abs, alvo);
  copiados++;
}
console.log(`pacote simulado: ${copiados} arquivos em ${iso}`);

// PDF só de imagem, gerado AQUI (com o node_modules completo) e entregue pronto ao ambiente isolado
const { createCanvas } = await import(pathToFileURL(join(raiz, 'node_modules/@napi-rs/canvas/index.js')).href);
const { PDFDocument } = await import('pdf-lib');
const tela = createCanvas(1240, 1754);
const g = tela.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, 1240, 1754); g.fillStyle = '#000'; g.font = '46px sans-serif';
['Laboratório AgroSolo', 'Cálcio (cmolc/dm³)       3,1', 'Magnésio (cmolc/dm³)       1,2', 'Potássio (mg/dm³)       96'].forEach((l, i) => g.fillText(l, 80, 230 + i * 84));
const pdf = await PDFDocument.create();
const pg = pdf.addPage([595, 842]);
pg.drawImage(await pdf.embedPng(tela.toBuffer('image/png')), { x: 0, y: 0, width: 595, height: 842 });
const pdfPath = join(iso, 'entrada.pdf');
writeFileSync(pdfPath, await pdf.save());

// o que o servidor faz em lib/ocr-pdf.ts, mas só com o que o pacote tem
const exec = join(iso, 'apps/web/rodar-ocr.cjs');
mkdirSync(dirname(exec), { recursive: true });
writeFileSync(exec, `
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
(async () => {
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const { createWorker } = await import('tesseract.js');
  const modelo = join(__dirname, 'ocr');
  if (!existsSync(join(modelo, 'por.traineddata'))) throw new Error('modelo de idioma ausente do pacote');
  const doc = await getDocumentProxy(new Uint8Array(readFileSync(process.argv[2])));
  const worker = await createWorker('por', 1, { langPath: modelo, gzip: false, cachePath: require('node:os').tmpdir() });
  const png = await renderPageAsImage(doc, 1, { canvasImport: () => import('@napi-rs/canvas'), scale: 2 });
  const { data } = await worker.recognize(Buffer.from(png));
  await worker.terminate();
  console.log(data.text);
  if (!/Cálcio/.test(data.text) || !/Magnésio/.test(data.text)) throw new Error('OCR rodou mas não leu o texto');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
`);

const r = spawnSync(process.execPath, [exec, pdfPath], { cwd: join(iso, 'apps/web'), encoding: 'utf8', env: { PATH: process.env.PATH, TEMP: process.env.TEMP, TMP: process.env.TMP, SystemRoot: process.env.SystemRoot }, timeout: 120_000 });
console.log((r.stdout ?? '').trim());
if (r.status !== 0) console.error((r.stderr ?? '').split('\n').slice(0, 8).join('\n'));
try { rmSync(iso, { recursive: true, force: true }); } catch { /* temporário */ }
console.log(r.status === 0 ? '\n✓ o pacote publicado faz OCR sozinho' : '\n✗ o pacote publicado NÃO faz OCR sozinho');
process.exit(r.status === 0 ? 0 : 1);
