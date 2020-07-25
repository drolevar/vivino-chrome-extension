processUpdates(document.URL);


function processUpdates(url) {
  if (url.includes('majestic')) { // YES
    handleMajestic();
  } else if (url.includes('laithwaites')) { // YES
    handleLaithwaites();
  } else if (url.includes('virginwines')) { // YES
    handleVirginWines();
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

// Retrieve the Vivino rating and update the wine name element
function insertRating(wineNameElement) {
  const wineName = wineNameElement.outerText;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {contentScriptQuery: "queryWine", wineName: wineName}, response => {
        if(response) {
          wineNameElement.innerHTML = wineName + '<br>(Rating: ' + response[0] + ", Reviews: " + response[1] + ")";
          resolve(response)
        } else {
          reject('Encountered an error!');
        }
    });
  });
}
