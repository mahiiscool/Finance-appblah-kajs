# Money app notes

## Every change gets a What's new entry
The in app What's new page (More tab) reads `changelog.json`. With every commit that changes what the user sees or how the app behaves:

1. Add a new object at the TOP of `changelog.json` with `v` one higher than the current highest, today's `date` (YYYY-MM-DD), a short `title`, and `items`.
2. Each item has `type` (`new`, `fix`, or `change`) and `text` in plain, casual language a non coder understands.
3. Never use dashes or hyphens in the text.
4. Bump the `CACHE` version in `sw.js`.

Several small changes on the same day can share one entry.

## Saved data
The app is installed on Mahi's iPhone with real data. Never change vault.js, the IndexedDB name, or the encryption. Any change to saved state goes in a one time migration run from `startSession`, safe to run twice.
