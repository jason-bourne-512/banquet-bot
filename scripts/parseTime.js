/**
 * parseTime.js
 *
 * rundown.html's .svc-time cells look like "1:30–<br>5:00 PM" — a start
 * time with NO am/pm marker of its own, a dash, and an end time that does
 * carry am/pm. Turns that into 24h "HH:mm" start/end.
 *
 * Inference rule when the start has no explicit am/pm: compare the two
 * hour numbers on a 12-hour clock. If start's hour is numerically greater
 * than end's hour, the range must cross noon (e.g. "11:00–1:00 PM" =
 * 11:00 AM to 1:00 PM) so start gets the opposite meridiem from end.
 * Otherwise start shares end's meridiem (e.g. "1:30–5:00 PM" = both PM).
 */

function to24Hour(hour12, minute, meridiem) {
  let h = hour12 % 12;
  if (meridiem === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseOne(raw) {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  return {
    hour: parseInt(m[1], 10),
    minute: parseInt(m[2], 10),
    meridiem: m[3] ? m[3].toUpperCase() : null,
  };
}

/**
 * @param {string} svcTimeHtml raw innerHTML of a .svc-time cell, e.g. "1:30–<br>5:00 PM"
 * @returns {{start: string, end: string} | null} 24h HH:mm start/end, or null if unparseable
 */
function parseTimeRange(svcTimeHtml) {
  const parts = svcTimeHtml.split(/<br\s*\/?>/i).map((s) => s.replace(/[–—-]\s*$/, '').trim());
  if (parts.length !== 2) return null;

  const startRaw = parseOne(parts[0]);
  const endRaw = parseOne(parts[1]);
  if (!startRaw || !endRaw) return null;

  let endMeridiem = endRaw.meridiem || 'PM'; // BEOs are daytime; default PM if genuinely missing
  let startMeridiem = startRaw.meridiem;

  if (!startMeridiem) {
    if (startRaw.hour === 12) {
      // "12:00" alone, immediately followed by a same-range end time, is
      // virtually always noon in a daytime banquet schedule — assume the
      // same meridiem as the end rather than treating 12 as "greater than"
      // the end hour (which would wrongly read it as midnight).
      startMeridiem = endMeridiem;
    } else {
      const endHour12 = endRaw.hour % 12 === 0 ? 12 : endRaw.hour % 12;
      startMeridiem = startRaw.hour > endHour12 ? (endMeridiem === 'PM' ? 'AM' : 'PM') : endMeridiem;
    }
  }

  return {
    start: to24Hour(startRaw.hour, startRaw.minute, startMeridiem),
    end: to24Hour(endRaw.hour, endRaw.minute, endMeridiem),
  };
}

module.exports = { parseTimeRange };
