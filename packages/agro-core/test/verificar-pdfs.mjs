// Passa PDFs reais pelo MESMO caminho do app (unpdf -> extrairDeTexto) e mostra o que foi lido.
// uso: node packages/agro-core/test/verificar-pdfs.mjs arq1.pdf arq2.pdf   (precisa de `npm run build` no agro-core)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const web = new URL('../../../node_modules/', import.meta.url).href;
const { getDocumentProxy, extractText } = await import(web + 'unpdf/dist/index.mjs');
const { extrairDeTexto } = await import(new URL('../dist/parsers/index.js', import.meta.url).href);
for (const arq of process.argv.slice(2)) {
  try {
  const buf = readFileSync(arq);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const texto = Array.isArray(text) ? text.join('\n') : text;
  console.log(`\n=== ${arq.split('/').pop()} — ${totalPages} pág., ${texto.length} caracteres de texto`);
  if (texto.trim().length < 200) { console.log('  -> sem texto nativo: iria para o OCR'); continue; }
  const e = extrairDeTexto(texto);
  const ok = Object.entries(e.campos).filter(([, c]) => c?.valor != null).map(([k, c]) => `${k}=${c.valor}(${c.confianca})`);
  console.log('  perfil:', e.perfil, '| lab:', e.laboratorio, '| amostras:', e.amostras?.length ?? 1, '| confiança média:', e.confianca_media);
  console.log('  campos:', ok.join(' ') || '(nenhum)');
  if (e.avisos?.length) console.log('  avisos:', e.avisos.slice(0, 3).join(' / '));
  } catch (e) { console.log(`
=== ${arq}: ERRO ${String(e.message).slice(0, 80)}`); }
}
