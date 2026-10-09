// Gera PDFs de laudo de solo SINTÉTICOS (valores inventados) em vários layouts, com texto nativo, para provar o leitor
// sem depender de laudo real. Cada célula é desenhada separadamente, como fazem os sistemas dos laboratórios.
// uso: node packages/agro-core/test/gerar-laudos-teste.mjs <pasta-de-saida>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const web = new URL('../../../node_modules/', import.meta.url).href;
const { PDFDocument, StandardFonts } = await import(web + 'pdf-lib/cjs/index.js');

const saida = process.argv[2] ?? 'laudos-teste';
mkdirSync(saida, { recursive: true });

/** colunas: x de cada coluna; linhas: arrays de células; cada célula vira um drawText separado. */
async function pdf(nome, { titulo, cabecalho, colunas, linhas, rodape = [] }) {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const pg = doc.addPage([595, 842]);
  let y = 800;
  pg.drawText(titulo, { x: 50, y, size: 15, font: negrito }); y -= 24;
  for (const l of cabecalho) { pg.drawText(l, { x: 50, y, size: 10, font: fonte }); y -= 14; }
  y -= 12;
  for (const l of linhas) {
    l.forEach((cel, i) => { if (cel) pg.drawText(String(cel), { x: colunas[i], y, size: 9.5, font: fonte }); });
    y -= 15;
  }
  y -= 10;
  for (const l of rodape) { pg.drawText(l, { x: 50, y, size: 8, font: fonte }); y -= 11; }
  writeFileSync(join(saida, nome), await doc.save());
}

const ident = ['Cliente: José A. Ferreira', 'Propriedade: Fazenda Boa Esperança', 'Talhão: Gleba 3', 'Profundidade: 0-20 cm', 'Data de coleta: 12/08/2026', 'Protocolo: 26-4471'];

// 1) tabela vertical Parâmetro | Unidade | Resultado | Interpretação — estilo SP (resina, mmolc)
await pdf('sp-vertical-resina.pdf', {
  titulo: 'Laboratório AgroSolo — Análise Química de Solo', cabecalho: ident, colunas: [50, 230, 330, 430],
  linhas: [
    ['Parâmetro', 'Unidade', 'Resultado', 'Interpretação'],
    ['pH (CaCl2)', '', '5,1', 'Médio'],
    ['Matéria Orgânica', 'g/dm³', '28', 'Médio'],
    ['P resina', 'mg/dm³', '14', 'Médio'],
    ['K', 'mmolc/dm³', '2,9', 'Médio'],
    ['Ca', 'mmolc/dm³', '31', 'Alto'],
    ['Mg', 'mmolc/dm³', '12', 'Alto'],
    ['H+Al', 'mmolc/dm³', '38', 'Médio'],
    ['Al', 'mmolc/dm³', '1', 'Baixo'],
    ['Soma de Bases (SB)', 'mmolc/dm³', '45,9', ''],
    ['CTC', 'mmolc/dm³', '83,9', ''],
    ['V%', '%', '55', 'Médio'],
  ],
});

// 2) rótulo, resultado e unidade, depois faixa de referência — estilo MG (Mehlich-1, cmolc)
await pdf('mg-mehlich-resultado-unidade.pdf', {
  titulo: 'Laudo de Análise de Solo — Mehlich-1', cabecalho: ident, colunas: [50, 250, 320, 420],
  linhas: [
    ['Determinação', 'Resultado', 'Unidade', 'Faixa de referência'],
    ['pH em água', '5,4', '', '5,0 - 6,0'],
    ['Matéria orgânica', '2,8', 'dag/kg', '2,0 - 4,0'],
    ['Fósforo (P-Mehlich)', '9,6', 'mg/dm³', '12 - 18'],
    ['Potássio (K)', '96', 'mg/dm³', '60 - 120'],
    ['Cálcio (Ca)', '3,1', 'cmolc/dm³', '2,4 - 4,0'],
    ['Magnésio (Mg)', '1,2', 'cmolc/dm³', '0,9 - 1,5'],
    ['Alumínio (Al)', '0,1', 'cmolc/dm³', '< 0,3'],
    ['Acidez potencial (H+Al)', '4,2', 'cmolc/dm³', '2,5 - 5,0'],
    ['Soma de bases (SB)', '4,55', 'cmolc/dm³', ''],
    ['CTC a pH 7 (T)', '8,75', 'cmolc/dm³', ''],
    ['Saturação por bases (V)', '52', '%', '50 - 70'],
  ],
});

// 3) mesmo conteúdo, mas "cmol(c)/dm³" e sem a palavra Mehlich em lugar nenhum (extrator "Resina"/"KCl")
await pdf('cmol-parenteses-sem-mehlich.pdf', {
  titulo: 'Resultado de Análise de Fertilidade do Solo', cabecalho: ident, colunas: [50, 260, 350, 450],
  linhas: [
    ['Análise', 'Resultado', 'Unidade', 'Método'],
    ['pH CaCl2', '5,0', '', 'Potenciométrico'],
    ['M.O.', '31', 'g/kg', 'Colorimétrico'],
    ['P', '11', 'mg/dm³', 'Resina'],
    ['K', '0,21', 'cmol(c)/dm³', 'Resina'],
    ['Ca', '3,4', 'cmol(c)/dm³', 'Resina'],
    ['Mg', '1,3', 'cmol(c)/dm³', 'Resina'],
    ['Al', '0,0', 'cmol(c)/dm³', 'KCl'],
    ['H+Al', '3,9', 'cmol(c)/dm³', 'SMP'],
  ],
});

// 4) unidade antes do número, uma coluna só (estilo texto corrido de laudo simples)
await pdf('lista-simples.pdf', {
  titulo: 'Análise de Solo', cabecalho: ident, colunas: [50],
  linhas: [
    ['pH em água ........................ 5,6'],
    ['M.O. (dag/kg) ..................... 3,1'],
    ['P (mg/dm³) ........................ 14,2'],
    ['K (mg/dm³) ........................ 88'],
    ['Ca (cmolc/dm³) .................... 3,6'],
    ['Mg (cmolc/dm³) .................... 1,1'],
    ['Al (cmolc/dm³) .................... 0,0'],
    ['H+Al (cmolc/dm³) .................. 3,8'],
  ],
});

console.log('gerados em', saida);
