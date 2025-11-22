# Repository Guidelines

## Project Structure & Module Organization
- Core logic lives in `background.js` (service worker) and handles Vivino lookups, caching, and message routing; `content.js` augments Vinmonopolet pages with injected ratings.
- Extension metadata and permissions are defined in `manifest.json`; icons sit at the repo root.
- Tests reside in `tests/` (see `vivinoParser.test.js`), and top-level docs include `README.md` and this guide.

## Build, Test, and Development Commands
- No build step; load the unpacked extension via Chrome: open `chrome://extensions`, enable Developer Mode, choose **Load unpacked**, and select the repo root.
- Parser + cache offline check: `node tests/vivinoParser.test.js` (runs without hitting Vivino).
- Python 3.14 is available if you need quick scripts during debugging or HAR inspection.
- During manual QA, open Vinmonopolet product pages to confirm ratings render and logs show `[Vivino]` traces.

## Coding Style & Naming Conventions
- JavaScript with 2-space indentation, semicolons, and `const`/`let` (avoid `var`).
- Use `camelCase` for functions/variables and `UPPER_SNAKE_CASE` for shared constants (e.g., `CACHE_KEY`, `CACHE_TTL_MS`).
- Keep logging prefixed with `[Vivino]` for easy filtering; prefer small, pure helpers for parsing and normalization.

## Testing Guidelines
- Tests are Node-based with `assert` and vm sandboxes; avoid real network calls by stubbing `fetch`.
- Add new specs under `tests/` named `*.test.js`; include representative HTML snippets/fixtures for parsers and cache edges.
- Run `node tests/vivinoParser.test.js` before submitting; extend coverage for cache TTL, trimming, and legacy markup paths when altering parsing/caching logic.

## Commit & Pull Request Guidelines
- Commit messages: short, imperative ("Add cache trim guard"), scoped to one logical change.
- PRs should describe behavior changes, include test results/commands run, and note manual QA steps (pages visited, outcomes). Attach screenshots/GIFs for UI injections when relevant and link issues/tickets.

## Security & Configuration Tips
- Do not store secrets or tokens; host permissions should remain minimal and aligned with `manifest.json`.
- Keep network requests limited to Vivino search endpoints and respect cache TTL/entry caps to avoid unnecessary traffic.
- When adding storage keys, namespace under existing cache structures to prevent collisions.
