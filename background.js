const CACHE_KEY = 'vivinoCache';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const MAX_CACHE_ENTRIES = 200;
const ENABLE_KEY = 'vivinoEnabled';

Object.assign(globalThis, {CACHE_KEY, CACHE_TTL_MS, MAX_CACHE_ENTRIES});

const messageHandlers = {
  async queryWine(request) {
    if (!isVivinoEnabled()) {
      console.log("[Vivino] Disabled via toggle; skipping lookup for '%s'", request.wineName);
      return ['error', 0, '', ''];
    }
    return getRatingWithCacheAndFlight(request.wineName);
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.contentScriptQuery];
  if (!handler) {
    return false;
  }

  handler(request)
    .then(sendResponse)
    .catch(error => {
      console.error("[Vivino] Error handling '%s': %s", request.contentScriptQuery, error);
      sendResponse(['error', 0, '', '']);
    });

  return true; // keep message channel open for async response
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(ENABLE_KEY, result => {
    if (typeof result[ENABLE_KEY] === 'undefined') {
      chrome.storage.local.set({[ENABLE_KEY]: true});
    }
  });
});

let vivinoEnabled = true;
chrome.storage.local.get(ENABLE_KEY, result => {
  if (typeof result[ENABLE_KEY] === 'boolean') {
    vivinoEnabled = result[ENABLE_KEY];
  }
  updateActionBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[ENABLE_KEY]) {
    vivinoEnabled = !!changes[ENABLE_KEY].newValue;
    updateActionBadge();
  }
});

chrome.action.onClicked.addListener(() => {
  vivinoEnabled = !vivinoEnabled;
  chrome.storage.local.set({[ENABLE_KEY]: vivinoEnabled}, updateActionBadge);
});

function isVivinoEnabled() {
  return vivinoEnabled !== false;
}

function updateActionBadge() {
  if (!chrome.action || !chrome.action.setBadgeText) return;
  chrome.action.setBadgeText({text: isVivinoEnabled() ? '' : 'OFF'});
  chrome.action.setBadgeBackgroundColor({color: '#b00020'});
}

const inflightRequests = new Map();

async function getRatingWithCacheAndFlight(rawName) {
  const wineName = normalizeWineName(rawName);
  const cached = await getCachedRating(wineName);
  if (cached) {
    console.log("[Vivino] Cache hit for '%s'", wineName);
    return cached;
  }

  if (inflightRequests.has(wineName)) {
    console.log("[Vivino] Pending request reused for '%s'", wineName);
    return inflightRequests.get(wineName);
  }

  const pending = fetchRating(wineName).finally(() => inflightRequests.delete(wineName));
  inflightRequests.set(wineName, pending);
  return pending;
}

async function fetchRating(wineName) {
  // Try locale-specific first to avoid redirects and include credentials so any
  // bot-protection cookies are set.
  const searchUrls = [
    "https://www.vivino.com/en/search/wines?q=" + encodeURIComponent(wineName),
    "https://www.vivino.com/search/wines?q=" + encodeURIComponent(wineName)
  ];

  console.log("[Vivino] Querying: %s", wineName);

  let lastError = null;
  for (const url of searchUrls) {
    try {
      console.log("[Vivino] URL: %s", url);
      const response = await fetchWithTimeout(url, {credentials: "include"}, 12000);
      console.log("[Vivino] Response status: %d", response.status);
      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }
      const responseText = await response.text();
      console.log("[Vivino] Response size: %d bytes", responseText.length);
      if (!responseText || responseText.length < 200) {
        throw new Error("Empty/short response from Vivino");
      }
      const ratingAndReviewCount = await parseVivinoRating(responseText, wineName);
      console.log("[Vivino] Result for '%s': %o", wineName, ratingAndReviewCount);
      await setCachedRating(wineName, ratingAndReviewCount);
      return ratingAndReviewCount;
    } catch (error) {
      console.warn("[Vivino] Fetch attempt failed for %s: %s", url, error);
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to fetch Vivino search page");
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const request = fetch(url, {...options, signal: controller.signal});

  return request.finally(() => clearTimeout(timeout));
}

function normalizeWineName(name = '') {
  return name.trim().toLowerCase();
}

function getCachedRating(wineName) {
  const key = normalizeWineName(wineName);
  return new Promise(resolve => {
    chrome.storage.local.get(CACHE_KEY, result => {
      const {cache, dirty} = sanitizeCache(result[CACHE_KEY] || {});
      if (dirty) {
        chrome.storage.local.set({[CACHE_KEY]: cache});
      }

      const entry = cache[key];
      resolve(entry ? entry.data : null);
    });
  });
}

function setCachedRating(wineName, data) {
  const key = normalizeWineName(wineName);
  return new Promise(resolve => {
    chrome.storage.local.get(CACHE_KEY, result => {
      const {cache} = sanitizeCache(result[CACHE_KEY] || {});
      const mergedEntries = Object.entries(cache)
        .concat([[key, {data, timestamp: Date.now()}]])
        .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, MAX_CACHE_ENTRIES);

      chrome.storage.local.set({[CACHE_KEY]: Object.fromEntries(mergedEntries)}, resolve);
    });
  });
}

