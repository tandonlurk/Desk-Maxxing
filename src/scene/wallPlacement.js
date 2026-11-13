// Placement rules for things mounted on walls (hooks, shelves, posters…).
// Pure math, no React.
//
// A wall item is { id, assetId, wall: 'back' | 'left' | 'right', u, y, color }:
//   u = where its center is along the wall (room coordinates: x for the back
//       wall, z for the side walls), y = height of its bottom off the floor.
// Its model's front (+z) faces into the room. Wall items stay put when the
// desk moves, like real posters would.
//
// A placement is valid when the wall exists, the item is fully on the wall
// (between the corners, between floor and ceiling), and it doesn't overlap
// another item on the same wall.

import { getAsset } from '../assets/library.js'
import { WALLS } from '../assets/roomOptions.js'
import { roomDirToDesk, roomToDesk, deskDirToRoom, deskToRoom } from './roomGeometry.js'

const TOLERANCE = 0.05

export function wallLength(room, wall) {
  return wall === 'back' ? room.width : room.depth
}

// Where a wall item's model goes, in room coordinates: { x, y, z } of its
// bottom center and its turn (degrees) so its front faces into the room.
export function wallItemPose(room, item) {
  const { depth } = getAsset(item.assetId).size
  const w = room.width / 2
  const d = room.depth / 2
  if (item.wall === 'left') return { x: -w + depth / 2, y: item.y, z: item.u, rotation: 90 }
  if (item.wall === 'right') return { x: w - depth / 2, y: item.y, z: item.u, rotation: 270 }
  return { x: item.u, y: item.y, z: -d + depth / 2, rotation: 0 }
}

// The rectangle an item covers on its wall: { u0, u1, y0, y1 }.
function wallRect(item) {
  const { width, height } = getAsset(item.assetId).size
  return { u0: item.u - width / 2, u1: item.u + width / 2, y0: item.y, y1: item.y + height }
}

// A window's rectangle, sill included (it sticks out a bit at the sides and below).
export const SILL = { overhang: 6, height: 4, depth: 10 }
export function windowRect(w) {
  return { u0: w.u - w.width / 2 - SILL.overhang, u1: w.u + w.width / 2 + SILL.overhang, y0: w.y - SILL.height, y1: w.y + w.height }
}

function rectsOverlap(a, b) {
  return a.u0 < b.u1 - TOLERANCE && b.u0 < a.u1 - TOLERANCE && a.y0 < b.y1 - TOLERANCE && b.y0 < a.y1 - TOLERANCE
}

// Only the wall itself (ignores other items).
export function isOnItsWall(room, item) {
  if (!WALLS.includes(item.wall) || !room.walls[item.wall]) return false
  const rect = wallRect(item)
  const half = wallLength(room, item.wall) / 2
  return rect.u0 >= -half - TOLERANCE && rect.u1 <= half + TOLERANCE && rect.y0 >= -TOLERANCE && rect.y1 <= room.height + TOLERANCE
}

// Returns a function that answers "would this wall item be OK here?".
// Windows count as obstacles too, so nothing hangs over the glass.
export function makeWallChecker(room, wallItems) {
  const obstacles = [
    ...wallItems.map((item) => ({ id: item.id, wall: item.wall, rect: wallRect(item) })),
    ...(room.windows || []).map((w) => ({ id: w.id, wall: w.wall, rect: windowRect(w) })),
  ]
  return function isValid(candidate) {
    if (!isOnItsWall(room, candidate)) return false
    const rect = wallRect(candidate)
    return !obstacles.some((other) => other.id !== candidate.id && other.wall === candidate.wall && rectsOverlap(rect, other.rect))
  }
}

// The closest free spot on the same wall, searching outward in rings 2 cm
// apart. Returns { u, y } or null.
export function findNearestFreeOnWall(isValid, item, maxDistance = 150) {
  if (isValid(item)) return { u: item.u, y: item.y }
  for (let radius = 2; radius <= maxDistance; radius += 2) {
    const steps = Math.max(8, Math.round((2 * Math.PI * radius) / 3))
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const spot = { u: item.u + Math.cos(angle) * radius, y: item.y + Math.sin(angle) * radius }
      if (isValid({ ...item, ...spot })) return spot
    }
  }
  return null
}

// Moving toward `to` ({ wall, u, y }): all the way if free, else slide along
// one axis, else stay. Switching walls only happens if the new spot (or a
// spot near it) is free.
export function slideOnWall(isValid, item, to) {
  const at = (spot) => ({ ...item, ...spot })
  if (isValid(at(to))) return to
  if (to.wall !== item.wall) {
    const near = findNearestFreeOnWall(isValid, at(to), 40)
    return near ? { wall: to.wall, ...near } : { wall: item.wall, u: item.u, y: item.y }
  }
  const slides = [
    { wall: item.wall, u: to.u, y: item.y },
    { wall: item.wall, u: item.u, y: to.y },
  ].filter((spot) => isValid(at(spot)))
  if (slides.length > 0) {
    const distance = (s) => Math.hypot(s.u - to.u, s.y - to.y)
    return slides.sort((a, b) => distance(a) - distance(b))[0]
  }
  return { wall: item.wall, u: item.u, y: item.y }
}

