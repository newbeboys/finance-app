import { mdToPdf } from 'md-to-pdf';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const inputPath  = path.join(__dirname, 'RANGKUMAN_PROJECT.md');
const outputPath = path.join(__dirname, 'RANGKUMAN_PROJECT.pdf');

console.log('Mengonversi RANGKUMAN_PROJECT.md → RANGKUMAN_PROJECT.pdf …');

const pdf = await mdToPdf(
  { path: inputPath },
  {
    dest: outputPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      printBackground: true,
    },
    stylesheet_encoding: 'utf-8',
    css: `
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 11pt;
        color: #2A2C20;
        line-height: 1.6;
      }
      h1 { font-size: 22pt; border-bottom: 2px solid #8C9E5E; padding-bottom: 8px; margin-bottom: 16px; }
      h2 { font-size: 16pt; border-bottom: 1px solid #D8D2BE; padding-bottom: 4px; margin-top: 28px; color: #3D4A28; }
      h3 { font-size: 13pt; margin-top: 20px; color: #4A5530; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
      th { background: #3D4A28; color: #F5F1E4; padding: 8px 10px; text-align: left; }
      td { border: 1px solid #D8D2BE; padding: 7px 10px; }
      tr:nth-child(even) td { background: #F5F1E4; }
      code { background: #EAE5D5; padding: 1px 5px; border-radius: 4px; font-size: 9.5pt; font-family: 'Consolas', monospace; }
      pre { background: #EAE5D5; border: 1px solid #D8D2BE; border-radius: 6px; padding: 12px 16px; font-size: 9pt; overflow-x: auto; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 3px solid #8C9E5E; margin: 0; padding: 4px 16px; color: #666; }
      hr { border: none; border-top: 1px solid #D8D2BE; margin: 24px 0; }
      li { margin-bottom: 4px; }
      strong { color: #2A2C20; }
    `,
  }
);

if (pdf) {
  console.log(`✅ Berhasil! File disimpan di: ${outputPath}`);
} else {
  console.error('❌ Konversi gagal.');
  process.exit(1);
}
