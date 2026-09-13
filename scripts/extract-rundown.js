/**
 * extract-rundown.js
 *
 * Reads rundown.html (the hand-edited BEO rundown that's the source of
 * truth for the live site) and derives data/rundown.json — the structured
 * data banquet-bot-telegram's notification pipeline runs on.
 *
 * This does NOT change how rundown.html itself gets edited (still hand/
 * Claude-edited from BEO packets each round) — it just also scrapes that
 * same file into JSON afterward, so the two never drift apart.
 *
 * Fails loudly and leaves any existing data/rundown.json untouched if a
 * day that clearly has content in the HTML produces zero events — better
 * to keep serving yesterday's good data than silently ship a broken/empty
 * file. See classify.js for the meal/break/beverage/activity heuristic.
 *
 * Usage: node scripts/extract-rundown.js
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { classifyTag } = require('./classify');
const { parseTimeRange } = require('./parseTime');

const RUNDOWN_HTML = path.resolve(__dirname, '../rundown.html');
const OUT_PATH = path.resolve(__dirname, '../data/rundown.json');

function textOrDataEn($, el) {
  const dataEn = $(el).attr('data-en');
  if (dataEn === undefined) return $(el).text().trim();
  // data-en attribute values can themselves contain markup (e.g. <strong>),
  // so re-parse the fragment to strip tags and decode entities.
  return cheerio.load(`<div>${dataEn}</div>`)('div').text().trim();
}

function extractCardFoot($, $card) {
  const foot = { contact: null, note: null, roomDetail: null };
  $card.find('.card-foot .foot-row').each((_, row) => {
    const $row = $(row);
    const key = textOrDataEn($, $row.find('.foot-key')).toUpperCase();
    const val = textOrDataEn($, $row.find('.foot-val'));
    if (key === 'CONTACT') foot.contact = val || null;
    else if (key === 'NOTE') foot.note = val || null;
    else if (key === 'ROOM') foot.roomDetail = val || null;
  });
  return foot;
}

function extractItems($, $card, dateStr, warnings) {
  const items = [];
  $card.find('.svc-row').each((_, row) => {
    const $row = $(row);
    const timeHtml = $row.find('.svc-time').html() || '';
    const range = parseTimeRange(timeHtml);
    const tag = textOrDataEn($, $row.find('.svc-top .tag'));
    const room = $row.find('.svc-top .room-pill').text().trim();
    const guestCount = $row.find('.svc-top .gtd-pill').text().trim() || null;
    const menu = textOrDataEn($, $row.find('.svc-menu')) || null;

    if (!range) {
      warnings.push(`${dateStr}: could not parse time "${timeHtml}" for tag "${tag}" — row skipped`);
      return;
    }
    if (!tag || !room) {
      warnings.push(`${dateStr}: missing tag/room on a service row (tag="${tag}" room="${room}") — row skipped`);
      return;
    }

    const { type, continuous } = classifyTag(tag);
    items.push({ room, tag, type, continuous, time: range.start, endTime: range.end, guestCount, menu });
  });
  return items;
}

function extractDay($, daySection, warnings) {
  const dateStr = $(daySection).attr('data-date');
  const events = [];

  $(daySection)
    .find('.event-card')
    .each((_, card) => {
      const $card = $(card);
      const client = textOrDataEn($, $card.find('.card-group')) || null;
      const foot = extractCardFoot($, $card);
      const items = extractItems($, $card, dateStr, warnings);

      if (items.length === 0) {
        warnings.push(`${dateStr}: event card "${client}" produced zero items — check its markup`);
        return;
      }

      events.push({ client, contact: foot.contact, note: foot.note, roomDetail: foot.roomDetail, items });
    });

  if (events.length === 0) {
    warnings.push(`${dateStr}: day section had no usable event cards`);
  }

  return { dateStr, events };
}

function main() {
  if (!fs.existsSync(RUNDOWN_HTML)) {
    throw new Error(`rundown.html not found at ${RUNDOWN_HTML}`);
  }

  const html = fs.readFileSync(RUNDOWN_HTML, 'utf8');
  const $ = cheerio.load(html);
  const warnings = [];
  const rundown = {};

  // Scope to the Rundown tab's day list only — the Diagrams tab reuses the
  // same .day-section[data-date] markup for its own (event-card-less) day
  // sections, which would otherwise look like empty/broken days.
  $('#rundownList .day-section[data-date]').each((_, section) => {
    const { dateStr, events } = extractDay($, section, warnings);
    if (!dateStr) {
      warnings.push('a .day-section had no data-date attribute — skipped entirely');
      return;
    }
    if (events.length > 0) {
      rundown[dateStr] = { events };
    }
  });

  const dayCount = Object.keys(rundown).length;
  if (dayCount === 0) {
    throw new Error(
      'Extracted zero usable days from rundown.html — refusing to write data/rundown.json. ' +
      'This almost always means the HTML structure changed. Warnings:\n' + warnings.join('\n')
    );
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(rundown, null, 2));

  console.log(`Wrote ${dayCount} day(s) to ${OUT_PATH}`);
  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s) during extraction:`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('extract-rundown.js FAILED:', err.message);
    process.exit(1);
  }
}

module.exports = { main };
