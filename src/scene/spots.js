// Suggested spots: the glowing areas items lock into in Snap mode.
//
// Spots are worked out from where you sit, so they work on any desk shape:
// "front & center" is right in front of the chair, "back & center" is as far
// away as the desk goes, and so on. Every spot is sized for the item being
// placed, and items there face the chair.
//
// Which spots an item likes comes from its asset's `spots` list if it has
// one, otherwise from keywords in its id/name/category (monitor, keyboard...).

import { SEAT_DISTANCE, getDeskBounds, getSeat, getWings } from './deskGeometry.js'
import { ROTATION_STEP, makePlacementChecker, normalizeAngle } from './placement.js'

export const SPOT_LABELS = {
  'front-center': 'Front & center',
  'front-left': 'Front left',
  'front-right': 'Front right',
  'front-corner-left': 'Left side',
  'front-corner-right': 'Right side',
  'back-center': 'Back & center',
  'back-left': 'Back left',
  'back-right': 'Back right',
  'back-corner-left': 'Back left corner',
  'back-corner-right': 'Back right corner',
  return: 'Return',
  seat: 'At the desk',
  'under-desk': 'Under the desk',
  'beside-left': 'Beside the desk (left)',
  'beside-right': 'Beside the desk (right)',
  'under-left': 'Under the desk (left)',
  'under-right': 'Under the desk (right)',
}

// First match wins, so more specific words come first ("headphone" before "phone").
const SPOT_PREFERENCES = [
  { words: /monitor|display|screen/, spots: ['back-center', 'back-left', 'back-right', 'return'] },
  { words: /laptop/, spots: ['front-center', 'front-left', 'back-left', 'return'] },
  { words: /keyboard/, spots: ['front-center'] },
  { words: /mouse/, spots: ['front-right', 'front-left'] },
  { words: /\bmat\b|mousepad|desk pad/, spots: ['front-center'] },
  { words: /lamp|light/, spots: ['back-corner-left', 'back-corner-right'] },
  { words: /speaker/, spots: ['back-left', 'back-right'] },
  { words: /headphone|headset/, spots: ['front-corner-right', 'front-corner-left', 'back-corner-right'] },
  { words: /mug|cup|coffee|drink|bottle/, spots: ['front-corner-right', 'front-corner-left'] },
  { words: /plant|book|decor|figure|frame/, spots: ['back-corner-right', 'back-corner-left', 'return'] },
  { words: /phone|tablet/, spots: ['front-left', 'front-corner-left'] },
  { words: /webcam|camera|\bmic\b|microphone/, spots: ['back-center', 'back-left'] },
  { words: /chair|stool/, spots: ['seat'] },
  { words: /rug|carpet/, spots: ['under-desk'] },
  { words: /tower|\bpc\b|computer|case/, spots: ['beside-right', 'beside-left', 'under-right', 'under-left'] },
  { words: /bin|trash|basket|waste/, spots: ['beside-left', 'beside-right', 'under-left'] },
]

const DEFAULT_DESK_SPOTS = [
  'back-corner-right',
  'back-corner-left',
  'front-corner-right',
  'front-corner-left',
  'back-left',
  'back-right',
  'return',
  'front-center',
  'back-center',
]
const DEFAULT_FLOOR_SPOTS = ['beside-right', 'beside-left', 'under-right', 'under-left']

export function getPreferredSpots(asset) {
  if (Array.isArray(asset.spots)) return asset.spots
  const text = `${asset.id} ${asset.name} ${asset.category}`.toLowerCase()
  const match = SPOT_PREFERENCES.find((preference) => preference.words.test(text))
  if (match) return match.spots
  return asset.placement === 'floor' ? DEFAULT_FLOOR_SPOTS : DEFAULT_DESK_SPOTS
}

const snapAngle = (degrees) => normalizeAngle(Math.round(degrees / ROTATION_STEP) * ROTATION_STEP)
const degrees = (radians) => (radians * 180) / Math.PI

