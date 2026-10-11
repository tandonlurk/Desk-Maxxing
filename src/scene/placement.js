// Placement rules: where an item is allowed to be. Pure math, no React.
//
// Items live on a surface (the desktop or the floor) and are described by
//   { id, assetId, position: { x, z }, rotation (degrees around the vertical axis), color }
// Their height comes from the surface, so it's not stored. Everything is in cm.
//
// An item's "footprint" is the rectangle it covers, seen from above. A
// placement is valid when:
//   - a desk item's footprint is completely on the desktop, or a floor item's
//     footprint is on the floor,
//   - a floor item too tall to fit under the desk isn't under the desk, and
//   - it doesn't overlap another item on the same surface. Flat items (mats,
//     rugs) never block anything, so a keyboard can sit on a desk mat.

import { getAsset } from '../assets/library.js'
import { TOP_THICKNESS, getDeskBounds, getDeskOutline } from './deskGeometry.js'

// Floor items stay on the 520 cm floor tile (with a little margin).
export const FLOOR_HALF_SIZE = 255

// Snapping rotation to 15° steps.
export const ROTATION_STEP = 15

// Touching edges count as fine, not as overlapping.
const TOLERANCE = 0.05

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

// Keep an angle between 0 and 360.
export function normalizeAngle(degrees) {
  return ((degrees % 360) + 360) % 360
}

export function surfaceHeight(desk, asset) {
  return asset.placement === 'floor' ? 0 : desk.height
}

// The 4 corners [x, z] of a w × d rectangle centered at (x, z), turned by
// `rotation` degrees the same way three.js turns objects around the y axis.
export function rectangleCorners(x, z, width, depth, rotation) {
  const angle = toRadians(rotation)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const local = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ]
  return local.map(([lx, lz]) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos])
}

export function getFootprint(item) {
  const { width, depth } = getAsset(item.assetId).size
  return rectangleCorners(item.position.x, item.position.z, width, depth, item.rotation)
}

