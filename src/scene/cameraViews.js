// Where the camera goes for each preset view. Pure math, no React.
import { getDeskBounds, getSeat } from './deskGeometry.js'
import { deskBoxInRoom, deskToRoom, roomToDesk } from './roomGeometry.js'
import { getFootprint } from './placement.js'
import { getAsset } from '../assets/library.js'

export const VIEW_PRESETS = [
  { id: 'room', name: 'Room' },
  { id: 'front', name: 'Front' },
  { id: 'top', name: 'Top' },
  { id: 'side', name: 'Side' },
  { id: 'seated', name: 'Seated' },
]

// Vertical field of view in degrees. The seated view is wider, closer to
// what your eyes take in when you sit at a desk.
export const DEFAULT_FOV = 45
const SEATED_FOV = 65

const FOCUS_MARGIN = 45

// The floor area to show in the room view, in room coordinates: the desk plus
// floor items, padded a little and kept inside the walls.
function contentBox(room, desk, items) {
  const desked = deskBoxInRoom(room, desk)
  let { minX, maxX, minZ, maxZ } = desked
  for (const item of items) {
    if (getAsset(item.assetId)?.placement !== 'floor') continue
    for (const [x, z] of getFootprint(item)) {
      const p = deskToRoom(room, { x, z })
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z)
      maxZ = Math.max(maxZ, p.z)
    }
  }
  return {
    minX: Math.max(minX - FOCUS_MARGIN, -room.width / 2),
    maxX: Math.min(maxX + FOCUS_MARGIN, room.width / 2),
    minZ: Math.max(minZ - FOCUS_MARGIN, -room.depth / 2),
    maxZ: Math.min(maxZ + FOCUS_MARGIN, room.depth / 2),
  }
}

// Returns { position: [x,y,z], target: [x,y,z], fov } for a view.
// aspect is the canvas width / height. `room` is only needed for the room view.
export function getCameraView(name, desk, aspect, room = null, items = []) {
  const fov = name === 'seated' ? SEATED_FOV : DEFAULT_FOV
  const b = getDeskBounds(desk)
  const H = desk.height
  const centerX = (b.minX + b.maxX) / 2
  const centerZ = (b.minZ + b.maxZ) / 2
  const halfWidth = (b.maxX - b.minX) / 2
  const halfDepth = (b.maxZ - b.minZ) / 2

  // How far back the camera must stand so something of this half-width and
  // half-height fits on screen (with a little breathing room).
  const vHalf = (fov * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  const fit = (halfW, halfH) => 1.25 * Math.max(halfW / Math.tan(hHalf), halfH / Math.tan(vHalf))

  if (name === 'room' && room) {
    // The desk is the star: frame it plus any big floor items (bed, fridge...)
    // with a margin of floor and wall around it, instead of the whole room.
    // With nothing big in the room this zooms right in on the desk.
    const box = contentBox(room, desk, items)
    const cx = (box.minX + box.maxX) / 2
    const cz = (box.minZ + box.maxZ) / 2
    const halfW = Math.max((box.maxX - box.minX) / 2, (box.maxZ - box.minZ) / 2 * 0.8)
    const wallH = Math.min(room.height, 200)
    const distance = fit(halfW + 30, wallH / 2 + 30)
    const at = (x, z) => roomToDesk(room, { x, z })
    const eye = at(cx + halfW * 0.35, box.maxZ + distance * 0.72)
    const look = at(cx, cz)
    return { position: [eye.x, wallH * 0.5 + distance * 0.62, eye.z], target: [look.x, H * 0.8, look.z], fov }
  }

  if (name === 'front') {
    const distance = fit(halfWidth + 20, H / 2 + 30)
    return { position: [centerX, H + 40, b.maxZ + distance], target: [centerX, H * 0.6, centerZ], fov }
  }

  if (name === 'side') {
    const distance = fit(halfDepth + 20, H / 2 + 30)
    return { position: [b.maxX + distance, H + 40, centerZ], target: [centerX, H * 0.6, centerZ], fov }
  }

  if (name === 'top') {
    const distance = fit(halfWidth + 20, halfDepth + 20)
    // The tiny z offset keeps "up" on screen pointing at the back of the desk.
    return { position: [centerX, H + distance, centerZ + 0.01], target: [centerX, H, centerZ], fov }
  }

  if (name === 'seated') {
    // Eyes where a seated person's would be, looking at the desk slightly
    // downward, toward where a monitor usually sits.
    const seat = getSeat(desk)
    return {
      position: [seat.x, seat.eyeHeight, seat.z],
      target: [seat.x + seat.dirX * 100, H + 20, seat.z + seat.dirZ * 100],
      fov,
    }
  }

  // Default: a three-quarter view from the front right.
  const distance = fit(Math.max(halfWidth, halfDepth) + 30, H / 2 + 40)
  return {
    position: [centerX + distance * 0.55, H * 0.6 + distance * 0.5, centerZ + distance * 0.75],
    target: [centerX, H * 0.6, centerZ],
    fov,
  }
}
