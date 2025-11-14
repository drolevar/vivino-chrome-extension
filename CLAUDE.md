# CLAUDE.md - AI Assistant Guide for Vivino Chrome Extension

## Project Overview

This is a Chrome extension that retrieves wine ratings from [Vivino](https://www.vivino.com/) and displays them on various online wine retailer websites. The extension is lightweight, uses vanilla JavaScript (no frameworks or build tools), and operates as a Manifest V3 Chrome extension compatible with the latest Chrome versions.

**Supported Wine Retailers:**
- Majestic (UK) - https://www.majestic.co.uk/wine
- Laithwaite's (UK) - https://www.laithwaites.co.uk/wines
- Virgin Wines (UK) - https://www.virginwines.co.uk/browse
- Vinmonopolet (Norway) - https://www.vinmonopolet.no

**Current Version:** 1.0.0

## Codebase Structure

```
vivino-chrome-extension/
├── manifest.json          # Chrome extension configuration (Manifest V3)
├── background.js          # Service worker for API calls to Vivino
├── content.js            # Content script injected into retailer pages
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
├── README.md             # User-facing documentation
├── CLAUDE.md             # AI assistant guide (this file)
├── .gitignore            # Git ignore rules
└── .gitattributes        # Git line-ending configuration
```

**Key Characteristics:**
- No package.json (no npm dependencies)
- No build process or bundler
- Pure vanilla JavaScript
- No external libraries (not even jQuery)
- Direct DOM manipulation

## Key Files and Their Responsibilities

### manifest.json
- **Purpose:** Chrome extension configuration
- **Key Settings:**
  - Manifest version: 3 (latest Chrome standard)
  - Host permissions: Access to vivino.com for cross-origin requests
  - Content scripts: Injected into retailer pages at document_idle
  - Background service worker: Handles API communication with Vivino
  - Icons: Three sizes (16, 48, 128)

### background.js
- **Purpose:** Service worker handling API communication with Vivino
- **Key Functions:**
  - `chrome.runtime.onMessage.addListener()`: Listens for wine name queries from content scripts
  - `parseVivinoRating(html)`: Parses Vivino search results page using regex

- **How it works:**
  1. Receives wine name from content script
  2. Fetches Vivino search page via fetch API
  3. Parses HTML using regex patterns (service workers don't have access to DOMParser)
  4. Extracts rating, review count, wine name, and link from first matching wine card
  5. Returns data array: `[rating, reviewCount, linkText, linkHref]`

- **Important Details:**
  - Uses regex to find elements with class `wine-card__content`
  - Extracts rating from `text-inline-block light average__number` via regex
  - Extracts reviews from `text-micro` elements containing "ratings" via regex
  - Returns `[0.0, 0, '', '']` if no match found
  - Replaces commas with periods in rating strings (handles European number format)
  - **Service Worker Note:** Cannot use DOMParser as it's unavailable in service worker context

### content.js (152 lines)
- **Purpose:** Content script injected into retailer pages
- **Key Functions:**
  - `onReady(callback)`: Document ready handler (no jQuery dependency)
  - `processUpdates(url)`: Routes to appropriate retailer handler
  - `handleMajestic()`: Majestic-specific wine element finder
  - `handleLaithwaites()`: Laithwaite's-specific wine element finder
  - `handleVirginWines()`: Virgin Wines-specific wine element finder
  - `handleVinmonopoletWines()`: Vinmonopolet-specific wine element finder
  - `insertRating(wineNameElement)`: Generic rating inserter (for UK retailers)
  - `insertVinmonopoletRating(wineNameElement)`: Vinmonopolet-specific rating inserter

- **How it works:**
  1. Waits for page load
  2. Detects which retailer site via URL matching
  3. Finds wine name elements using retailer-specific class names
  4. Sends wine names to background script
  5. Receives ratings and inserts them into DOM

- **SPA Support:**
  - Uses MutationObserver to detect URL changes (lines 11-17)
  - Automatically reprocesses when URL changes (for single-page applications)

## Architecture Patterns

### Communication Flow
```
Content Script → Background Script → Vivino API → Background Script → Content Script
     (DOM)           (Fetch)          (HTML)         (Parse)           (Update DOM)
```

### Message Passing
```javascript
// Content script sends:
chrome.runtime.sendMessage({
  contentScriptQuery: "queryWine",
  wineName: "Wine Name"
}, response => { /* handle response */ });

// Background script responds with:
[rating, reviewCount, matchedWineName, vivinoUrl]
// Example: [4.2, 1234, "Château Example 2019", "https://www.vivino.com/wines/..."]
```

## Code Conventions

### Naming Conventions
- **Functions:** camelCase (e.g., `handleMajestic`, `insertRating`)
- **Variables:** camelCase (e.g., `wineElements`, `wineName`)
- **Constants:** Use `const` for DOM elements and single-assignment variables
- **Legacy:** Uses `var` in loops (older JavaScript style)

### DOM Manipulation Style
- Uses vanilla JavaScript DOM methods:
  - `document.getElementsByClassName()` (returns live HTMLCollection)
  - `document.getElementsByTagName()`
  - `element.innerHTML` for modifying content
  - `element.outerText` for reading text
  - `document.createElement()` and `appendChild()` for adding elements

### Iteration Pattern
```javascript
const elements = document.getElementsByClassName('some-class');
for (var i = 0, l = elements.length; i < l; i++) {
  // Process elements[i]
}
```
**Note:** Caches length in variable `l` to avoid repeated property access.

### Console Logging
- Uses `console.log()` for debugging
- Format: `console.log("Message with %s", variable)` for string interpolation
- Present in background.js and Vinmonopolet handler

## Adding Support for New Retailers

When adding a new wine retailer, follow this pattern:

### Step 1: Update manifest.json
Add the new retailer URL to `content_scripts.matches`:
```json
"matches": [
  "https://www.majestic.co.uk/wine*",
  "https://www.laithwaites.co.uk/wines*",
  "https://www.virginwines.co.uk/*",
  "https://www.vinmonopolet.no/*",
  "https://new-retailer.com/*"
]
```

### Step 2: Add Handler in content.js
Create a new handler function following the naming pattern:
```javascript
function handleNewRetailer() {
  // Find wine name elements using retailer-specific selectors
  const wineElements = document.getElementsByClassName('retailer-wine-class');
  for (var i = 0, l = wineElements.length; i < l; i++) {
    insertRating(wineElements[i]);
  }
}
```

### Step 3: Update processUpdates()
Add routing logic:
```javascript
function processUpdates(url) {
  if (url.includes('majestic')) {
    handleMajestic();
  } else if (url.includes('laithwaites')) {
    handleLaithwaites();
  } else if (url.includes('virginwines')) {
    handleVirginWines();
  } else if (url.includes('vinmonopolet')) {
    handleVinmonopoletWines();
  } else if (url.includes('new-retailer')) {
    handleNewRetailer();
  }
}
```

### Step 4: Choose Appropriate Insert Function
- Use `insertRating()` for simple inline insertion
- Create custom insert function if layout requires special handling (see Vinmonopolet example)

### Step 5: Update README.md and manifest.json description
Add the new retailer to the supported list.

## Retailer-Specific Implementation Details

### Majestic (lines 43-49)
- **Selector:** `product-details__header` → `space-b--none`
- **Strategy:** Simple inline insertion

### Laithwaite's (lines 51-57)
- **Selector:** `print-item` → `h3`
- **Strategy:** Simple inline insertion

### Virgin Wines (lines 59-65)
- **Selector:** `mb-0 text-sanchez font-weight-bold`
- **Strategy:** Simple inline insertion

### Vinmonopolet (lines 67-134)
- **Selector:** `product__name`
- **Strategy:** Complex DOM insertion with separate elements for wine name and rating
- **Special Handling:**
  - Checks if parent is anchor tag
  - Creates new anchor and divs
  - Uses `product__district` class for styling
  - Splits wine name and rating into separate elements

## Development Workflow

### Local Testing
1. **Load Extension in Chrome:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

2. **Test on Retailer Sites:**
   - Visit supported retailer websites
   - Open Chrome DevTools Console (F12)
   - Look for debug messages: "Querying [wine name]..."
   - Verify ratings appear below wine names

3. **Debugging:**
   - Check Console for errors
   - Use `console.log()` statements
   - Inspect Network tab for Vivino API calls
   - Use Elements tab to verify DOM modifications

### Making Changes
1. **Edit Files:** Modify background.js or content.js
2. **Reload Extension:**
   - Go to `chrome://extensions/`
   - Click refresh icon on the extension
3. **Hard Reload Page:** Ctrl+Shift+R on retailer site
4. **Test Changes**

### Version Bumping
When releasing:
1. Update `version` in manifest.json
2. Follow semantic versioning (currently 0.0.2)
3. Document changes in git commit message

## Git Workflow

### Branch Structure
- Feature branches follow pattern: `claude/claude-md-[session-id]`
- All development happens on feature branches
- Branch naming is critical for push permissions

### Commit Guidelines
- Write clear, descriptive commit messages
- Recent commits show pattern: "Add [Feature] support", "Update [component]"
- Keep commits focused on single changes

### Pushing Changes
```bash
# Always use -u flag with branch name
git push -u origin <branch-name>

# Branch must start with 'claude/' for permissions
# Example:
git push -u origin claude/claude-md-mhz1cg9m0kd0xna0-01SmtYsKNLGgmPCa474hs8yX
```

### Pull Request Process
1. Commit changes to feature branch
2. Push to remote
3. Create PR to main/master branch
4. Document changes clearly

## Testing and Debugging

### Manual Testing Checklist
- [ ] Load extension in Chrome Developer mode
- [ ] Visit each supported retailer site
- [ ] Verify ratings appear for multiple wines
- [ ] Check console for errors
- [ ] Test on wine search results pages
- [ ] Test on individual wine product pages
- [ ] Verify links to Vivino work correctly
- [ ] Test with wines that may not be on Vivino

### Common Issues

**Ratings not appearing:**
1. Check if retailer changed their HTML structure/class names
2. Verify content script is injecting (check console logs)
3. Confirm Vivino API is accessible
4. Check if wine name extraction is correct

**Wrong wine matched:**
- Vivino search returns first match - wine names must be fairly accurate
- Consider improving wine name extraction from retailer page
- May need to strip extra text (vintage, region) for better matching

**Extension not loading:**
- Check manifest.json for syntax errors
- Verify all file paths are correct
- Check Chrome extensions page for error messages

## Chrome Extension Specifics

### Manifest V3 (Current)
- **Current:** Manifest V3 (as of version 1.0.0)
- **Status:** Fully compatible with latest Chrome versions
- **Key Features:**
  - Service worker instead of background page
  - `chrome.runtime.onMessage` patterns work the same
  - `fetch()` API works perfectly in service workers
  - **Important:** DOMParser not available in service workers - use regex/string parsing instead

### Permissions
- **Host Permissions:** `https://www.vivino.com/*` for cross-origin fetch requests
- **Minimal:** Good security practice - only request what's needed
- **Content Scripts:** Declared in manifest, auto-injected on matching URLs

### Content Script Injection
- **Timing:** `document_idle` (after DOM loaded but before window.onload)
- **Matches:** URL patterns for each retailer
- **Run At:** Optimal for DOM manipulation without blocking page load

## Common AI Assistant Tasks

### Task: Add New Retailer Support
1. Ask user for retailer URL and wine element selectors
2. Inspect retailer website to find wine name elements
3. Update manifest.json matches array
4. Add handler function in content.js
5. Update processUpdates() routing
6. Test thoroughly
7. Update README.md

### Task: Fix Broken Retailer
1. Visit retailer website
2. Inspect current HTML structure
3. Update class names/selectors in handler function
4. Test rating injection
5. Verify Vivino links work

### Task: Improve Wine Matching
1. Modify wine name extraction in content.js
2. Consider stripping year, region, size info
3. Update background.js parsing if needed
4. Test with various wine names

### Task: Update to Manifest V3
**Status:** ✅ Completed in version 1.0.0

The extension has been successfully migrated to Manifest V3:
1. ✅ Changed `manifest_version` to 3
2. ✅ Converted background.js to service worker (replaced DOMParser with regex)
3. ✅ Updated permissions to use `host_permissions`
4. ✅ Message passing works correctly
5. ✅ Documentation updated

**Key Changes Made:**
- Replaced `background.scripts` with `background.service_worker`
- Moved Vivino URL from `permissions` to `host_permissions`
- Replaced DOMParser with regex-based HTML parsing (service workers don't support DOM APIs)

### Task: Add Features
Common feature requests:
- **Rating display customization:** Modify HTML insertion in insert functions
- **Caching:** Add storage to avoid repeated API calls
- **Multiple matches:** Show all Vivino results instead of first
- **Price comparison:** Extend to fetch Vivino prices
- **Error handling:** Add user-visible error messages

## Code Quality Guidelines

### When Making Changes
- ✅ Maintain vanilla JavaScript (no dependencies)
- ✅ Follow existing code style and patterns
- ✅ Add console.log for debugging new features
- ✅ Handle cases where elements don't exist
- ✅ Use Promises for async operations
- ✅ Keep background script non-persistent
- ✅ Test on all supported retailers

### When Reviewing Code
- Check for DOM selector brittleness
- Verify error handling (network failures, missing elements)
- Confirm message passing works correctly
- Test with various wine names and formats
- Validate HTML injection doesn't break retailer layouts

## Security Considerations

### Current Security Posture
- **Good:** Minimal permissions
- **Good:** No external script loading
- **Good:** No eval() or innerHTML with user input
- **Note:** Uses innerHTML but only with controlled data from Vivino

### If Adding Features
- Avoid `eval()` and `Function()` constructor
- Sanitize any user input before DOM insertion
- Keep permissions minimal
- Don't store sensitive data
- Use HTTPS for all API calls

## Performance Considerations

### Current Approach
- **Lazy loading:** Content script only runs on retailer pages
- **Non-persistent background:** Background script unloads when idle
- **Parallel queries:** Each wine queried independently
- **No caching:** Every page load queries Vivino fresh

### Potential Optimizations
- Add caching with chrome.storage API (24-hour TTL)
- Batch queries to reduce API calls
- Debounce for SPA navigation
- Lazy load ratings on scroll for long lists

## Useful Chrome Extension APIs

### Currently Used
- `chrome.runtime.sendMessage()` - Content to background communication
- `chrome.runtime.onMessage.addListener()` - Background message handler

### Potentially Useful
- `chrome.storage.local` - Cache ratings
- `chrome.storage.sync` - User preferences across devices
- `chrome.tabs.query()` - Tab management
- `chrome.notifications` - User notifications
- `chrome.contextMenus` - Right-click menu options

## Resources

### Documentation
- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- Manifest V2: https://developer.chrome.com/docs/extensions/mv2/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Message Passing: https://developer.chrome.com/docs/extensions/mv3/messaging/

### Vivino
- Search URL pattern: `https://www.vivino.com/search/wines?q={wine_name}`
- Returns HTML page with wine cards
- No official API used (web scraping approach)

### Testing
- Test retailers:
  - https://www.majestic.co.uk/wine
  - https://www.laithwaites.co.uk/wines
  - https://www.virginwines.co.uk/browse
  - https://www.vinmonopolet.no

## Project History

### Recent Changes (from git log)
- **9933392:** Add Vinmonopolet support - most recent major feature
- **e4e5bd3:** Adding icons - added extension icons
- **effafde:** Updated manifest with references to icons

### Project Maturity
- Early stage (v0.0.2)
- Core functionality working
- Growing retailer support
- No automated tests
- Manual testing workflow

## Notes for AI Assistants

### When Analyzing This Codebase
1. **It's simple:** Don't over-engineer solutions
2. **No build step:** Changes are direct - no compilation/bundling
3. **Browser-only:** Test requires Chrome browser
4. **Web scraping:** Vivino integration is fragile (depends on their HTML structure)
5. **Legacy patterns:** Code uses older JS patterns (var, callbacks) - maintain consistency

### Communication with User
- Explain that testing requires loading in Chrome
- Mention that retailer HTML changes can break functionality
- Note that Vivino matching is best-effort (first result)
- Clarify that this is a client-side only extension (no backend)

### Best Practices for This Project
- Keep it simple and dependency-free
- Maintain backward compatibility with existing retailers
- Test all retailers when making core changes
- Document any new retailer-specific quirks
- Consider Vivino HTML structure changes when debugging

---

**Last Updated:** 2025-11-14
**Extension Version:** 1.0.0
**Manifest Version:** 3 (Chrome Latest Compatible)