// The smallest axis-aligned box around some corners.
export function boundingBox(corners) {
  const xs = corners.map((c) => c[0])
  const zs = corners.map((c) => c[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

// Classic "ray casting" test: count how many outline edges a line going right
// from the point crosses. Odd = inside.
function pointInPolygon(x, z, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]
    const [xj, zj] = polygon[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

// Is the point strictly inside a (convex) footprint? It is if it's on the
// same side of all 4 edges.
function pointInFootprint(x, z, corners) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = corners[i]
    const [x2, z2] = corners[(i + 1) % 4]
    const length = Math.hypot(x2 - x1, z2 - z1)
    const cross = ((x2 - x1) * (z - z1) - (z2 - z1) * (x - x1)) / length // signed distance to the edge
    if (Math.abs(cross) < TOLERANCE) return false // on the edge counts as outside
    const side = Math.sign(cross)
    if (sign === 0) sign = side
    else if (side !== sign) return false
  }
  return true
}

// A footprint is on the desk if all its corners are inside the desk outline
// and no corner of the outline pokes into it. (The second check catches an
// item bridging the notch of an L-shaped desk.)
function footprintOnDesk(corners, outline) {
  const shrunk = shrinkTowardCenter(corners, TOLERANCE)
  if (!shrunk.every(([x, z]) => pointInPolygon(x, z, outline))) return false
  return !outline.some(([x, z]) => pointInFootprint(x, z, corners))
}

function shrinkTowardCenter(corners, amount) {
  const cx = corners.reduce((sum, c) => sum + c[0], 0) / corners.length
  const cz = corners.reduce((sum, c) => sum + c[1], 0) / corners.length
  return corners.map(([x, z]) => {
    const length = Math.hypot(cx - x, cz - z) || 1
    return [x + ((cx - x) / length) * amount, z + ((cz - z) / length) * amount]
  })
}

function footprintOnFloor(corners) {
  return corners.every(([x, z]) => Math.abs(x) <= FLOOR_HALF_SIZE && Math.abs(z) <= FLOOR_HALF_SIZE)
}

// Does a footprint overlap the desk's outline at all (seen from above)?
// It does if a corner of one is inside the other, or any of their edges cross.
function footprintUnderDesk(corners, outline) {
  const shrunk = shrinkTowardCenter(corners, TOLERANCE)
  if (shrunk.some(([x, z]) => pointInPolygon(x, z, outline))) return true
  if (outline.some(([x, z]) => pointInFootprint(x, z, corners))) return true
  for (let i = 0; i < 4; i++) {
    const a = shrunk[i]
    const b = shrunk[(i + 1) % 4]
    for (let j = 0; j < outline.length; j++) {
      if (segmentsCross(a, b, outline[j], outline[(j + 1) % outline.length])) return true
    }
  }
  return false
}

// Do segments p1–p2 and p3–p4 cross each other?
function segmentsCross(p1, p2, p3, p4) {
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  return side(p1, p2, p3) !== side(p1, p2, p4) && side(p3, p4, p1) !== side(p3, p4, p2)
}

// Floor items taller than the gap under the desktop can't go under the desk.
function tooTallForUnderDesk(desk, asset) {
  return asset.size.height > desk.height - TOP_THICKNESS
}

// Is the item on the right surface, ignoring other items?
function onItsSurface(desk, outline, asset, corners) {
  if (asset.placement === 'floor') {
    if (!footprintOnFloor(corners)) return false
    return !(tooTallForUnderDesk(desk, asset) && footprintUnderDesk(corners, outline))
  }
  return footprintOnDesk(corners, outline)
}

// Separating axis test: two rectangles overlap unless some edge direction
// separates them. Edges that only touch don't count.
function footprintsOverlap(a, b) {
  for (const shape of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = shape[i]
      const [x2, z2] = shape[(i + 1) % 4]
      const length = Math.hypot(x2 - x1, z2 - z1)
      const nx = (z2 - z1) / length
      const nz = (x1 - x2) / length
      const [aMin, aMax] = project(a, nx, nz)
      const [bMin, bMax] = project(b, nx, nz)
      if (aMax <= bMin + TOLERANCE || bMax <= aMin + TOLERANCE) return false
    }
  }
  return true
}

function project(corners, nx, nz) {
  const values = corners.map(([x, z]) => x * nx + z * nz)
  return [Math.min(...values), Math.max(...values)]
}

// Returns a function that answers "would this item be OK here?" for the given
// desk and items. Building it once and reusing it keeps searches fast.
export function makePlacementChecker(desk, items) {
  const outline = getDeskOutline(desk)
  const obstacles = items.map((item) => {
    const asset = getAsset(item.assetId)
    return { id: item.id, placement: asset.placement, flat: asset.flat, corners: getFootprint(item) }
  })

  return function isValid(candidate) {
    const asset = getAsset(candidate.assetId)
    const corners = getFootprint(candidate)

    if (!onItsSurface(desk, outline, asset, corners)) return false
    if (asset.flat) return true

    return !obstacles.some(
      (other) =>
        other.id !== candidate.id &&
        !other.flat &&
        other.placement === asset.placement &&
        footprintsOverlap(corners, other.corners),
    )
  }
}

// Only checks the surface (ignores other items). Used to flag items that
// don't fit anymore after the desk was resized.
export function isOnItsSurface(desk, item) {
  return onItsSurface(desk, getDeskOutline(desk), getAsset(item.assetId), getFootprint(item))
}

// Moving from `from` toward `to`: go all the way if that spot is free;
// otherwise slide along just one axis (so items glide along desk edges and
// other items instead of sticking); otherwise get as close as possible.
export function slideToward(isValid, item, to) {
  const at = (position) => ({ ...item, position })
  const from = item.position

  if (isValid(at(to))) return to

  const slides = [
    { x: to.x, z: from.z },
    { x: from.x, z: to.z },
  ].filter((position) => isValid(at(position)))
  if (slides.length > 0) {
    const distance = (p) => Math.hypot(p.x - to.x, p.z - to.z)
    return slides.sort((a, b) => distance(a) - distance(b))[0]
  }

  // Binary search for the furthest free point on the straight line.
  if (!isValid(at(from))) return from
  let lo = 0
  let hi = 1
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2
    const position = { x: from.x + (to.x - from.x) * mid, z: from.z + (to.z - from.z) * mid }
    if (isValid(at(position))) lo = mid
    else hi = mid
  }
  return { x: from.x + (to.x - from.x) * lo, z: from.z + (to.z - from.z) * lo }
}

