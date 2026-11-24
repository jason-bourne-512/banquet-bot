// Contact privacy: client contact names, phones, and emails are hidden and not searchable.
// Westin staff first names stay visible. No browser or network.
const assert = require("node:assert/strict");
const P = require("./contact-privacy.js");

assert.equal(P.isStaff("Lisa"), true);
assert.equal(P.isStaff("IC: Lisa"), true);
assert.equal(P.isStaff("Hector"), true);
assert.equal(P.isStaff("Laura"), false);
assert.equal(P.isStaff("Lynn (on site both nights)"), false);
assert.equal(P.shouldHide("Laura"), true);
assert.equal(P.shouldHide("Lynn (on site both nights)"), true);
assert.equal(P.shouldHide("Lisa"), false);
assert.equal(P.shouldHide("Diana"), false);
assert.equal(P.shouldHide("512-555-1234"), true);
assert.equal(P.shouldHide("jane@client.com"), true);
assert.equal(P.spokenContact("Laura"), "the contact");
assert.equal(P.spokenContact("Lisa"), "Lisa");
assert.equal(P.spokenContact(""), "the contact");
assert.equal(P.redactNameInText("Check with Lynn before firing entrees.", "Lynn"), "Check with the contact before firing entrees.");
assert.equal(P.stripPersonal("Call 512-555-1234 or jane@client.com today"), "Call or today");

const card = [
  '<div class="event-card">',
  '<div class="card-group">Tucson Roadrunners — Team Meeting (Camellia)</div>',
  '<span class="badge badge-mgr">MGR: Lisa</span>',
  '<span class="badge badge-ic">IC: Laura</span>',
  '<div class="room-pill">Camellia</div>',
  '<div class="svc-time">8:00 AM</div>',
  '<div class="foot-row"><span class="foot-key">CONTACT</span><span class="foot-val">Laura</span></div>',
  '<div class="foot-row"><span class="foot-key">NOTE</span><span class="foot-val">event order 532563 · Check with Laura before firing</span></div>',
  '</div>'
].join("");

const indexed = P.cardSearchText(card);
assert.ok(indexed.indexOf("Tucson Roadrunners") > -1, "group name stays searchable");
assert.ok(indexed.indexOf("532563") > -1, "event order number stays searchable");
assert.ok(indexed.indexOf("Camellia") > -1, "room stays searchable");
assert.ok(indexed.indexOf("Lisa") > -1, "Westin staff first name stays searchable");
assert.equal(indexed.toLowerCase().indexOf("laura"), -1, "client contact first name is not in the search text");

const leaky = [
  '<div class="event-card">',
  '<div class="card-group">Sample Group</div>',
  '<div class="foot-row"><span class="foot-key">CONTACT</span><span class="foot-val">Jane 512-555-1234 jane@client.com</span></div>',
  '<div class="foot-row"><span class="foot-key">NOTE</span><span class="foot-val">event order 111111</span></div>',
  '</div>'
].join("");
const leaked = P.cardSearchText(leaky);
assert.equal(leaked.indexOf("512-555-1234"), -1, "phone is not searchable");
assert.equal(leaked.toLowerCase().indexOf("jane@client.com"), -1, "email is not searchable");
assert.ok(leaked.indexOf("111111") > -1, "event order on a card with a phone still searchable");
assert.equal(leaked.toLowerCase().indexOf("jane"), -1, "name attached to the phone and email is not searchable");


const fcm = [
  '<div class="event-card">',
  '<div class="card-group">FCM National Assembly</div>',
  '<span class="badge badge-ic">IC: Christopher</span>',
  '<div class="foot-row"><span class="foot-key">CONTACT</span><span class="foot-val">Christopher</span></div>',
  '<div class="foot-row"><span class="foot-key">NOTE</span><span class="foot-val">FCM National Assembly 2026<br>Contacts: Christopher, Madison, Matthew<br>event order 494832</span></div>',
  '</div>'
].join("");
const fcmText = P.cardSearchText(fcm);
assert.ok(fcmText.indexOf("494832") > -1, "FCM event order stays searchable");
assert.equal(fcmText.toLowerCase().indexOf("christopher"), -1, "primary contact Christopher is not searchable");
assert.equal(fcmText.toLowerCase().indexOf("madison"), -1, "secondary contact Madison is not searchable");
assert.equal(fcmText.toLowerCase().indexOf("matthew"), -1, "secondary contact Matthew is not searchable");

const html = P.redactHtml("Check with Lynn before firing.<br>Do not clear dessert plates.", ["Lynn"]);
assert.ok(html.indexOf("<br>") > -1, "redacting a note keeps its line breaks");
assert.equal(html.toLowerCase().indexOf("lynn"), -1, "Lynn is removed from the HTML note");
assert.ok(/the contact/.test(html), "Lynn is replaced with the contact");
assert.equal(P.qualifierAfterName("Lynn (on site both nights)"), "(on site both nights)");
assert.equal(P.qualifierAfterName("Laura"), "");

console.log("PASS: contact privacy hides client contact names, phones, and emails from search text, and keeps staff, rooms, and BEO numbers.");
