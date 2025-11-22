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
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    },
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

const {parseVivinoRating, parseLegacyVivinoRating, getCachedRating, setCachedRating, CACHE_KEY, CACHE_TTL_MS, MAX_CACHE_ENTRIES} = sandbox;

function htmlEscape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

const preloadedState = {
  search_results: {
    matches: [
      {
        vintage: {
          name: 'Test Wine 2020',
          seo_name: 'test-wine-2020',
          wine: {id: 555},
          statistics: {ratings_average: 4.3, ratings_count: 245}
        }
      }
    ]
  }
};

const encodedState = htmlEscape(JSON.stringify(preloadedState));
const jsonHtml = `<div data-preloaded-state="${encodedState}"></div>`;

const jsonResult = Array.from(parseVivinoRating(jsonHtml, 'Test Wine 2020'));
assert.deepStrictEqual(jsonResult, [4.3, 245, 'Test Wine 2020', 'https://www.vivino.com/wines/555']);

const legacyHtml = `
<div class="wine-card__content">
  <a class="link-color-alt-grey" href="/wines/123"><span>Sample Legacy</span></a>
  <div class="text-inline-block light average__number">4.4</div>
  <span class="text-micro">1,234 ratings</span>
</div></div></div>`;

const legacyResult = Array.from(parseLegacyVivinoRating(legacyHtml, 'Legacy Test'));
assert.deepStrictEqual(legacyResult, [4.4, 1234, 'Sample Legacy', 'https://www.vivino.com/wines/123']);

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
  .then(() => console.log('Parser and cache tests passed:', {jsonResult, legacyResult}))
  .catch(error => {
    console.error('Tests failed', error);
    process.exit(1);
  });
