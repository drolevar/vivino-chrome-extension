// Behaves very similarly to $.ready() but does not require jQuery.
const onReady = function (callback) {
  if (document.readyState === 'complete') {
    window.setTimeout(callback, 0);
  } else {
    window.addEventListener('load', callback, false);
  }
};

const VINMONO_NAME_CLASS = 'product__name';
const PROCESSED_ATTR = 'vivinoProcessed';
const ORIGINAL_NAME_ATTR = 'vivinoOriginalName';
const ENABLE_KEY = 'vivinoEnabled';

const vinmonopoletController = createVinmonopoletController();

let lastUrl = location.href;
const debouncedProcess = debounce(() => vinmonopoletController.processPage(), 250);

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    vinmonopoletController.reset();
    debouncedProcess();
  }
}).observe(document.body || document.documentElement, {subtree: true, childList: true});

onReady(() => {
  vinmonopoletController.processPage();
});

function createVinmonopoletController() {
  const sessionRatings = new Map();
  const inflight = new Map();
  let enabled = true;

  chrome.storage.local.get(ENABLE_KEY, result => {
    if (typeof result[ENABLE_KEY] === 'boolean') {
      enabled = result[ENABLE_KEY];
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[ENABLE_KEY]) {
      enabled = !!changes[ENABLE_KEY].newValue;
      if (!enabled) {
        this.reset();
      } else {
        debouncedProcess();
      }
    }
  });

  return {
    reset() {
      sessionRatings.clear();
      inflight.clear();
      Array.from(document.getElementsByClassName(VINMONO_NAME_CLASS)).forEach(el => {
        delete el.dataset[PROCESSED_ATTR];
      });
    },

    async processPage() {
      if (!enabled) {
        console.log("[Vivino] Disabled; skipping page processing");
        return;
      }
      const wineElements = document.getElementsByClassName(VINMONO_NAME_CLASS);
      if (!wineElements.length) return;

      console.log("[Vivino] Processing %d wines... %s", wineElements.length, document.readyState);

      for (const wineElement of wineElements) {
        if (wineElement.dataset[PROCESSED_ATTR] === 'true') continue;

        const rawName = wineElement.dataset[ORIGINAL_NAME_ATTR] || wineElement.textContent.trim();
        const normalizedName = normalizeWineName(rawName);
        wineElement.dataset[ORIGINAL_NAME_ATTR] = rawName;

        try {
          const response = await lookupRating(normalizedName, rawName);
          if (!response) continue;

          if (response[0] === 'error') {
            renderError(wineElement, rawName);
          } else {
            renderRating(wineElement, rawName, response);
          }
          wineElement.dataset[PROCESSED_ATTR] = 'true';
        } catch (error) {
          console.error('[Vivino] Failed to render rating for %s: %s', rawName, error);
          renderError(wineElement, rawName);
          wineElement.dataset[PROCESSED_ATTR] = 'true';
        }
      }
    }
  };

  function lookupRating(normalizedName, displayName) {
    if (sessionRatings.has(normalizedName)) {
      return Promise.resolve(sessionRatings.get(normalizedName));
    }

    if (inflight.has(normalizedName)) {
      return inflight.get(normalizedName);
    }

    const pending = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({contentScriptQuery: "queryWine", wineName: displayName}, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        if (response && response[0] !== 'error') {
          sessionRatings.set(normalizedName, response);
        }

        resolve(response);
      });
    }).finally(() => inflight.delete(normalizedName));

    inflight.set(normalizedName, pending);
    return pending;
  }
}

function debounce(fn, wait) {
  let timeout = null;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function normalizeWineName(name = '') {
  return name.trim().toLowerCase();
}

function clearChildren(element) {
  while (element.lastChild) {
    element.removeChild(element.lastChild);
  }
}

function renderError(wineNameElement, wineName) {
  const parentEl = wineNameElement.parentElement;
  if (parentEl.tagName === 'A') {
    const parparEl = parentEl.parentElement;
    const divError = document.createElement('div');
    divError.className = 'product__district';
    divError.textContent = 'Vivino lookup failed';
    parparEl.insertBefore(divError, parentEl.nextSibling);
  } else {
    clearChildren(wineNameElement);

    const nameNode = document.createElement('div');
    nameNode.textContent = wineName;
    const errorNode = document.createElement('div');
    errorNode.style.color = 'red';
    errorNode.textContent = 'Vivino lookup failed';

    wineNameElement.appendChild(nameNode);
    wineNameElement.appendChild(errorNode);
  }
}

function renderRating(wineNameElement, wineName, response) {
  const parentEl = wineNameElement.parentElement;
  if (parentEl.tagName === 'A') {
    const parparEl = parentEl.parentElement;
    const aName = document.createElement('a');
    aName.href = response[3];

    parparEl.insertBefore(aName, parentEl.nextSibling);

    const divName = document.createElement('div');
    divName.className = 'product__district';
    divName.innerText = response[2];

    const divRating = document.createElement('div');
    divRating.className = 'product__district';
    divRating.innerText = '(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";

    aName.appendChild(divName);
    aName.appendChild(divRating);
  } else {
    clearChildren(wineNameElement);

    const nameNode = document.createElement('div');
    nameNode.textContent = wineName;
    const vivinoNameNode = document.createElement('div');
    vivinoNameNode.textContent = response[2];
    const ratingNode = document.createElement('div');
    ratingNode.textContent = '(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";

    wineNameElement.appendChild(nameNode);
    wineNameElement.appendChild(vivinoNameNode);
    wineNameElement.appendChild(ratingNode);
  }
}
