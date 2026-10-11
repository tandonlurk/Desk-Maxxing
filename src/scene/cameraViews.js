// Where the camera goes for each preset view. Pure math, no React.
import { getDeskBounds, getSeat } from './deskGeometry.js'

export const VIEW_PRESETS = [
  { id: 'front', name: 'Front' },
  { id: 'top', name: 'Top' },
  { id: 'side', name: 'Side' },
  { id: 'seated', name: 'Seated' },
]

// Vertical field of view in degrees. The seated view is wider, closer to
// what your eyes take in when you sit at a desk.
export const DEFAULT_FOV = 45
const SEATED_FOV = 65

// Returns { position: [x,y,z], target: [x,y,z], fov } for a view.
// aspect is the canvas width / height.
export function getCameraView(name, desk, aspect) {
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
