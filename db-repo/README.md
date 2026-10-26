# ScamM_db: Spot the Scam message databaseLabelled example messages (scam or real) used by the [Spot the Scam](https://github.com/) app.
The app bundles a copy of this file, so it works offline. When online it checks this endpoint anduses the copy here if its `version` is newer.
**Endpoint:** `https://scam-db-five.vercel.app/scam-db.json`

## Why `vercel.json` mattersBrowsers block one website from reading another website's JSON unless the server sends`Access-Control-Allow-Origin`. Vercel does not add that header by default. Without the`vercel.json` in this repo, the app cannot read this database from the browser (CORS error) andsilently falls back to its bundled copy. Redeploy after adding it.

## Format```json{  "version": "3.0.0",  "total_scenarios": 91,  "last_updated": "2026-10-25",  "scenarios": [    { "id": "db_0001", "category": "bvn_phishing", "label": "scam",      "text": "the message", "reason": "why it is a scam", "source": "team-v2" }  ]}```- `label` is `"scam"` or `"real"`. Rows with any other value are ignored by the app.- `total_scenarios` must equal the real number of rows (the app shows the real count).- Bump `version` when you change the file, or the app will not pick it up.

## Honest notes- 91 hand-written entries, not thousands. The first version of this file claimed 1,543 rows but held 42,  and only 15 distinct patterns once numbers and bank names were ignored. Those duplicates were removed.- All names, phone numbers and websites are fictional. No real personal data.- Entries are written examples in a Nigerian context, not scraped from real victims.- It is a small teaching and retrieval set, not a complete list of scams.## Add entriesAdd rows to `scenarios`, make sure the text is new (not the same message with different numbers), set`total_scenarios`, bump `version`, commit, and Vercel redeploys.
   
                                                                                                               ##LicenceApache-2.0 (see LICENSE).
