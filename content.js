// Find and iterate through all the wines listed on the page
var productHeaders = document.getElementsByClassName('product-details__header');
for (var i = 0, l = productHeaders.length; i < l; i++) {
  var wineNameElement = productHeaders[i].getElementsByClassName('space-b--none')[0];

  insertRating(wineNameElement);
}

// Retrieve the Vivino rating and update the wine name element
function insertRating(wineNameElement) {
  var wineName = wineNameElement.outerText;
  console.log(wineName);
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {contentScriptQuery: "queryWine", wineName: wineName}, response => {
        if(response) {
          wineNameElement.innerHTML = wineName + '\n(Rating: ' + response + ")";
          resolve(response)
        } else {
          reject('Something wrong');
        }
    });
  });
}
