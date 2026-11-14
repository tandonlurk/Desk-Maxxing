// Converting between desk coordinates (what items and the desk use; the desk
// is centered at 0, 0) and room coordinates (the room is centered at 0, 0).
// Pure math, no React. See src/assets/roomOptions.js for the room's shape.
import { getDeskBounds } from './deskGeometry.js'

const toRadians = (degrees) => (degrees * Math.PI) / 180

// Turn (x, z) by `degrees` around the vertical axis, the same way three.js
// turns objects (rotation.y).
function turn({ x, z }, degrees) {
  const angle = toRadians(degrees)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: x * cos + z * sin, z: -x * sin + z * cos }
}

export function deskToRoom(room, point) {
  const turned = turn(point, room.deskAt.rotation)
  return { x: turned.x + room.deskAt.x, z: turned.z + (room.deskAt.z ?? 0) }
}

export function roomToDesk(room, point) {
  return turn({ x: point.x - room.deskAt.x, z: point.z - (room.deskAt.z ?? 0) }, -room.deskAt.rotation)
}

// A direction (no position) from room to desk coordinates.
export function roomDirToDesk(room, dir) {
  return turn(dir, -room.deskAt.rotation)
}

export function deskDirToRoom(room, dir) {
  return turn(dir, room.deskAt.rotation)
}

// The box the desk takes up on the room's floor plan (room coordinates).
export function deskBoxInRoom(room, desk) {
  const b = getDeskBounds(desk)
  const corners = [
    { x: b.minX, z: b.minZ },
    { x: b.maxX, z: b.minZ },
    { x: b.maxX, z: b.maxZ },
    { x: b.minX, z: b.maxZ },
  ].map((corner) => deskToRoom(room, corner))
  const xs = corners.map((c) => c.x)
  const zs = corners.map((c) => c.z)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

// Which wall the desk's back faces: rotation 0 → back, 90 → left, 270 → right.
export function deskWall(room) {
  return { 0: 'back', 90: 'left', 270: 'right' }[room.deskAt.rotation] || null
}

// Slide the desk (keeping its turn) so it's inside the room. A missing z
// means "against the wall behind it".
export function clampDeskInRoom(room, desk) {
  let at = { ...room.deskAt }
  if (at.z === null) at = pushAgainstWall({ ...room, deskAt: { ...at, z: 0 } }, desk)
  const placed = { ...room, deskAt: at }
  const box = deskBoxInRoom(placed, desk)
  const shift = (min, max, half) => {
    if (max - min >= 2 * half) return -(min + max) / 2 // too big: center it
    if (min < -half) return -half - min
    if (max > half) return half - max
    return 0
  }
  at.x += shift(box.minX, box.maxX, room.width / 2)
  at.z += shift(box.minZ, box.maxZ, room.depth / 2)
  return { ...room, deskAt: at }
}

// The deskAt that puts the desk's back flat against the wall behind it.
function pushAgainstWall(room, desk) {
  const box = deskBoxInRoom(room, desk)
  const at = { ...room.deskAt }
  const wall = deskWall(room)
  if (wall === 'back') at.z += -room.depth / 2 - box.minZ
  if (wall === 'left') at.x += -room.width / 2 - box.minX
  if (wall === 'right') at.x += room.width / 2 - box.maxX
  if (room.deskAt.rotation === 180) at.z += room.depth / 2 - box.maxZ
  return at
}

// Turn the desk to face away from `wall` and push it against it, keeping
// its place along the wall where possible.
export function placeDeskAgainst(room, desk, wall) {
  const rotation = { back: 0, left: 90, right: 270 }[wall]
  const turned = { ...room, deskAt: { ...room.deskAt, rotation } }
  return clampDeskInRoom({ ...turned, deskAt: pushAgainstWall(turned, desk) }, desk)
}

// Slide the desk along the wall it's against (`offset` = where the middle of
// the desk's floor-plan box goes along that wall, in room coordinates).
export function slideDesk(room, desk, offset) {
  const wall = deskWall(room)
  const box = deskBoxInRoom(room, desk)
  const at = { ...room.deskAt }
  if (wall === 'left' || wall === 'right') at.z += offset - (box.minZ + box.maxZ) / 2
  else at.x += offset - (box.minX + box.maxX) / 2
  return clampDeskInRoom({ ...room, deskAt: at }, desk)
}

// The room's floor corners in desk coordinates (used to keep floor items
// inside the room).
export function floorPolygonInDesk(room) {
  const w = room.width / 2
  const d = room.depth / 2
  return [
    { x: -w, z: -d },
    { x: w, z: -d },
    { x: w, z: d },
    { x: -w, z: d },
  ].map((corner) => {
    const p = roomToDesk(room, corner)
    return [p.x, p.z]
  })
}

// How far the desk's back is from the wall behind it, and the most it can
// be (the desk touching the open front / the opposite wall).
export function deskGap(room, desk) {
  const box = deskBoxInRoom(room, desk)
  const wall = deskWall(room)
  if (wall === 'left') return { gap: box.minX + room.width / 2, max: room.width - (box.maxX - box.minX) }
  if (wall === 'right') return { gap: room.width / 2 - box.maxX, max: room.width - (box.maxX - box.minX) }
  return { gap: box.minZ + room.depth / 2, max: room.depth - (box.maxZ - box.minZ) }
}

// Pull the desk out from the wall behind it so its back is `gap` cm away.
export function setDeskGap(room, desk, gap) {
  const wall = deskWall(room)
  const delta = gap - deskGap(room, desk).gap
  const at = { ...room.deskAt }
  if (wall === 'left') at.x += delta
  else if (wall === 'right') at.x -= delta
  else at.z += delta
  return clampDeskInRoom({ ...room, deskAt: at }, desk)
}