// Where a new wall item goes when it's clicked in the library: on the wall
// behind the desk, above the desk, or else the first wall with room.
export function findWallHome(room, desk, wallItems, assetId) {
  const asset = getAsset(assetId)
  const isValid = makeWallChecker(room, wallItems)
  const behind = { 0: 'back', 90: 'left', 270: 'right' }[room.deskAt.rotation]
  const deskCenter = deskToRoom(room, { x: 0, z: 0 })
  const walls = [behind, ...WALLS.filter((w) => w !== behind)].filter((w) => w && room.walls[w])
  // Small things (hooks) hang a bit lower; big things go above eye level.
  const y = Math.min(desk.height + (asset.size.height < 15 ? 35 : 55), room.height - asset.size.height - 5)
  for (const wall of walls) {
    const u = wall === 'back' ? deskCenter.x : deskCenter.z
    const start = { id: null, assetId, wall, u: wall === behind ? u : 0, y }
    const spot = findNearestFreeOnWall(isValid, start, 250)
    if (spot) return { wall, ...spot }
  }
  return null
}

// Where a ray (in desk coordinates, e.g. from the camera through the
// pointer) hits a wall from inside the room: { wall, u, y } or null. Walls
// seen from outside (the camera is behind them) are skipped, so you can
// reach the far walls through a faded one.
export function rayToWall(room, ray) {
  const origin = deskToRoom(room, { x: ray.origin.x, z: ray.origin.z })
  const flat = deskDirToRoom(room, { x: ray.direction.x, z: ray.direction.z })
  const o = { x: origin.x, y: ray.origin.y, z: origin.z }
  const dir = { x: flat.x, y: ray.direction.y, z: flat.z }
  const w = room.width / 2
  const d = room.depth / 2
  // Each wall: the plane it's on and its inward normal.
  const planes = {
    back: { axis: 'z', at: -d, normal: 1, along: 'x' },
    left: { axis: 'x', at: -w, normal: 1, along: 'z' },
    right: { axis: 'x', at: w, normal: -1, along: 'z' },
  }
  let best = null
  for (const wall of WALLS) {
    if (!room.walls[wall]) continue
    const plane = planes[wall]
    // Heading into the wall from the inside means moving against its inward normal.
    if (dir[plane.axis] * plane.normal >= 0) continue
    const t = (plane.at - o[plane.axis]) / dir[plane.axis]
    if (t <= 0) continue
    const u = o[plane.along] + dir[plane.along] * t
    const y = o.y + dir.y * t
    const half = wallLength(room, wall) / 2
    if (Math.abs(u) > half + 20 || y < -20 || y > room.height + 20) continue
    if (!best || t < best.t) best = { t, wall, u, y }
  }
  return best && { wall: best.wall, u: best.u, y: best.y }
}

// For moving things with the arrow keys: which way is "right" along a wall
// as seen from inside the room. (+u is +x on the back wall, +z on the sides.)
export function wallRightSign(wall) {
  return wall === 'left' ? -1 : 1
}

export function getMisplacedWallIds(room, wallItems) {
  return wallItems.filter((item) => !isOnItsWall(room, item)).map((item) => item.id)
}

// Wall items ready for the items layer: posed in desk coordinates like
// desk/floor items, with their height off the floor as `mountY`.
export function posedWallItems(room, wallItems) {
  return wallItems.map((item) => {
    const pose = wallItemPoseInDesk(room, item)
    return { ...item, position: { x: pose.x, z: pose.z }, rotation: pose.rotation, mountY: pose.y }
  })
}

// A wall item's pose in desk coordinates (for the scene, which is drawn in
// desk coordinates).
export function wallItemPoseInDesk(room, item) {
  const pose = wallItemPose(room, item)
  const p = roomToDesk(room, pose)
  const facing = roomDirToDesk(room, { x: Math.sin((pose.rotation * Math.PI) / 180), z: Math.cos((pose.rotation * Math.PI) / 180) })
  return { x: p.x, y: pose.y, z: p.z, rotation: (Math.atan2(facing.x, facing.z) * 180) / Math.PI }
}

// A spot for a new window: on the wall behind the desk first, then the
// others, clear of the windows already there. Returns { wall, u } or null.
export function findWindowSpot(room, width, height, y) {
  const behind = { 0: 'back', 90: 'left', 270: 'right' }[room.deskAt.rotation]
  const walls = [behind, ...WALLS.filter((w) => w !== behind)].filter((w) => w && room.walls[w])
  for (const wall of walls) {
    const half = wallLength(room, wall) / 2 - width / 2 - SILL.overhang
    if (half < 0) continue
    const others = (room.windows || []).filter((w) => w.wall === wall).map(windowRect)
    // Try the middle, then step outward both ways.
    for (let step = 0; step <= half; step += 5) {
      for (const u of step === 0 ? [0] : [step, -step]) {
        const rect = windowRect({ u, y, width, height })
        if (!others.some((o) => rectsOverlap(rect, o))) return { wall, u }
      }
    }
  }
  return null
}
