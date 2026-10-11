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

## Conventions
- Plain JS + React, R3F/drei for 3D, plain CSS with variables from `src/styles/theme.css`.
- All measurements are stored in **cm**; the scene uses 1 unit = 1 cm. Convert only for display
  (`src/units.js`).
- Only `src/data/storage.js` may touch localStorage or Supabase.
- Call `playSfx(name)` from `src/sfx.js` at key moments; never play audio elsewhere.
- Ask the owner before adding dependencies.
- `three` is pinned to 0.182.x: from r183 on, React Three Fiber 9 triggers a
  `THREE.Clock` deprecation warning in the console.
