# Desk Maxxing: notes for coding agents

The full product spec lives with the owner. It's built in phases, and each phase is
committed separately.

## Run it
- `npm install`, then `npm run dev` (dev server) or `npm start` (production build plus
  preview). Both use **port 5173 only**, because GitHub OAuth redirects there.
- `npm run check-secrets` must pass before every commit. The `.githooks/pre-commit` hook
  runs it, and `npm install` enables the hook.

## Verify end-to-end
- Open http://localhost:5173 in a browser, exercise the changed feature, and check the
  console for errors **and warnings** from the app (ignore extension noise).
- Planner: change size, shape (rectangle / L / corner), material, and legs (incl. the
  standing slider), then click the Front / Top / Side / Seated views.
- Items: click and drag cards from the Items tab in both Snap and Free modes; check spots glow
  and lock in (Snap), distance guides and arrow nudges (Free), R / Delete / Cmd+D / Cmd+Z, and
  shrinking the desk (items get nudged back on or flagged red).
- R3F ignores synthetic pointer events dispatched from scripts, so test scene clicks/drags with
  real mouse input. Library-card drags use window listeners and do work with synthetic events.
- Board / 1v1 / publishing: publish from the planner (thumbnail, title, tags), find it on /board,
  filter by tags, vote in 1v1 (←/→), open /s/:id, Remix it (Undo restores your desk), delete it.
  These need Supabase configured (`supabase/README.md`); without it the board says it isn't connected.
- While another session is using port 5173, test with `npx vite --port 5174`.
- Browser automation tabs can be hidden, which pauses requestAnimationFrame: the 3D view then looks
  blank or frozen and thumbnails hang. Take a screenshot first (it makes the tab visible) before
  concluding the scene is broken.

## Conventions
- Plain JS + React, R3F/drei for 3D, plain CSS with variables from `src/styles/theme.css`.
- All measurements are stored in **cm**; the scene uses 1 unit = 1 cm. Convert only for display
  (`src/units.js`).
- Only `src/data/storage.js` may touch localStorage or Supabase. The schema lives in
  `supabase/migrations/` (add new files; don't edit applied ones). Points/wins/losses only change
  through the `cast_vote` database function, never from the client.
- Call `playSfx(name)` from `src/sfx.js` at key moments; never play audio elsewhere.
- Ask the owner before adding dependencies.
- `three` is pinned to 0.182.x: from r183 on, React Three Fiber 9 triggers a
  `THREE.Clock` deprecation warning in the console.

## Item library contract (for whoever builds `src/assets/registry.js`)
The placement code never imports `registry.js` directly; it goes through
`src/assets/library.js`, which picks up `registry.js` automatically once it exists
(until then, `src/assets/placeholderItems.js` stands in, and that file can then be deleted).

- Export the list as `export const ASSETS = [...]` (`assets`, `REGISTRY`, `registry`, or a default
  export also work, as an array or an `{ id: asset }` object).
- Each asset follows the spec: `id`, `name`, `category`, `placement` (`'desk' | 'floor'`),
  `size: { width, depth, height }` in **cm** (an array `[w, d, h]` also works),
  `colorOptions` (`'#hex'` strings or `{ name, value }`), `price: null`, `buyLinks: []`, `vendor: null`.
- Optional `Model`: a React component rendered as `<Model color size asset />`. Draw it
  **centered on x/z, sitting on y = 0, front facing +z** (toward the person at the desk; for a chair,
  +z is the side your knees come out of), real size in cm. Without `Model`, a placeholder block is drawn.
- Optional `flat: true` for things other items can sit on (mats, rugs). Defaults to `height <= 1.5`.
- Optional `spots: [...]`: Snap-mode spot ids in order of preference (see `SPOT_LABELS` in
  `src/scene/spots.js`). Without it, spots are guessed from words in the id/name/category
  (monitor, keyboard, mouse, lamp, mug, plant, chair, rug, tower, bin…).

## Item models
- `src/assets/registry.js` builds the library from `src/assets/deskObjects.json` (a copy of
  `../local-assets/desk-objects.json` plus each model's `baseColor`) and the GLBs in `public/models/`.
- After regenerating models in `../local-assets/`, run `npm run sync-assets` to copy them in.
- `src/scene/GlbItem.jsx` draws them; the color picker repaints the parts that are in `baseColor`.
