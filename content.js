// Behaves very similarly to $.ready() but does not require jQuery.
const onReady = function (callback) {
  if (document.readyState === 'complete') {
    window.setTimeout(callback, 0);
  } else {
    window.addEventListener('load', callback, false);
  }
};

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    onUrlChange();
  }
}).observe(document, {subtree: true, childList: true});

function onUrlChange() {
  console.log('URL changed!', location.href);
  processUpdates(document.URL);
}

// Excecute any bandaid for the specific site, if the bandaids.js was loaded.
onReady(() => {
  if (typeof processUpdates === 'function') {
    processUpdates(document.URL);
  }
});

function processUpdates(url) {
  if (url.includes('majestic')) { // YES
    handleMajestic();
  } else if (url.includes('laithwaites')) { // YES
    handleLaithwaites();
  } else if (url.includes('virginwines')) { // YES
    handleVirginWines();
  } else if (url.includes('vinmonopolet')) { // YES
    handleVinmonopoletWines();
  }
}

function handleMajestic() {
  // Find and iterate through all the wines listed on the page
  const wineElements = document.getElementsByClassName('product-details__header');
  for (var i = 0, l = wineElements.length; i < l; i++) {
    insertRating(wineElements[i].getElementsByClassName('space-b--none')[0]);
  }
}

function handleLaithwaites() {
  // Find and iterate through all the wines listed on the page
  const wineElements = document.getElementsByClassName('print-item');
  for (var i = 0, l = wineElements.length; i < l; i++) {
      insertRating(wineElements[i].getElementsByTagName('h3')[0]);
  }
}

function handleVirginWines() {
  // Find and iterate through all the wines listed on the page
  const wineElements = document.getElementsByClassName('mb-0 text-sanchez font-weight-bold');
  for (var i = 0, l = wineElements.length; i < l; i++) {
    insertRating(wineElements[i]);
  }
}

function handleVinmonopoletWines() {
  // Find and iterate through all the wines listed on the page
  const wineElements = document.getElementsByClassName('product__name');
  console.log("Processing %d wines... %s", wineElements.length, document.readyState);
  for (var i = 0, l = wineElements.length; i < l; i++) {
    console.log("Processing %s...", wineElements[i].innerHTML.trim());
    insertVinmonopoletRating(wineElements[i]);
  }
}

function processResponse(wineNameElement, response) {
  parentEl = wineNameElement.parentElement;
  if (parentEl.tagName === 'A') {
    parparEl = parentEl.parentElement;

    var aName = document.createElement('a');
    aName.href = response[3];

    parparEl.insertBefore(aName, parentEl.nextSibling);

    var divName = document.createElement('div');
    divName.className = 'product__name';
    divName.innerText = response[2] + '<br>(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";

    aName.appendChild(divName);
  } else {
    const wineName = wineNameElement.outerText;
    wineNameElement.innerHTML = wineName + '<br>' + response[2] + '<br>(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";
  }
}

// Retrieve the Vivino rating and update the wine name element
function insertVinmonopoletRating(wineNameElement) {
  const wineName = wineNameElement.outerText;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {contentScriptQuery: "queryWine", wineName: wineName}, response => {
          if (response) {
            // Check if there was an error
            if (response[0] === 'error') {
              let parentEl = wineNameElement.parentElement;
              if (parentEl.tagName === 'A') {
                let parparEl = parentEl.parentElement;
                let divError = document.createElement('div');
                divError.className = 'product__district';
                divError.innerHTML = '<span style="color: red;">failed</span>';
                parparEl.insertBefore(divError, parentEl.nextSibling);
              } else {
                const wineName = wineNameElement.outerText;
                wineNameElement.innerHTML = wineName + '<br><span style="color: red;">failed</span>';
              }
            } else {
              let parentEl = wineNameElement.parentElement;
              if (parentEl.tagName === 'A') {
                let parparEl = parentEl.parentElement;
                let aName = document.createElement('a');
                aName.href = response[3];

                parparEl.insertBefore(aName, parentEl.nextSibling);

                let divName = document.createElement('div');
                divName.className = 'product__district';
                divName.innerText = response[2];

                let divRating = document.createElement('div');
                divRating.className = 'product__district';
                divRating.innerText = '(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";

                aName.appendChild(divName);
                aName.appendChild(divRating);
              } else {
                const wineName = wineNameElement.outerText;
                wineNameElement.innerHTML = wineName + '<br>' + response[2] + '<br>(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";
              }
            }
            resolve(response);
          } else {
            reject('Encountered an error!');
          }
    });
  });
}

// Retrieve the Vivino rating and update the wine name element
function insertRating(wineNameElement) {
  const wineName = wineNameElement.outerText;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {contentScriptQuery: "queryWine", wineName: wineName}, response => {
        if(response) {
          // Check if there was an error
          if (response[0] === 'error') {
            wineNameElement.innerHTML = wineName + '<br><span style="color: red;">failed</span>';
          } else {
            wineNameElement.innerHTML = wineName + '<br>(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";
          }
          resolve(response)
        } else {
          reject('Encountered an error!');
        }
    });
  });
}
