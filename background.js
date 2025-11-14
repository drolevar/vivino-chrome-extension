chrome.runtime.onMessage.addListener(
  // Send request to Vivino to get rating
  function(request, sender, sendResponse) {
    if (request.contentScriptQuery == "queryWine") {
      var url = "https://www.vivino.com/search/wines?q=" + encodeURIComponent(request.wineName);
      console.log("Querying %s...", request.wineName);
      fetch(url)
          .then(response => response.text())
          .then(responseText => parseVivinoRating(responseText))
          .then(ratingAndReviewCount => sendResponse(ratingAndReviewCount))
          .catch(error => {
            console.error("Error querying Vivino = " + error);
            sendResponse([0.0, 0, '', '']); // Return empty result on error
          });
      return true;
    }
  }
);

// Parse the rating from the page returned by Vivino
// Note: Service workers don't have access to DOMParser, so we use regex parsing
function parseVivinoRating(html) {
  // Extract wine cards from HTML
  const wineCardRegex = /<div[^>]*class="[^"]*wine-card__content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const cards = html.matchAll(wineCardRegex);

  for (const card of cards) {
    const cardHtml = card[1];

    // Extract wine link and name
    const linkRegex = /<a[^>]*class="[^"]*link-color-alt-grey[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/;
    const linkMatch = cardHtml.match(linkRegex);

    // Extract rating
    const ratingRegex = /<div[^>]*class="[^"]*text-inline-block light average__number[^"]*"[^>]*>([\d,\.]+)<\/div>/;
    const ratingMatch = cardHtml.match(ratingRegex);

    // Extract review count
    const reviewRegex = /<span[^>]*class="[^"]*text-micro[^"]*"[^>]*>([\d,]+)\s+ratings?<\/span>/;
    const reviewMatch = cardHtml.match(reviewRegex);

    if (linkMatch && ratingMatch && reviewMatch) {
      const linkHref = 'https://www.vivino.com' + linkMatch[1];
      const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      const ratingStr = ratingMatch[1].trim().replace(',', '.');
      const rating = parseFloat(ratingStr);
      if (isNaN(rating)) continue;

      const reviewCountStr = reviewMatch[1].replace(/,/g, '');
      const reviewCount = parseInt(reviewCountStr);
      if (isNaN(reviewCount)) continue;

      return [rating, reviewCount, linkText, linkHref];
    }
  }

  return [0.0, 0, '', ''];
}