function sanitizeCache(cache) {
  const now = Date.now();
  const pruned = {};
  let dirty = false;

  Object.entries(cache).forEach(([name, entry]) => {
    if (!entry || typeof entry.timestamp !== 'number') {
      dirty = true;
      return;
    }

    if ((now - entry.timestamp) >= CACHE_TTL_MS) {
      dirty = true;
      return;
    }

    pruned[name] = entry;
  });

  return {cache: pruned, dirty};
}


// Parse the rating from the page returned by Vivino
// Note: Vivino now embeds data as JSON in a data-preloaded-state attribute
function parseVivinoRating(html, wineName) {
  console.log("[Vivino Parser] Starting parse for: %s", wineName);

  // Log a sample of the HTML to see what we're working with
  const htmlSample = html.substring(0, 500);
  console.log("[Vivino Parser] HTML sample (first 500 chars): %s", htmlSample);

  const preloadedStateMatch = html.match(/data-preloaded-state="([^"]+)"/);
  const inlineStateMatch = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);

  const stateSources = [];
  if (preloadedStateMatch && preloadedStateMatch[1]) {
    stateSources.push({
      type: "data-preloaded-state",
      value: preloadedStateMatch[1],
      transform: decodeHtmlEntities
    });
  }

  if (inlineStateMatch && inlineStateMatch[1]) {
    stateSources.push({
      type: "__PRELOADED_STATE__",
      value: inlineStateMatch[1],
      transform: passthroughJson
    });
  }

  for (const source of stateSources) {
    try {
      const parsed = source.transform(source.value);
      const ratingTuple = parseSearchJson(parsed);
      if (ratingTuple) {
        console.log("[Vivino Parser] Parsed via %s", source.type);
        return ratingTuple;
      }
    } catch (error) {
      console.warn("[Vivino Parser] Failed parsing %s: %s", source.type, error);
    }
  }

  console.warn("[Vivino Parser] No parseable preloaded data found; falling back to legacy HTML parsing...");
  return [0.0, 0, '', ''];
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function passthroughJson(str) {
  return str;
}

function parseSearchJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const matches = data?.search_results?.matches;
  if (!matches || matches.length === 0) {
    return null;
  }

  const firstMatch = matches[0];
  const vintage = firstMatch?.vintage;
  const wine = vintage?.wine;
  if (!vintage || !wine) {
    return null;
  }

  const wineNameResult = vintage.name || wine.name || '';
  const rating = Number(vintage.statistics?.ratings_average || 0);
  const reviewCount = Number(vintage.statistics?.ratings_count || 0);
  const wineId = wine.id;
  if (!wineId) {
    return null;
  }

  const linkHref = `https://www.vivino.com/wines/${wineId}`;
  return [rating, reviewCount, wineNameResult, linkHref];
}
