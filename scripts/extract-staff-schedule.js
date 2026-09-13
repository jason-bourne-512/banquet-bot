/**
 * extract-staff-schedule.js
 *
 * index.html carries a hand-transcribed weekly staff schedule table (a
 * different, separate hand-edited artifact from rundown.html, updated
 * roughly weekly whenever a new schedule photo comes in). This pulls
 * Jason's row out of it so the Telegram morning-digest notification can
 * fire at his actual shift start time instead of a fixed clock time.
 *
 * The table only ever shows the current week — output only covers those
 * 7 days. Any date outside that range (or a week not yet transcribed)
 * simply won't have an entry, which the digest scheduler treats as
 * "no data" (defaults to 6am per the locked plan).
 *
 * Usage: node scripts/extract-staff-schedule.js
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const INDEX_HTML = path.resolve(__dirname, '../index.html');
const OUT_PATH = path.resolve(__dirname, '../data/staff-schedule.json');

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "11A" / "930A" / "5A" / "1230P" -> "HH:mm" (24h), or null if unparseable */
function parseShiftStart(cellText) {
  const trimmed = cellText.trim();
  if (!trimmed) return null;
  if (/off/i.test(trimmed)) return 'OFF';

  // A cell can hold multiple segments ("5A–930A/HSMN") for dual-role days —
  // only the very first start time is relevant for "what time do I show up".
  const firstSegment = trimmed.split('/')[0];
  const startRaw = firstSegment.split(/[–-]/)[0].trim();

  const m = startRaw.match(/^(\d{1,4})(A|P)$/i);
  if (!m) return null;

  const digits = m[1];
  const meridiem = m[2].toUpperCase();
  let hour, minute;
  if (digits.length <= 2) {
    hour = parseInt(digits, 10);
    minute = 0;
  } else {
    minute = parseInt(digits.slice(-2), 10);
    hour = parseInt(digits.slice(0, -2), 10);
  }

  let h24 = hour % 12;
  if (meridiem === 'P') h24 += 12;
  return `${pad(h24)}:${pad(minute)}`;
}

function main() {
  if (!fs.existsSync(INDEX_HTML)) {
    throw new Error(`index.html not found at ${INDEX_HTML}`);
  }

  const html = fs.readFileSync(INDEX_HTML, 'utf8');

  const wsMatch = html.match(/const\s+WS\s*=\s*new Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/);
  if (!wsMatch) {
    throw new Error('Could not find the week-start anchor (const WS=new Date(...)) in index.html');
  }
  const [, yearStr, monthStr, dayStr] = wsMatch;
  const weekStart = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), parseInt(dayStr, 10));

  const $ = cheerio.load(html);
  const $table = $('.sched-wrap table.s').first();
  if ($table.length === 0) {
    throw new Error('Could not find the staff schedule table (.sched-wrap table.s) in index.html');
  }

  // Header th's (minus the leading blank name column) give the day count —
  // columns are always in sequential date order starting at WS, regardless
  // of which weekday label sits in each one.
  const dayCount = $table.find('thead th').length - 1;
  const dates = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(isoDate(d));
  }

  const $jasonRow = $table.find('td.nm').filter((_, el) => $(el).text().trim() === 'Jason').first().closest('tr');
  if ($jasonRow.length === 0) {
    throw new Error('Could not find a row for "Jason" in the staff schedule table');
  }

  const cells = $jasonRow.find('td').slice(1); // drop the name cell
  if (cells.length !== dayCount) {
    throw new Error(
      `Jason's row has ${cells.length} day cells but the header has ${dayCount} — table structure may have changed`
    );
  }

  const schedule = {};
  cells.each((i, cell) => {
    const parsed = parseShiftStart($(cell).text());
    schedule[dates[i]] = parsed;
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(schedule, null, 2));
  console.log(`Wrote ${Object.keys(schedule).length} day(s) to ${OUT_PATH}`);
  console.log(schedule);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('extract-staff-schedule.js FAILED:', err.message);
    process.exit(1);
  }
}

module.exports = { main, parseShiftStart };
