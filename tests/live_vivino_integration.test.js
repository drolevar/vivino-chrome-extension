// Live integration test: fetch Vinmonopolet search results and resolve a Vivino rating.
// Skips unless LIVE_TESTS=1 to avoid hitting network during normal runs.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

if (!process.env.LIVE_TESTS) {
  console.log('Skipping live test (set LIVE_TESTS=1 to run)');
  process.exit(0);
}

const backgroundPath = path.join(__dirname, '..', 'background.js');
const backgroundCode = fs.readFileSync(backgroundPath, 'utf8');

// Minimal sandbox to reuse parseVivinoRating.
const sandbox = {
  console,
  fetch: global.fetch,
  AbortController,
  chrome: {
    runtime: { onMessage: { addListener: () => {} } },
    storage: { local: { get: () => {}, set: () => {} } }
  }
};

vm.createContext(sandbox);
vm.runInContext(backgroundCode, sandbox);
const {parseVivinoRating} = sandbox;

async function fetchJson(url) {
  const res = await fetch(url, {headers: {'Accept': 'application/json'}});
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'upgrade-insecure-requests': '1',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const vinQuery = "baron de ley:relevance:volumeRanges:75 - 99 cl";
  const vinUrl = `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?fields=FULL&pageSize=24&currentPage=0&q=${encodeURIComponent(vinQuery)}&searchType=product`;
  const vinJson = await fetchJson(vinUrl);
  assert(vinJson.products?.length > 0, 'No products returned from Vinmonopolet');

  const first = vinJson.products[0];
  const wineName = first.name;
  console.log('Vinmonopolet first wine:', wineName);

  const vivinoUrl = "https://www.vivino.com/en/search/wines?q=" + encodeURIComponent(wineName);
  const vivinoHtml = await fetchText(vivinoUrl);
  const vivinoParsed = Array.from(parseVivinoRating(vivinoHtml, wineName));

  console.log('Vivino parsed result:', vivinoParsed);
  assert(vivinoParsed[0] > 0, 'Vivino rating should be > 0');
  assert(vivinoParsed[3].startsWith('https://www.vivino.com/wines/'), 'Vivino link missing');

  console.log('Live integration test passed');
}

main().catch(error => {
  console.error('Live test failed', error);
  process.exit(1);
});
