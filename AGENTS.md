# No It HAS To Go There (Desk-Maxxing): notes for coding agents

The full product spec lives with the owner. It's built in phases, and each phase is
committed separately.

## Run it
- `npm install`, then `npm run dev` (dev server) or `npm start` (production build plus
  preview). Both use **port 5173 only**, because GitHub OAuth redirects there.
- This repo lives in iCloud Drive (`~/Documents`). macOS may evict files (`ls -lO` shows
  `dataless`), and then `vite build`, `wc`, etc. hang for minutes while each file downloads on read.
  If a command stalls with ~0 CPU, check `find node_modules src public -flags +dataless | wc -l`
  and materialize in parallel: `find node_modules src public -flags +dataless -type f -print0 | xargs -0 -P 96 -n 20 cat > /dev/null`.
- `npm run check-secrets` must pass before every commit. The `.githooks/pre-commit` hook
  runs it, and `npm install` enables the hook.

## Verify end-to-end
- Open http://localhost:5173 in a browser, exercise the changed feature, and check the
  console for errors **and warnings** from the app (ignore extension noise).
- Room: change room size, toggle walls, put the desk against each wall and slide it, paint every
  wall/floor (swatches and the paint bucket), then click Room / Front / Top / Side / Seated.
- Planner: change size, shape (rectangle / L / corner), material, and legs (incl. the
  standing slider).
- Items: click and drag cards from the Items tab in both Snap and Free modes; check spots glow
  and lock in (Snap), distance guides and arrow nudges (Free), R / Delete / Cmd+D / Cmd+Z, and
  shrinking the desk (items get nudged back on or flagged red).
- Wall items (Items → Wall): click to add (they go behind the desk), drag them across walls with
  real mouse input, arrow-key nudge (up/down = height), and edit "From wall's left end / Off the floor".
- Big floor items (bed, bookshelf) must find room anywhere in the room.
- R3F ignores synthetic pointer events dispatched from scripts, so test scene clicks/drags with
  real mouse input. Library-card drags use window listeners and do work with synthetic events.
- Board / 1v1 / publishing: publish from the planner (thumbnail, title, tags), find it on /board,
  filter by tags, vote in 1v1 (←/→), open /s/:id, Remix it (Undo restores your desk), delete it.
  These need Supabase configured (`supabase/README.md`); without it the board says it isn't connected.
- Challenge rooms (needs Supabase with anonymous sign-ins on): in one browser, Join as a guest, build a
  base, hit Challenge, add wishlist items, copy the link. In an incognito window open the link, pick a
  name, Design: base items can't be grabbed, the wishlist ticks off, Submit entry. Back as the creator:
  the entry shows on /r/:code, tack it from the other window (your own is refused), Crown it, and check
  /board → Top this week and /rooms.
- While another session is using port 5173, test with `npx vite --port 5174`.
- Browser automation tabs can be hidden, which pauses requestAnimationFrame: the 3D view then looks
  blank or frozen and thumbnails hang. Take a screenshot first (it makes the tab visible) before
  concluding the scene is broken.

## Conventions
- Plain JS + React, R3F/drei for 3D, plain CSS with variables from `src/styles/theme.css`.
- All measurements are stored in **cm**; the scene uses 1 unit = 1 cm. Convert only for display
  (`src/units.js`).
- A setup is `{ room, desk, items, wallItems }` (see `src/assets/setupShape.js`). Desk/floor items are in
  desk coordinates (desk centered at 0,0); the room is drawn around the desk (`scene/roomGeometry.js`).
  Wall items are `{ wall, u, y }` in room coordinates (`scene/wallPlacement.js`).
- Only `src/data/storage.js` may touch localStorage or Supabase. The schema lives in
  `supabase/migrations/` (add new files; don't edit applied ones). Points/wins/losses only change
  through the `cast_vote` database function, and tacks only through `toggle_tack`, never from the client.
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
