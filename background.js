chrome.runtime.onMessage.addListener(
  // Send request to Vivino to get rating
  function(request, sender, sendResponse) {
    if (request.contentScriptQuery == "queryWine") {
      var url = "https://www.vivino.com/search/wines?q=" + encodeURIComponent(request.wineName);
      fetch(url)
          .then(response => response.text())
          .then(responseText => parseVivinoRating(responseText))
          .then(ratingAndReviewCount => sendResponse(ratingAndReviewCount))
          .catch(error => console.error("Error querying Vivino = " + error))
      return true;
    }
  }
);

// Parse the rating from the page returned by Vivino
function parseVivinoRating(html) {
  // Initialize the DOM parser
  const parser = new DOMParser();

  // Parse the text
  const document = parser.parseFromString(html, "text/html");

  const averageContainersElements = document.getElementsByClassName('average__container');
  for (var i = 0, l = averageContainersElements.length; i < l; i++) {
    // Find average rating
    const ratingElements = averageContainersElements[i].getElementsByClassName('text-inline-block light average__number');

    // Find number of reviews
    const reviewCountElements = averageContainersElements[i].getElementsByClassName('text-inline-block average__stars');

    if (ratingElements.length > 0 && reviewCountElements.length > 0) {
      const ratingStr = ratingElements[0].innerHTML.trim();
      const rating = parseFloat(ratingStr);
      if (isNaN(rating)) continue;

      const reviewCountStr = reviewCountElements[0].getElementsByClassName('text-micro')[0].innerHTML.trim(); 
      if (reviewCountStr.includes('ratings')) {
        const reviewCount = parseInt(reviewCountStr.slice(0, reviewCountStr.indexOf(' ')));
        if (isNaN(reviewCount)) continue;
         return [rating, reviewCount];
      }
    }  
  }

  return [0.0, 0];
}
