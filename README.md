# Cell Teardown

An interactive 3D teardown of three lithium-ion battery cells: a **4680 cylinder**, an **LFP prismatic (box)** cell and an **NMC pouch** cell. Scroll to take a cell apart layer by layer, then compare how much power each one gives in the analytics section.

Built with **Three.js** and **Vite**, deployed as a static site on **Cloudflare Workers (static assets)**. There is no backend and no database: every page is plain files served from Cloudflare's edge.

---

## Quick start

```bash
npm install          # Node 20+
npm run dev          # http://localhost:5173 with hot reload
```

| Script | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm test` | Unit tests (Vitest): data integrity, timeline, calculator maths |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run cf:dev` | Build, then run it on Cloudflare's local runtime (tests `_headers` and 404 handling too) |
| `npm run check` | Tests + build. Run this before every deploy |
| `npm run deploy` | `check`, then `wrangler deploy` to Cloudflare |

---

## Deploy to Cloudflare

### Option A: from your computer (fastest)

```bash
npx wrangler login     # opens the browser once to connect your Cloudflare account
npm run deploy         # tests → build → upload
```

Wrangler prints your URL, e.g. `https://cell-teardown.<your-subdomain>.workers.dev`.

### Option B: automatic deploys from GitHub

1. Push this folder to a GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, then pick the repo.
3. Set:
   - **Build command:** `npm run check`
   - **Deploy command:** `npx wrangler deploy`
4. Save. Every push to your main branch now tests, builds and deploys automatically. A failing test stops the deploy.

### Custom domain

Dashboard → your Worker → **Settings → Domains & Routes → Add → Custom domain**. The domain must be on a zone in your Cloudflare account.

### What Cloudflare serves

- `wrangler.jsonc` points Cloudflare at `./dist`. No Worker script is needed.
- `public/_headers` adds security headers (CSP, no framing, nosniff) and caches `/assets/*` for a year. That is safe because Vite puts a content hash in every asset file name, so each deploy produces new names.
- `public/404.html` is served for unknown paths (`not_found_handling: "404-page"`).

---

## Architecture

The code is split so data only flows one way:

```
 input                 pure logic               views
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ scroll       │     │ core/timeline.js │     │ models/*.js  (3D)       │
│ drag         │ ──► │  scroll position │ ──► │ ui/overlay.js (markers) │
│ type buttons │     │  → scene state   │     │ ui/story.js   (text)    │
└──────────────┘     └──────────────────┘     │ ui/analytics.js (charts)│
        ▲                     ▲               └─────────────────────────┘
        │              data/cells.js  ◄── single source of truth for every cell
     main.js (wires everything together, runs the render loop)
```

- **`src/data/cells.js`**: every fact about every cell (specs, part descriptions, discharge curve). The story text, specs grid, charts and calculators are all generated from it, so they can't disagree with each other.
- **`src/core/timeline.js`**: turns scroll position into a plain object describing the scene (which part is in focus, how far apart things are, camera framing). It has no DOM or Three.js code, so it's unit-tested.
- **`src/core/calc.js`**: pack, runtime and curve maths, also unit-tested.
- **`src/core/scene.js`**: renderer, camera, lighting and studio reflections. It knows nothing about batteries.
- **`src/models/`**: one file per 3D model. Every model has the same interface:
  ```js
  build() → { root, parts, frame, settleAngle, dims, floorY(state), update(state, time, layout), dispose() }
  ```
  `common.js` holds shared pieces: highlight/dim registry, ion particles, the electron circuit, and GPU cleanup.
- **`src/ui/`**: DOM work. `story.js` renders the scroll sections, `overlay.js` projects 3D points to screen for markers and dimension lines, and `analytics.js` draws SVG charts at the container's real width.
- **`src/main.js`**: the only file that knows about all the others.

### Layout

- **Desktop:** the 3D canvas fills the window, and text cards scroll in a left column. The camera's view offset shifts the model into the right-hand ~62%.
- **Phone (≤ 820 px):** split screen. The 3D panel is pinned to the top 44% of the screen and the text scrolls underneath it, so they never overlap. The panel slides away when the analytics section starts.

### Robustness

- No WebGL, or the GPU drops the context: the page shows a text-only fallback, and every card and chart still works.
- `prefers-reduced-motion`: no idle spin and no easing; scroll maps directly to the model.
- Switching cell type frees the old model's GPU memory (`dispose()`).
- `localStorage` (which remembers the last cell type) is wrapped in try/catch, so private mode can't break the page.
- Three.js is pinned to an exact version and bundled from npm; there is no CDN dependency at runtime.

---

## Add a new cell type

1. Add an entry to `CELLS` and `CELL_ORDER` in `src/data/cells.js`. Its parts must include the ids `cathode`, `separator`, `anode` and `electrolyte`.
2. Create `src/models/<name>.js` that exports `build()` with the interface above. Copy `pouch.js` as a starting point.
3. Register it in `src/models/index.js`.
4. Run `npm test`. The data tests check ids, specs and curves, and confirm the model is registered.

---

## About the numbers

Specs are rounded, representative values for each class of cell, not one manufacturer's datasheet. Discharge curves show typical shapes. The 3D models are illustrative: real cells have many more layers, and layer thickness is exaggerated so you can see it.
