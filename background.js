chrome.runtime.onMessage.addListener(
  // Send request to Vivino to get rating
  function(request, sender, sendResponse) {
    if (request.contentScriptQuery == "queryWine") {
      var url = "https://www.vivino.com/search/wines?q=" + encodeURIComponent(request.wineName);
      fetch(url)
          .then(response => response.text())
          .then(text => parseRating(text))
          .then(response => sendResponse(response))
          .catch(error => console.error(error))
      return true;
    }
  }
);

// Parse the rating from the page returned by Vivino
function parseRating(html) {
  // Initialize the DOM parser
  var parser = new DOMParser();

  // Parse the text
  var document = parser.parseFromString(html, "text/html");
  
  // Find average rating
  var rating = document.getElementsByClassName('text-inline-block light average__number')[0].innerHTML.trim();

  // Find number of reviews
  var ratingCount = document.getElementsByClassName('text-inline-block average__stars')[0].getElementsByClassName('text-micro')[0].innerHTML.trim();
  return [rating, ratingCount];
}