// Spots for one asset on this desk, in order of preference. Each spot is
// { id, label, position: { x, z }, rotation, free }. `free` is false when the
// item wouldn't fit there (something's in the way). `ignoreId` is the item
// being moved, so it doesn't block itself.
export function getSuggestedSpots(desk, items, asset, ignoreId = null) {
  const others = items.filter((item) => item.id !== ignoreId)
  const fits = makePlacementChecker(desk, others)
  const onDesk = makePlacementChecker(desk, []) // ignores other items
  const { width: w, depth: d } = asset.size

  // The person's frame of reference: forward (toward the desk) and right.
  const seat = getSeat(desk)
  const forward = { x: seat.dirX, z: seat.dirZ }
  const right = { x: -seat.dirZ, z: seat.dirX }
  // The point on the desk edge right in front of the chair.
  const edge = { x: seat.x + forward.x * SEAT_DISTANCE, z: seat.z + forward.z * SEAT_DISTANCE }
  const at = (r, f) => ({ x: edge.x + right.x * r + forward.x * f, z: edge.z + right.z * r + forward.z * f })

  // Desk items face the chair: their front (+z) points back along "forward".
  const facing = snapAngle(degrees(Math.atan2(-forward.x, -forward.z)))
  const candidate = (position, rotation = facing) => ({ id: ignoreId, assetId: asset.id, position, rotation })

  // From `start`, walk in direction `dir` as far as the item still fits on
  // the desk (2 cm steps). Returns null if it doesn't even fit at the start.
  const furthest = (start, dir, rotation = facing) => {
    if (!start || !onDesk(candidate(start, rotation))) return null
    let distance = 0
    const step = (n) => ({ x: start.x + dir.x * n, z: start.z + dir.z * n })
    while (distance < 400 && onDesk(candidate(step(distance + 2), rotation))) distance += 2
    return step(Math.max(0, distance - 1)) // back off a hair from the edge
  }

  // The return of an L-shaped desk (or the side wing of a corner desk). Items
  // there face sideways, toward the main desk, pushed against the outer edge,
  // the way you'd set up a second workspace you turn your chair toward.
  const sideWing = getWings(desk)[1]
  const wingOnRight = sideWing && sideWing.x0 + sideWing.x1 > 0
  const returnRotation = wingOnRight ? 270 : 90
  const returnSpot = () => {
    if (!sideWing) return null
    // Centered along the whole side column, from the back edge of the desk
    // to the front of the return.
    const middle = { x: (sideWing.x0 + sideWing.x1) / 2, z: (-desk.depth / 2 + sideWing.z1) / 2 }
    return furthest(middle, { x: wingOnRight ? 1 : -1, z: 0 }, returnRotation)
  }
  const minus = (v) => ({ x: -v.x, z: -v.z })

  const frontRow = 10 + d / 2 // keyboards usually sit ~10 cm from the edge
  const recipes = {
    'front-center': () => at(0, frontRow),
    'front-right': () => at(26 + w / 2, frontRow),
    'front-left': () => at(-(26 + w / 2), frontRow),
    'front-corner-right': () => furthest(at(0, frontRow), right),
    'front-corner-left': () => furthest(at(0, frontRow), minus(right)),
    'back-center': () => furthest(at(0, frontRow), forward),
    'back-left': () => furthest(at(-(38 + w / 2), frontRow), forward),
    'back-right': () => furthest(at(38 + w / 2, frontRow), forward),
    'back-corner-left': () => furthest(furthest(at(0, frontRow), forward), minus(right)),
    'back-corner-right': () => furthest(furthest(at(0, frontRow), forward), right),
    return: returnSpot,
  }

  // Floor spots
  const bounds = getDeskBounds(desk)
  const floorRecipes = {
    seat: () => ({ x: seat.x, z: seat.z }),
    'under-desk': () => at(0, -10),
    'beside-left': () => ({ x: bounds.minX - 6 - w / 2, z: 0 }),
    'beside-right': () => ({ x: bounds.maxX + 6 + w / 2, z: 0 }),
    // Under the main desk, at the back, clear of the legs.
    'under-left': () => ({ x: -desk.width / 2 + 18 + w / 2, z: -desk.depth / 2 + 8 + d / 2 }),
    'under-right': () => ({ x: desk.width / 2 - 18 - w / 2, z: -desk.depth / 2 + 8 + d / 2 }),
  }

  const spots = []
  for (const id of getPreferredSpots(asset)) {
    const recipe = asset.placement === 'floor' ? floorRecipes[id] : recipes[id]
    const position = recipe?.()
    if (!position) continue

    let rotation = facing
    if (id === 'seat') rotation = normalizeAngle(facing + 180) // a chair faces the desk
    if (id === 'return') rotation = returnRotation

    // Skip spots that land on top of an earlier one (happens on small desks).
    if (spots.some((s) => Math.hypot(s.position.x - position.x, s.position.z - position.z) < 5)) continue
    const fitsOnSurface = asset.placement === 'floor' || onDesk(candidate(position, rotation))
    if (!fitsOnSurface) continue

    spots.push({
      id,
      label: SPOT_LABELS[id] || id,
      position,
      rotation,
      free: fits(candidate(position, rotation)),
    })
  }
  return spots
}
