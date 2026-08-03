# Paste Queue

A minimal Manifest V3 Chrome extension that closes the gap between the app's
export reference sheet (`/albums/export`) and a distributor's manual upload
form — no more alt-tabbing back to re-read every value. It never reads,
inspects, or automates the distributor's page in any way; it only manages the
system clipboard on a global hotkey.

## Load it (unpacked — this isn't published to the Web Store)

1. `chrome://extensions`
2. Toggle **Developer mode** on (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Confirm the hotkey binding at `chrome://extensions/shortcuts` — it defaults
   to `Alt+Shift+C` for the "Copy the next field and advance the queue"
   command, but Chrome sometimes leaves suggested shortcuts unassigned if
   another extension already claims the combo; rebind there if so.

## Use it

1. In the app, go to an album's **Export pack** page, pick a distributor
   without bulk CSV support, and find the **Paste Queue extension** card at
   the bottom of the reference sheet.
2. Click **Copy JSON** (or select the text in the box below it).
3. Open the extension's popup (click its toolbar icon) and paste the JSON
   into the text box, then **Load queue**. The popup shows the album,
   distributor, and how many fields have a value to fill in.
4. On the distributor's site: press the hotkey, click into the first field,
   paste, click the next field, press the hotkey again, paste, repeat. The
   toolbar badge always shows which field is next (`4/42`), and the popup
   additionally shows that field's label if you open it.
5. **Reset to start** rewinds the same queue back to field 1 without needing
   to re-paste the JSON. **Clear queue** empties it entirely.

## Why it's built this way

- **Permissions are `storage`, `clipboardWrite`, and `offscreen`** — not just
  the `clipboardWrite`/`commands` the feature conceptually needs, for two
  concrete reasons: MV3 service workers get killed after ~30s idle and lose
  all in-memory state, so the queue/index have to live in `chrome.storage.local`
  or a few minutes of pausing between fields would silently lose your place;
  and `navigator.clipboard.writeText()` isn't callable from a service worker
  at all (no DOM/document there), so the actual write happens in a short-lived
  offscreen document (`offscreen.html`/`offscreen.js`) that `background.js`
  creates on demand — the only reason that file exists.
- **No API endpoint (v0)** — the app has no real auth yet (a `DEV_USER_ID`
  stand-in through the admin Supabase client everywhere), so a
  fetchable-from-an-extension endpoint would mean building auth first. Paste
  today, wire up a "Fetch from app" popup button later once the app has real
  per-user auth to check against.
- **No icon files yet** — Chrome falls back to a generic icon for an unpacked
  extension; trivial to add `icons/` + an `icons` block in `manifest.json`
  later.
