# Notes tab: Firebase saving (dormant), and BEO tab local saving

## BEO tab: local only, no Firebase
The BEO tab (`beo-beta.html`) is Mac-only. It works only when opened from `node scripts/serve-beo-beta.js` on localhost (`http://127.0.0.1:8765/beo-beta.html`), and does nothing elsewhere. There is no Google sign-in and no cloud storage for BEO notes or highlights.

- Notes and yellow page highlights save through the local server into `beo-local-state.json` at the repo root (gitignored, written atomically, never served). Every browser on this Mac shares it.
- If the server is not running, the page keeps them in that browser's localStorage (`bb-beo-local-v1`) and merges them into the file the next time the server is up.
- The code is `scripts/beo-local-store.js`. A note is `{ date, eo, printed, revision, source, text, createdAt }`. A highlight is `{ date, eo, printed, revision, source, page, slot, x, y, w, h, createdAt }`, with `x, y, w, h` in percent of the page image and at most 50 highlights per page. Highlights show only on the print they were drawn on.
- On a BEO page image, drag a box to add a yellow highlight and tap one to remove it. Originals stay in the gitignored `beo-originals/` and are served only on `127.0.0.1`. Notes and highlights store identity fields and coordinates, never the images.
- Older browser-only notes (`bb-beo-notes-v1`) are copied into the local store, and each one is removed from the old key as soon as it saves, so a reload never adds it twice. Notes that could not save or match any BEO in the index stay under the old key.

The rest of this file covers the Notes tab only. Its Firebase code is still in the repo but dormant, and the BEO tab no longer uses it.

## Notes tab: Firebase saving, behind Auth

Notes save to Cloud Firestore in a Banquet Bot project. It does not touch The Wire. All of it is Jason only.

## Read this first
1. The Nov 21 temporary rules (`allow read: if true`, `allow delete: if true`, "no Auth yet") must not stay published. If they are live in the Firebase console, replace them. `firestore.rules` in this repo no longer contains them.
2. Real rules require Firebase Auth (verified Google sign-in, Jason's account only) plus App Check before any team launch, and before `scripts/firebase-config.js` is ever pushed. That file is gitignored and stays on this Mac until then.
3. The rules in this repo have not been deployed in this pass. Nothing here was published to Firebase.

## How access works
- The Notes tab (`notes.html`) stays hidden until a device opts in with `bb-notes-tester=1` (open `notes.html` or any page with `?notes=on`; `?notes=off` clears it). That is a visibility convenience, not security.
- The security boundary is Firebase Auth plus `firestore.rules`. The Notes page calls Firestore only after a Google user is signed in. Signed out, it shows a sign-in button and sample or empty content, and makes no Firestore calls.
- A signed-in account that is not the owner is denied by the rules. The page then shows "This Google account does not have access to notes."
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

The `beoNotes` and `beoHighlights` collections (and their rules in `firestore.rules`) are leftovers from an earlier BEO design. The BEO tab no longer reads or writes them. See the BEO section at the top.

Updates are denied everywhere. Delete and create again instead. Reads, creates, and deletes need the owner.
