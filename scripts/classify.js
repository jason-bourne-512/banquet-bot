/**
 * classify.js
 *
 * Turns a free-text BEO service tag (e.g. "Coffee Break", "All-Day Beverage",
 * "Meeting — No F&B") into a { type, continuous } pair the notification
 * pipeline knows how to schedule.
 *
 * type is one of: meal | break | beverage | activity
 *   - meal/break/beverage all imply real F&B service.
 *   - activity means no F&B — a dry-set room use (meeting, breakout, storage,
 *     teardown, etc). Still gets pushed, just with a "check the room"
 *     message instead of a food one.
 *
 * continuous means the item spans a whole window (Continuous Break,
 * All-Day Beverage, Hospitality Room) rather than firing at one clean
 * moment — these get a single 30-min-before-start warning + start push,
 * same as everything else, just via a longer lead time.
 *
 * This is a heuristic over free text the BEO packet doesn't structure —
 * expect to tune these patterns once tested against real days.
 */

const CONTINUOUS_RE = /continuous|all[\s-]?day|half[\s-]?day|hospitality/i;
const MEAL_RE = /breakfast|lunch|dinner|buffet|plated|conference dining|reception/i;
const BREAK_RE = /\bbreak\b/i;
const BEVERAGE_RE = /beverage|\bbar\b/i;
const NO_FNB_RE = /no f&b/i;

function classifyTag(tag) {
  const continuous = CONTINUOUS_RE.test(tag);

  if (NO_FNB_RE.test(tag)) {
    return { type: 'activity', continuous };
  }
  if (MEAL_RE.test(tag)) {
    return { type: 'meal', continuous };
  }
  if (BREAK_RE.test(tag)) {
    return { type: 'break', continuous };
  }
  if (BEVERAGE_RE.test(tag)) {
    return { type: 'beverage', continuous };
  }
  // Everything else (Meeting, Session, Breakout, Exhibits, Storage, Office,
  // Registration, Board Meeting, Green Room, Holding/Waiting Room, Teardown,
  // Room Flip, Orientation, Set Up, plain "Hospitality Room") — no F&B
  // keyword and no meal/break/beverage word, so treat as a dry activity.
  return { type: 'activity', continuous };
}

module.exports = { classifyTag };
