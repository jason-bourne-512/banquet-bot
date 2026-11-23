# Notes and BEO notes: Firebase saving, behind Auth

Notes, BEO notes, and BEO highlights save to Cloud Firestore in a Banquet Bot project. It does not touch The Wire. All of it is Jason only.

## Read this first
1. The Nov 21 temporary rules (`allow read: if true`, `allow delete: if true`, "no Auth yet") must not stay published. If they are live in the Firebase console, replace them. `firestore.rules` in this repo no longer contains them.
2. Real rules require Firebase Auth (verified Google sign-in, Jason's account only) plus App Check before any team launch, and before `scripts/firebase-config.js` is ever pushed. That file is gitignored and stays on this Mac until then.
3. The rules in this repo have not been deployed in this pass. Nothing here was published to Firebase.

## How access works
- The Notes tab (`notes.html`) stays hidden until a device opts in with `bb-notes-tester=1` (open `notes.html` or any page with `?notes=on`; `?notes=off` clears it). The BEO tab (`beo-beta.html`) shows notes and highlights only when the PIN name is Jason. Both are a visibility convenience, not security.
- The security boundary is Firebase Auth plus `firestore.rules`. The pages call Firestore only after a Google user is signed in. Signed out, they show a sign-in button and sample or empty content, and make no Firestore calls.
- A signed-in account that is not the owner is denied by the rules. The pages then show "This Google account does not have access to notes."
- `firestore.rules` checks `request.auth.uid` against `ownerUid()`, plus `email_verified` and the `google.com` sign-in provider. No email address is committed. The committed placeholder `OWNER_UID_NOT_SET` is not a real UID, so the committed rules deny everyone.

## Turn it on (later, by the owner)
1. Firebase console > Authentication > Sign-in method: enable Google. Add the site's domain (and `127.0.0.1` for the local BEO page, if it is not already allowed) under Authorized domains.
2. Copy `scripts/firebase-config.example.js` over `scripts/firebase-config.js` (gitignored) and paste the web config.
3. Sign in once on `notes.html`, then copy your user UID from Authentication > Users.
4. Copy `firestore.rules` to `firestore.rules.local` (gitignored), replace `OWNER_UID_NOT_SET` with that UID, and publish the `.local` file (console > Firestore > Rules, or `firebase deploy --only firestore:rules` with the local file). Not done in this pass.
5. App Check: register the web app with reCAPTCHA v3, add `appCheckSiteKey: "..."` to `scripts/firebase-config.js`, then enforce App Check for Firestore. The client starts App Check only when that key exists. Without it the page still works and App Check is skipped.

Notes are ops-only. The page and the rules both reject text that looks like card numbers or PINs.

## Collections
`notes` (Notes tab): `{ date, group, eventId?, text, authorFirstName, createdAt (ISO string), createdByDeviceId, pinned }`. Pinned notes have no date or group.

`beoNotes` (BEO tab notes), one doc per note, auto id:
`{ date, eo, printed, revision, source, text, createdAt }`
- `date` is the service date (YYYY-MM-DD), `eo` the EO number as a string.
- `printed`, `revision`, `source` identify the print: the latest version's printed date, how many versions exist, and its source file name, from `beo-originals/index.json`.
- The page shows every note for the date and EO, and labels notes from an older print with that print's date.

`beoHighlights` (BEO page highlights), one doc per yellow box:
`{ date, eo, printed, revision, source, page, slot, x, y, w, h, createdAt }`
- `page` is the 0-based page index in the BEO.
- `x, y, w, h` are percent of the page image (0 to 100), so boxes survive resizing.
- The doc id must equal `<date>_<eo>_<printed>_r<revision>_p<page+1>_h<slot>`, with `slot` 1 to 50. That caps a page at 50 highlights. Revision is in the id so a same-day reprint does not inherit the old boxes. The rules also require `w` and `h` of at least 1 and `x + w`, `y + h` at most 100.
- Highlights show only on the print they were drawn on. A new print of the same EO starts clean, since the boxes would not line up.

Updates are denied everywhere. Delete and create again instead. Reads, creates, and deletes need the owner.

## Highlighting
On a BEO page image (Jason signed in), drag a box to add a yellow highlight, tap a highlight to remove it. Mouse, touch, and pen use pointer events. On a phone the page still scrolls vertically, so draw with a mostly sideways drag. A drag or a highlight tap does not open the original image; a plain tap on empty page area still does.

## Originals stay local
Page images live in the gitignored `beo-originals/` and are served only by `node scripts/serve-beo-beta.js`, bound to `127.0.0.1`. Notes and highlights store only identity fields and coordinates, never the images.

## Older local notes
Before this change the BEO tab kept notes in this browser's localStorage (`bb-beo-notes-v1`). They are not migrated and not deleted. The page no longer reads them.
