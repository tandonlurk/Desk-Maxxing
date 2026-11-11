// The shape of a setup, the thing the planner edits, drafts save, and the
// board publishes:
//   { room, desk, items, wallItems }
// items:     [{ id, assetId, position: { x, z }, rotation, color }]   (desk coordinates)
// wallItems: [{ id, assetId, wall, u, y, color }]                     (see scene/wallPlacement.js)
import { DEFAULT_DESK, normalizeDesk } from './deskOptions.js'
import { WALLS, normalizeRoom } from './roomOptions.js'
import { clampDeskInRoom } from '../scene/roomGeometry.js'

const isText = (value) => typeof value === 'string' && value.length > 0

// A setup from somewhere we don't control (an old draft, the database): fill
// in anything missing and drop anything that isn't a valid item. Setups
// saved before rooms existed get the default room, with the desk against
// the back wall.
export function normalizeSetup(raw) {
  const desk = normalizeDesk({ ...DEFAULT_DESK, ...(raw?.desk || {}) })
  const room = clampDeskInRoom(normalizeRoom(raw?.room), desk)
  const items = (Array.isArray(raw?.items) ? raw.items : []).filter(
    (item) =>
      item &&
      isText(item.id) &&
      isText(item.assetId) &&
      Number.isFinite(item.position?.x) &&
      Number.isFinite(item.position?.z),
  )
  const wallItems = (Array.isArray(raw?.wallItems) ? raw.wallItems : []).filter(
    (item) =>
      item &&
      isText(item.id) &&
      isText(item.assetId) &&
      WALLS.includes(item.wall) &&
      Number.isFinite(item.u) &&
      Number.isFinite(item.y),
  )
  return { room, desk, items, wallItems }
}

export const DEFAULT_SETUP = normalizeSetup(null)

// Every placed thing in a setup (desk/floor items and wall items).
export function allItems(setup) {
  return [...setup.items, ...setup.wallItems]
}
