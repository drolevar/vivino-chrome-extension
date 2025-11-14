chrome.runtime.onMessage.addListener(
  // Send request to Vivino to get rating
  function(request, sender, sendResponse) {
    if (request.contentScriptQuery == "queryWine") {
      var url = "https://www.vivino.com/search/wines?q=" + encodeURIComponent(request.wineName);
      console.log("[Vivino] Querying: %s", request.wineName);
      console.log("[Vivino] URL: %s", url);
      fetch(url)
          .then(response => {
            console.log("[Vivino] Response status: %d", response.status);
            return response.text();
          })
          .then(responseText => {
            console.log("[Vivino] Response size: %d bytes", responseText.length);
            return parseVivinoRating(responseText, request.wineName);
          })
          .then(ratingAndReviewCount => {
            console.log("[Vivino] Result for '%s': %o", request.wineName, ratingAndReviewCount);
            sendResponse(ratingAndReviewCount);
          })
          .catch(error => {
            console.error("[Vivino] Error querying '%s': %s", request.wineName, error);
            sendResponse([0.0, 0, '', '']); // Return empty result on error
          });
      return true;
    }
  }
);

// Parse the rating from the page returned by Vivino
// Note: Service workers don't have access to DOMParser, so we use regex parsing
function parseVivinoRating(html, wineName) {
  console.log("[Vivino Parser] Starting parse for: %s", wineName);

  // Log a sample of the HTML to see what we're working with
  const htmlSample = html.substring(0, 500);
  console.log("[Vivino Parser] HTML sample (first 500 chars): %s", htmlSample);

  // Try multiple patterns for wine cards
  const wineCardPatterns = [
    /<div[^>]*class="[^"]*wine-card__content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g,
    /<div[^>]*class="[^"]*wineCard__[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
    /<div[^>]*data-testid="[^"]*wine-card[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  ];

  let cards = null;
  let patternIndex = -1;

  for (let i = 0; i < wineCardPatterns.length; i++) {
    const matches = Array.from(html.matchAll(wineCardPatterns[i]));
    if (matches.length > 0) {
      cards = matches;
      patternIndex = i;
      console.log("[Vivino Parser] Found %d cards using pattern %d", matches.length, i);
      break;
    }
  }

  if (!cards || cards.length === 0) {
    console.warn("[Vivino Parser] No wine cards found in HTML");
    console.log("[Vivino Parser] Searching for class 'wine-card' in HTML: %s", html.includes('wine-card') ? 'FOUND' : 'NOT FOUND');
    console.log("[Vivino Parser] Searching for class 'wineCard' in HTML: %s", html.includes('wineCard') ? 'FOUND' : 'NOT FOUND');
    return [0.0, 0, '', ''];
  }

  let cardNum = 0;
  for (const card of cards) {
    cardNum++;
    const cardHtml = card[1] || card[0];
    console.log("[Vivino Parser] Processing card %d (length: %d bytes)", cardNum, cardHtml.length);

    // Log a sample of the card HTML
    console.log("[Vivino Parser] Card %d sample: %s", cardNum, cardHtml.substring(0, 200));

    // Try multiple patterns for wine links
    const linkPatterns = [
      /<a[^>]*class="[^"]*link-color-alt-grey[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/,
      /<a[^>]*href="(\/wines\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/,
      /<a[^>]*class="[^"]*wineCard__[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/
    ];

    let linkMatch = null;
    for (const pattern of linkPatterns) {
      linkMatch = cardHtml.match(pattern);
      if (linkMatch) break;
    }

    // Try multiple patterns for ratings
    const ratingPatterns = [
      /<div[^>]*class="[^"]*text-inline-block light average__number[^"]*"[^>]*>([\d,\.]+)<\/div>/,
      /<div[^>]*class="[^"]*average__number[^"]*"[^>]*>([\d,\.]+)<\/div>/,
      /<span[^>]*class="[^"]*average[^"]*"[^>]*>([\d,\.]+)<\/span>/,
      /rating[^>]*>[\s\S]*?([\d,\.]+)[\s\S]*?<\/[^>]*>/i
    ];

    let ratingMatch = null;
    for (const pattern of ratingPatterns) {
      ratingMatch = cardHtml.match(pattern);
      if (ratingMatch) break;
    }

    // Try multiple patterns for review counts
    const reviewPatterns = [
      /<span[^>]*class="[^"]*text-micro[^"]*"[^>]*>([\d,]+)\s+ratings?<\/span>/,
      /<span[^>]*>([\d,]+)\s+ratings?<\/span>/i,
      />([\d,]+)\s+ratings?</i
    ];

    let reviewMatch = null;
    for (const pattern of reviewPatterns) {
      reviewMatch = cardHtml.match(pattern);
      if (reviewMatch) break;
    }

    console.log("[Vivino Parser] Card %d - Link: %s, Rating: %s, Reviews: %s",
      cardNum,
      linkMatch ? 'FOUND' : 'NOT FOUND',
      ratingMatch ? 'FOUND (' + ratingMatch[1] + ')' : 'NOT FOUND',
      reviewMatch ? 'FOUND (' + reviewMatch[1] + ')' : 'NOT FOUND'
    );

    if (linkMatch && ratingMatch && reviewMatch) {
      const linkHref = linkMatch[1].startsWith('http') ? linkMatch[1] : 'https://www.vivino.com' + linkMatch[1];
      const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      const ratingStr = ratingMatch[1].trim().replace(',', '.');
      const rating = parseFloat(ratingStr);
      if (isNaN(rating)) {
        console.warn("[Vivino Parser] Card %d - Invalid rating: %s", cardNum, ratingStr);
        continue;
      }

      const reviewCountStr = reviewMatch[1].replace(/,/g, '').replace(/\s/g, '');
      const reviewCount = parseInt(reviewCountStr);
      if (isNaN(reviewCount)) {
        console.warn("[Vivino Parser] Card %d - Invalid review count: %s", cardNum, reviewCountStr);
        continue;
      }

      console.log("[Vivino Parser] ✓ Successfully parsed card %d: %s (%.1f stars, %d reviews)",
        cardNum, linkText, rating, reviewCount);
      return [rating, reviewCount, linkText, linkHref];
    }
  }

  console.warn("[Vivino Parser] No valid wine data found after checking %d cards", cardNum);
  return [0.0, 0, '', ''];
}
