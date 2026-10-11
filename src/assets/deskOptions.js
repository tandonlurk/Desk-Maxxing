// Desk choices shown in the desk editor. All sizes are in centimeters.
import { CM_PER_INCH, clamp } from '../units.js'

const inches = (n) => n * CM_PER_INCH

export const DESK_SHAPES = [
  { id: 'rectangle', name: 'Rectangle' },
  { id: 'l-shape', name: 'L-shaped' },
  { id: 'corner', name: 'Corner' },
]

export const LEG_STYLES = [
  { id: 'four-leg', name: 'Four-leg' },
  { id: 'standing', name: 'Standing frame' },
  { id: 'trestle', name: 'Trestle' },
  { id: 'a-frame', name: 'A-frame' },
]

// Each material colors the desktop and the legs/frame.
export const DESK_MATERIALS = [
  { id: 'light-oak', name: 'Light oak', top: '#e6c08f', legs: '#2b2f4a' },
  { id: 'walnut', name: 'Walnut', top: '#7a4e2d', legs: '#1e2033' },
  { id: 'white', name: 'White', top: '#f8f8f3', legs: '#dcdcd6' },
  { id: 'black', name: 'Black', top: '#2c2d36', legs: '#17181e' },
  { id: 'bubblegum', name: 'Bubblegum', top: '#ff9cc9', legs: '#ffffff' },
  { id: 'mint', name: 'Mint', top: '#86e3bb', legs: '#ffffff' },
]

// A standing frame moves between these heights (about 24"–50").
export const STANDING_RANGE = { min: inches(24), max: inches(50) }

export const DEFAULT_DESK = {
  shape: 'rectangle',
  width: inches(60),
  depth: inches(30),
  height: inches(29),
  // Only used by L-shaped desks. Return length is measured from the back edge
  // of the main desk, so it includes the main desk's depth.
  returnLength: inches(48),
  returnDepth: inches(24),
  returnSide: 'right',
  material: 'light-oak',
  legStyle: 'four-leg',
}

export function getMaterial(id) {
  return DESK_MATERIALS.find((m) => m.id === id) || DESK_MATERIALS[0]
}

// Allowed range for each number field. Some limits depend on other fields
// (e.g. the return can't be deeper than the desk is wide).
export function getDeskLimits(desk) {
  const height =
    desk.legStyle === 'standing' ? STANDING_RANGE : { min: inches(18), max: inches(50) }
  return {
    width: { min: desk.shape === 'corner' ? desk.depth + 30 : 60, max: 300 },
    depth: { min: 40, max: 120 },
    height,
    returnLength: { min: desk.depth + 20, max: 300 },
    returnDepth: { min: 30, max: Math.min(120, desk.width - 20) },
  }
}

// Pull every number back into its allowed range.
export function normalizeDesk(desk) {
  const result = { ...desk }
  // Depth first, because other limits depend on it.
  for (const key of ['depth', 'width', 'height', 'returnLength', 'returnDepth']) {
    const { min, max } = getDeskLimits(result)[key]
    result[key] = clamp(result[key], min, max)
  }
  return result
}
