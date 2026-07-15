# Site Search results + ahrefs ranking data

Joins ahrefs Keywords Explorer metrics onto the arizona.edu site-search export.

## Files
- `sitesearchresults_with_ahrefs.csv` — original export (7,981 rows) with ahrefs columns
  appended per keyphrase: US Volume, Global Volume, Keyword Difficulty, CPC (USD), Clicks,
  Traffic Potential, Parent Topic.
- `keyphrase_ahrefs_summary.csv` — one row per unique keyphrase (399), sorted by US volume,
  with site-search top position + result count alongside the ahrefs metrics. `Ahrefs Data`
  flags the 14 keyphrases with no ahrefs record (zero-volume long-tail / internal titles).
- `fetch_ahrefs.py` — reproducible fetch (ahrefs API v3 `keywords-explorer/overview`,
  country=us). Reads the token from `AHREFS_API_KEY` — the key is never stored in the repo.

## Notes
- CPC is returned by ahrefs in cents; the CSV converts it to USD.
- Metrics are US (`country=us`); change `COUNTRY` in the script for other markets.