// The closest free position to the item's current one, searching outward in
// rings 2 cm apart. Returns null if nothing is free within maxDistance.
export function findNearestFree(isValid, item, maxDistance = 150) {
  if (isValid(item)) return item.position
  const { x, z } = item.position
  for (let radius = 2; radius <= maxDistance; radius += 2) {
    const steps = Math.max(8, Math.round((2 * Math.PI * radius) / 3))
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const position = { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius }
      if (isValid({ ...item, position })) return position
    }
  }
  return null
}

// After the desk changes size, shape, or height, nudge any item that no
// longer fits (fell off the desk, or the desk now covers a tall floor item)
// to the nearest free spot. Items with no free spot nearby are left where
// they are (and get flagged by getMisplacedIds).
export function fitItemsToDesk(desk, items) {
  let result = items
  for (const item of items) {
    const isValid = makePlacementChecker(desk, result)
    if (isValid(item)) continue
    const position = findNearestFree(isValid, item, 80)
    if (position) result = result.map((other) => (other.id === item.id ? { ...other, position } : other))
  }
  return result
}

export function getMisplacedIds(desk, items) {
  return items.filter((item) => !isOnItsSurface(desk, item)).map((item) => item.id)
}

// How far an item's sides are from the desk edges (cm), measured straight
// left, right, back, and front from the middle of each side.
export function distancesToDeskEdges(desk, item) {
  const outline = getDeskOutline(desk)
  const box = boundingBox(getFootprint(item))
  const midX = (box.minX + box.maxX) / 2
  const midZ = (box.minZ + box.maxZ) / 2
  return {
    left: { from: [box.minX, midZ], distance: rayToOutline(box.minX, midZ, -1, 0, outline), axis: 'x', sign: -1 },
    right: { from: [box.maxX, midZ], distance: rayToOutline(box.maxX, midZ, 1, 0, outline), axis: 'x', sign: 1 },
    back: { from: [midX, box.minZ], distance: rayToOutline(midX, box.minZ, 0, -1, outline), axis: 'z', sign: -1 },
    front: { from: [midX, box.maxZ], distance: rayToOutline(midX, box.maxZ, 0, 1, outline), axis: 'z', sign: 1 },
  }
}

// Distance from (px, pz) along direction (dx, dz) to the nearest outline edge.
function rayToOutline(px, pz, dx, dz, outline) {
  let best = Infinity
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i]
    const [bx, bz] = outline[(i + 1) % outline.length]
    const ex = bx - ax
    const ez = bz - az
    const denominator = dx * ez - dz * ex
    if (Math.abs(denominator) < 1e-9) continue // parallel
    const t = ((ax - px) * ez - (az - pz) * ex) / denominator // distance along the ray
    const s = ((ax - px) * dz - (az - pz) * dx) / denominator // position along the edge (0–1)
    if (t >= -0.01 && s >= 0 && s <= 1) best = Math.min(best, Math.max(0, t))
  }
  return best
}

// Distance from the desk's left and back edges to the item's left and back
// sides, used by the precise position boxes.
export function getEdgeOffsets(desk, item) {
  const bounds = getDeskBounds(desk)
  const box = boundingBox(getFootprint(item))
  return { fromLeft: box.minX - bounds.minX, fromBack: box.minZ - bounds.minZ }
}

// Round a position to a grid (used by Snap mode).
export function snapToGrid(position, gridSize) {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    z: Math.round(position.z / gridSize) * gridSize,
  }
}
