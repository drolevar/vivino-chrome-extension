# Vivino Chrome Extension
A Chrome Extension that retrieves ratings from [Vivino](https://www.vivino.com/) and inserts them into wines listed on [Vinmonopolet.no](https://www.vinmonopolet.no).

## Testing
- Parser + cache smoke test (offline): `node tests/vivinoParser.test.js`

## Behavior
- Vivino lookup results are cached in `chrome.storage.local` for six hours (with a cap of 200 entries) to reduce repeated requests for the same wine names, and concurrent lookups for the same wine share a single request while the page-level cache avoids duplicate renders.
