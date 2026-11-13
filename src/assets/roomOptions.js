// Room choices shown in the room editor. All sizes are in centimeters.
//
// A room is a box with an open front (so the camera can see in):
//   { width, depth, height,
//     walls: { back, left, right },      which walls are there
//     paint: { back, left, right },      wall colors
//     floor: { style, color },
//     deskAt: { x, z, rotation },        where the desk stands, in room coordinates
//     windows: [{ id, wall, u, y, width, height, glass }] }
//
// A window sits on a wall like a wall item: u = its center along the wall
// (x for the back wall, z for the side walls), y = the height of the bottom
// of its frame off the floor. Each one gets a sill under it.
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
  windows: [],
}

export const MAX_WINDOWS = 6

// Window glass colors: sky blue first (the default), then a few moods.
export const GLASS_COLORS = [
  { name: 'Sky', value: '#8fd3ff' },
  { name: 'Sunset', value: '#ffb27a' },
  { name: 'Night', value: '#2b3150' },
  { name: 'Mint', value: '#9fe8c8' },
]

export const WINDOW_SIZE = { width: 100, height: 110, y: 90 }

export function getWindowLimits(room) {
  return {
    width: { min: 40, max: 300 },
    height: { min: 40, max: Math.max(40, room.height - 30) },
  }
}

// Pull a window's size and spot into range so it sits fully on its wall.
export function fitWindow(room, raw) {
  const limits = getWindowLimits(room)
  const half = (raw.wall === 'back' ? room.width : room.depth) / 2
  const width = clamp(Number.isFinite(raw.width) ? raw.width : WINDOW_SIZE.width, limits.width.min, Math.min(limits.width.max, 2 * half))
  const height = clamp(Number.isFinite(raw.height) ? raw.height : WINDOW_SIZE.height, limits.height.min, limits.height.max)
  return {
    id: raw.id,
    wall: raw.wall,
    width,
    height,
    u: clamp(Number.isFinite(raw.u) ? raw.u : 0, -half + width / 2, half - width / 2),
    y: clamp(Number.isFinite(raw.y) ? raw.y : WINDOW_SIZE.y, 0, room.height - height),
    glass: isColor(raw.glass) ? raw.glass : GLASS_COLORS[0].value,
  }
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
  room.windows = (Array.isArray(room.windows) ? room.windows : [])
    .filter((w) => w && typeof w.id === 'string' && WALLS.includes(w.wall))
    .slice(0, MAX_WINDOWS)
    .map((w) => fitWindow(room, w))
  return room
}
