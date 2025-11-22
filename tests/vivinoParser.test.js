const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const backgroundPath = path.join(__dirname, '..', 'background.js');
const backgroundCode = fs.readFileSync(backgroundPath, 'utf8');

const sandbox = {
  console,
  fetch: () => { throw new Error('fetch should not be invoked during parser tests'); },
  AbortController,
  chrome: {
    runtime: { onMessage: { addListener: () => {} } },
    storage: {
      local: (() => {
        const store = {};
        return {
          get: (key, cb) => {
            if (Array.isArray(key)) {
              const result = {};
              key.forEach(k => { result[k] = store[k]; });
              cb(result);
            } else if (typeof key === 'string') {
              cb({[key]: store[key]});
            } else {
              cb({...store});
            }
          },
          set: (entries, cb = () => {}) => {
            Object.assign(store, entries);
            cb();
          }
        };
      })()
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(backgroundCode, sandbox);

const {parseVivinoRating, getCachedRating, setCachedRating, CACHE_KEY, CACHE_TTL_MS, MAX_CACHE_ENTRIES} = sandbox;

const dataDir = path.join(__dirname, 'data');
const load = filename => fs.readFileSync(path.join(dataDir, filename), 'utf8');

// Vivino fixture (real response HTML extracted from HAR)
const vivinoHtml = load('vivino_search_tyrells_old_winery_pinot_noir_2021.html');
const vivinoParsed = Array.from(parseVivinoRating(vivinoHtml, "tyrrell's old winery pinot noir 2021"));
assert.deepStrictEqual(vivinoParsed, [3.5, 97, "Tyrrell's Old Winery Pinot Noir 2021", 'https://www.vivino.com/wines/13524']);

// Vinmonopolet fixture (JSON payload extracted from HAR)
const vinJson = JSON.parse(load('vinmonopolet_search_rodvin_page0.json'));
assert.strictEqual(vinJson.pagination.totalResults, 14580);
assert.strictEqual(vinJson.products.length, 24);
assert.strictEqual(vinJson.products[0].name, 'CARM Maria de Lourdes 2016');

async function runCacheTests() {
  const cachedValue = [4.1, 55, 'Cache Hit Wine', 'https://www.vivino.com/wines/999'];
  await setCachedRating(' Cache Hit Wine ', cachedValue);
  const hit = await getCachedRating('cache hit wine');
  assert.deepStrictEqual(hit, cachedValue);

  // Expired entry should be treated as a miss and cleared.
  const expiredStore = {};
  const oldTimestamp = Date.now() - CACHE_TTL_MS - 1000;
  expiredStore[CACHE_KEY] = { 'stale wine': { data: [3.0, 10, 'Stale', 'https://example'], timestamp: oldTimestamp } };
  await new Promise(resolve => sandbox.chrome.storage.local.set(expiredStore, resolve));
  const miss = await getCachedRating('Stale Wine');
  assert.strictEqual(miss, null);

  const largeCache = {};
  const now = Date.now();
  for (let i = 0; i < MAX_CACHE_ENTRIES + 10; i++) {
    largeCache[`wine-${i}`] = {data: [i], timestamp: now - i};
  }

  await new Promise(resolve => sandbox.chrome.storage.local.set({[CACHE_KEY]: largeCache}, resolve));
  await setCachedRating('Latest Entry', [5.0, 5, 'Latest Entry', 'https://example/latest']);

  const trimmed = await new Promise(resolve => sandbox.chrome.storage.local.get(CACHE_KEY, result => resolve(result[CACHE_KEY])));
  console.log('Cache size after trim', Object.keys(trimmed).length, 'limit', MAX_CACHE_ENTRIES);
  assert.ok(Object.keys(trimmed).length <= MAX_CACHE_ENTRIES);
  assert.ok(trimmed['latest entry']);
}

runCacheTests()
  .then(() => console.log('Parser tests passed:', {vivinoParsed}))
  .catch(error => {
    console.error('Tests failed', error);
    process.exit(1);
  });
