// Contact privacy (Jason 2026-11-27): contact first names show everywhere on Banquet Bot.
// Last names, phone numbers and emails never show. No browser or network.
const assert = require("node:assert/strict");
const P = require("./contact-privacy.js");

// First names show; nothing is blacked out unless only a phone or email is left.
assert.equal(P.shouldHide("Laura"), false);
assert.equal(P.shouldHide("Lynn (on site both nights)"), false);
assert.equal(P.shouldHide("Lisa"), false);
assert.equal(P.shouldHide("Jane 512-555-1234"), false);
assert.equal(P.shouldHide("512-555-1234"), true);
assert.equal(P.shouldHide("jane@client.com"), true);

// Last names, phones and emails are dropped.
assert.equal(P.displayName("Laura"), "Laura");
assert.equal(P.displayName("Alex Rivera"), "Alex");
assert.equal(P.displayName("IC: Alex Rivera"), "IC: Alex");
assert.equal(P.displayName("Mary-Kate O'Brien"), "Mary-Kate");
assert.equal(P.displayName("Jose De La Cruz"), "Jose");
assert.equal(P.displayName("Jane 512-555-1234 jane@client.com"), "Jane");
// Real Banquet Bot contact shapes stay as written.
assert.equal(P.displayName("Amanda R / Amanda C"), "Amanda R / Amanda C");
assert.equal(P.displayName("Matt / Nate"), "Matt / Nate");
assert.equal(P.displayName("Lynn (on site both nights)"), "Lynn (on site both nights)");

assert.equal(P.spokenContact("Laura"), "Laura");
assert.equal(P.spokenContact("Alex Rivera"), "Alex");
assert.equal(P.spokenContact(""), "the contact");
assert.equal(P.redactNameInText("Check with Lynn before firing entrees."), "Check with Lynn before firing entrees.");
assert.equal(P.stripPersonal("Call 512-555-1234 or jane@client.com today"), "Call or today");

const card = [
  '<div class="event-card">',
  '<div class="card-group">Tucson Roadrunners — Team Meeting (Camellia)</div>',
  '<span class="badge badge-mgr">MGR: Lisa</span>',
  '<span class="badge badge-ic">IC: Laura</span>',
  '<div class="room-pill">Camellia</div>',
  '<div class="foot-row"><span class="foot-key">CONTACT</span><span class="foot-val">Laura Smith</span></div>',
  '<div class="foot-row"><span class="foot-key">NOTE</span><span class="foot-val">event order 532563 · Check with Laura Smith before firing · 512-555-1234</span></div>',
  '</div>'
].join("");
const indexed = P.cardSearchText(card);
assert.ok(indexed.indexOf("Tucson Roadrunners") > -1, "group name stays searchable");
assert.ok(indexed.indexOf("532563") > -1, "event order number stays searchable");
assert.ok(indexed.indexOf("Lisa") > -1, "staff first name stays searchable");
assert.ok(indexed.indexOf("Laura") > -1, "client contact first name is searchable");
assert.equal(indexed.indexOf("Smith"), -1, "client contact last name is not searchable");
assert.equal(indexed.indexOf("512-555-1234"), -1, "phone is not searchable");

const fcm = [
  '<div class="event-card">',
  '<div class="foot-row"><span class="foot-key">CONTACT</span><span class="foot-val">Christopher</span></div>',
  '<div class="foot-row"><span class="foot-key">NOTE</span><span class="foot-val">Contacts: Christopher, Madison, Matthew<br>event order 494832</span></div>',
  '</div>'
].join("");
const fcmText = P.cardSearchText(fcm);
["Christopher", "Madison", "Matthew", "494832"].forEach(function (w) { assert.ok(fcmText.indexOf(w) > -1, w + " stays searchable"); });

const html = P.redactHtml("Check with Lynn before firing.<br>Call 512-555-1234.", []);
assert.ok(html.indexOf("<br>") > -1, "cleaning a note keeps its line breaks");
assert.ok(html.indexOf("Lynn") > -1, "first name stays in the note");
assert.equal(html.indexOf("512-555-1234"), -1, "phone is removed from the note");

console.log("PASS: contact privacy shows first names, and drops last names, phones, and emails.");
