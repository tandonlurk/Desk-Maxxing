// Room choices shown in the room editor. All sizes are in centimeters.
//
// A room is a box with an open front (so the camera can see in):
//   { width, depth, height,
//     walls: { back, left, right },      which walls are there
//     paint: { back, left, right },      wall colors
//     floor: { style, color },
//     deskAt: { x, z, rotation } }       where the desk stands, in room coordinates
//
// Room coordinates: the room's center is (0, 0), the back wall is at
// z = -depth / 2, the left wall at x = -width / 2, the right at x = width / 2.
// The desk's own coordinates stay as they were (desk centered at 0, 0), so
// all the desk/item placement math is unchanged; the room is drawn around it.
import { clamp } from '../units.js'

export const WALLS = ['back', 'left', 'right']

export const WALL_NAMES = { back: 'Back wall', left: 'Left wall', right: 'Right wall' }

// 8 paint colors, for walls and floors.
export const PAINT_COLORS = [
  { name: 'Chalk', value: '#f4f1e8' },
  { name: 'Butter', value: '#ffd966' },
  { name: 'Coral', value: '#ff7b6b' },
  { name: 'Bubblegum', value: '#ff9cc9' },
  { name: 'Mint', value: '#7ee0b5' },
  { name: 'Sky', value: '#7cc6ff' },
  { name: 'Lavender', value: '#b7a3ff' },
  { name: 'Midnight', value: '#2b3150' },
]

export const FLOOR_STYLES = [
  { id: 'wood', name: 'Wood', pattern: 'wood' },
  { id: 'tile', name: 'Tile', pattern: 'tile' },
  { id: 'carpet', name: 'Carpet', pattern: 'carpet' },
]

// Floors also come in plain wood tones.
export const FLOOR_COLORS = [{ name: 'Oak', value: '#e2b97f' }, { name: 'Walnut', value: '#9a6a43' }, ...PAINT_COLORS]

export const DEFAULT_ROOM = {
  width: 360,
  depth: 360,
  height: 250,
  walls: { back: true, left: true, right: true },
  paint: { back: PAINT_COLORS[0].value, left: PAINT_COLORS[0].value, right: PAINT_COLORS[0].value },
  floor: { style: 'wood', color: FLOOR_COLORS[0].value },
  // null z = "against the back wall" (worked out once the desk is known).
  deskAt: { x: 0, z: null, rotation: 0 },
}

export function getRoomLimits() {
  return {
    width: { min: 150, max: 800 },
    depth: { min: 150, max: 800 },
    height: { min: 200, max: 400 },
  }
}

const isColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

// Fill in anything missing and pull numbers into range. Doesn't know about
// the desk; see clampDeskInRoom in scene/roomGeometry.js for that.
export function normalizeRoom(raw) {
  const room = { ...DEFAULT_ROOM, ...(raw || {}) }
  const limits = getRoomLimits()
  for (const key of ['width', 'depth', 'height']) {
    const value = Number.isFinite(room[key]) ? room[key] : DEFAULT_ROOM[key]
    room[key] = clamp(value, limits[key].min, limits[key].max)
  }
  room.walls = Object.fromEntries(WALLS.map((wall) => [wall, room.walls?.[wall] !== false]))
  room.paint = Object.fromEntries(
    WALLS.map((wall) => [wall, isColor(room.paint?.[wall]) ? room.paint[wall] : DEFAULT_ROOM.paint[wall]]),
  )
  room.floor = {
    style: FLOOR_STYLES.some((s) => s.id === room.floor?.style) ? room.floor.style : DEFAULT_ROOM.floor.style,
    color: isColor(room.floor?.color) ? room.floor.color : DEFAULT_ROOM.floor.color,
  }
  const at = room.deskAt || {}
  const rotation = [0, 90, 180, 270].includes(at.rotation) ? at.rotation : 0
  room.deskAt = {
    x: Number.isFinite(at.x) ? at.x : 0,
    z: Number.isFinite(at.z) ? at.z : null,
    rotation,
  }
  return room
}
