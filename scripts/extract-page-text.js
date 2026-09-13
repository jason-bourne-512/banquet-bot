/**
 * extract-page-text.js
 *
 * Generic HTML -> clean text extractor for the reference pages (menu,
 * rooms, info, training, handbook). Unlike rundown.html, these don't need
 * structured parsing — Q&A just needs their readable content as grounding
 * text. English is always the static default text in this site's markup
 * (the EN/ES toggle swaps innerHTML at runtime via JS; the raw HTML you
 * get without running JS is already English), so a plain script/style
 * strip + body text extraction is sufficient — no data-en handling needed.
 *
 * Usage: node scripts/extract-page-text.js <input.html> <output.txt>
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function extractText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  const raw = $('body').text();
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  if (!inputArg || !outputArg) {
    throw new Error('Usage: node scripts/extract-page-text.js <input.html> <output.txt>');
  }
  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg);

  const html = fs.readFileSync(inputPath, 'utf8');
  const text = extractText(html);

  if (text.length < 50) {
    throw new Error(`Extracted suspiciously little text (${text.length} chars) from ${inputPath} — refusing to write`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, text);
  console.log(`Wrote ${text.length} chars to ${outputPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('extract-page-text.js FAILED:', err.message);
    process.exit(1);
  }
}

module.exports = { extractText };
