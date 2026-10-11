// Pure math that turns desk settings into simple 3D parts. No React here.
//
// Coordinate system (everything in centimeters, 1 scene unit = 1 cm):
//   x → to the right   y ↑ up   z → toward the person sitting at the desk
// The main desk is centered on the origin, so its back edge is at z = -depth/2
// and its front edge (where you sit) is at z = +depth/2. The floor is y = 0.

import { getMaterial } from '../assets/deskOptions.js'

export const TOP_THICKNESS = 3

// How far in front of the desk edge a chair (and your eyes) would be.
const SEAT_DISTANCE = 45

// Your eyes are roughly 47 cm above an ergonomically set desk surface, whether
// sitting or standing, so eye height simply follows the desk height.
const EYE_ABOVE_DESK = 47

// A desktop is made of "wings": rectangles in the floor plan.
//   axis: the direction of the wing's long side ('x' or 'z')
//   ends: which ends of the wing need their own legs. The return of an
//         L-shaped desk only needs legs at its far end, because its near end
//         rests against the main desk.
export function getWings(desk) {
  const { width: W, depth: D } = desk
  const main = { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, axis: 'x', ends: ['start', 'end'] }

  if (desk.shape === 'l-shape') {
    // The return runs toward you along the left or right end of the main desk.
    const x0 = desk.returnSide === 'left' ? -W / 2 : W / 2 - desk.returnDepth
    const ret = {
      x0,
      x1: x0 + desk.returnDepth,
      z0: D / 2,
      z1: -D / 2 + desk.returnLength,
      axis: 'z',
      ends: ['end'],
    }
    return [main, ret]
  }

  if (desk.shape === 'corner') {
    // Two equal wings meet in the back-right corner: the main desk along the
    // back wall and a side wing (same length and depth) along the right wall.
    const side = { x0: W / 2 - D, x1: W / 2, z0: D / 2, z1: -D / 2 + W, axis: 'z', ends: ['end'] }
    return [main, side]
  }

  return [main]
}

// A corner desk fills its inside corner with a triangle, which gives a
// diagonal front edge to sit at. Returns the right-angle point of the
// triangle and the length of its two short sides (they run -x and +z).
export function getCornerFill(desk) {
  if (desk.shape !== 'corner') return null
  const { width: W, depth: D } = desk
  return { x: W / 2 - D, z: D / 2, size: Math.min(55, Math.max(0, W - D - 15)) }
}

// The floor-plan box that contains the whole desk.
export function getDeskBounds(desk) {
  const wings = getWings(desk)
  return {
    minX: Math.min(...wings.map((w) => w.x0)),
    maxX: Math.max(...wings.map((w) => w.x1)),
    minZ: Math.min(...wings.map((w) => w.z0)),
    maxZ: Math.max(...wings.map((w) => w.z1)),
  }
}

// Where a person sits, and which way they face (a unit vector on the floor).
export function getSeat(desk) {
  const eyeHeight = desk.height + EYE_ABOVE_DESK
  const fill = getCornerFill(desk)

  if (fill) {
    // Sit in front of the middle of the diagonal edge, facing the corner.
    // The diagonal faces the direction (-1, +1), normalized.
    const s = Math.SQRT1_2
    const midX = fill.x - fill.size / 2
    const midZ = fill.z + fill.size / 2
    return { x: midX - s * SEAT_DISTANCE, z: midZ + s * SEAT_DISTANCE, dirX: s, dirZ: -s, eyeHeight }
  }

  return { x: 0, z: desk.depth / 2 + SEAT_DISTANCE, dirX: 0, dirZ: -1, eyeHeight }
}

// ---------------------------------------------------------------------------
// Parts: every visible piece of the desk is a box, cylinder, or wedge with a
// position (its center), a size, and a rotation. Keys stay the same between
// edits so the scene can animate a part from its old shape to its new one.
// ---------------------------------------------------------------------------

export function getDeskParts(desk) {
  const material = getMaterial(desk.material)
  const top = getTopParts(desk).map((part) => ({ ...part, color: material.top }))
  const legs = getLegParts(desk).map((part) => ({ ...part, color: material.legs }))
  return [...top, ...legs]
}

function getTopParts(desk) {
  const y = desk.height - TOP_THICKNESS / 2
  const parts = getWings(desk).map((w, i) => ({
    key: `top-${i}`,
    shape: 'box',
    position: [(w.x0 + w.x1) / 2, y, (w.z0 + w.z1) / 2],
    size: [w.x1 - w.x0, TOP_THICKNESS, w.z1 - w.z0],
  }))

  const fill = getCornerFill(desk)
  if (fill && fill.size > 0) {
    parts.push({
      key: 'top-corner-fill',
      shape: 'wedge',
      position: [fill.x, y, fill.z],
      size: [fill.size, TOP_THICKNESS, fill.size],
      // The wedge's short sides point +x and +z; turning it -90° about y
      // makes them point -x and +z, filling the inside corner.
      rotation: [0, -Math.PI / 2, 0],
    })
  }
  return parts
}

// Describes a wing in its own terms: "along" its long side and "across" it,
// so leg code can be written once and work for wings facing either way.
function wingFrame(wing) {
  const alongX = wing.axis === 'x'
  return {
    a0: alongX ? wing.x0 : wing.z0,
    a1: alongX ? wing.x1 : wing.z1,
    c0: alongX ? wing.z0 : wing.x0,
    c1: alongX ? wing.z1 : wing.x1,
    // (along, y, across) → world [x, y, z]
    point: (a, y, c) => (alongX ? [a, y, c] : [c, y, a]),
    size: (sa, sy, sc) => (alongX ? [sa, sy, sc] : [sc, sy, sa]),
    // Rotation that tips a vertical post so its top leans toward the middle
    // of the wing. footSide is -1 or +1 (which side its foot is on).
    lean: (footSide, angle) => (alongX ? [-footSide * angle, 0, 0] : [0, 0, footSide * angle]),
  }
}

function getLegParts(desk) {
  const legHeight = desk.height - TOP_THICKNESS
  const parts = []

  getWings(desk).forEach((wing, wingIndex) => {
    const f = wingFrame(wing)
    const insetByStyle = { 'four-leg': 6.5, standing: 10, trestle: 12, 'a-frame': 10 }
    const inset = insetByStyle[desk.legStyle] || 6.5

    for (const end of wing.ends) {
      const along = end === 'start' ? f.a0 + inset : f.a1 - inset
      const key = `w${wingIndex}-${end}-${desk.legStyle}`
      parts.push(...supportParts(desk.legStyle, f, along, legHeight, key))
    }

    // Wings with legs at both ends get a bar connecting the two supports.
    if (wing.ends.length === 2) {
      const key = `w${wingIndex}-bar-${desk.legStyle}`
      parts.push(...connectorParts(desk.legStyle, f, inset, legHeight, key))
    }
  })

  return parts
}

// The legs at one end of a wing. `along` is where along the wing they stand.
function supportParts(style, f, along, legHeight, key) {
  const across = f.c1 - f.c0 // how deep the wing is
  const mid = (f.c0 + f.c1) / 2

  if (style === 'standing') {
    // A telescoping column: a wide lower tube, a thinner upper tube that
    // reaches the desktop, a foot on the floor, and a bracket under the top.
    const lowerHeight = Math.min(50, legHeight - 10)
    const upperHeight = legHeight - 4
    return [
      { key: `${key}-foot`, shape: 'box', position: f.point(along, 2, mid), size: f.size(7, 4, across - 4) },
      { key: `${key}-lower`, shape: 'box', position: f.point(along, 4 + lowerHeight / 2, mid), size: f.size(9, lowerHeight, 9) },
      { key: `${key}-upper`, shape: 'box', position: f.point(along, 4 + upperHeight / 2, mid), size: f.size(6.5, upperHeight, 6.5) },
      { key: `${key}-bracket`, shape: 'box', position: f.point(along, legHeight - 1.5, mid), size: f.size(6, 3, across - 8) },
    ]
  }

  if (style === 'trestle') {
    // An upside-down T: a foot, a post, and a cleat under the top.
    const postHeight = legHeight - 10
    return [
      { key: `${key}-foot`, shape: 'box', position: f.point(along, 3, mid), size: f.size(8, 6, across - 6) },
      { key: `${key}-post`, shape: 'box', position: f.point(along, 6 + postHeight / 2, mid), size: f.size(7, postHeight, 12) },
      { key: `${key}-cleat`, shape: 'box', position: f.point(along, legHeight - 2, mid), size: f.size(8, 4, across - 10) },
    ]
  }

  if (style === 'a-frame') {
    // Two legs that start near the middle under the top and splay out to the
    // front and back edges, like the letter A seen from the side.
    const footOffset = across / 2 - 5 // foot distance from the middle
    const topOffset = 4 // top distance from the middle
    const spread = footOffset - topOffset
    const length = Math.hypot(spread, legHeight)
    const angle = Math.atan2(spread, legHeight) // lean away from vertical

    const legs = [-1, 1].map((side) => ({
      key: `${key}-leg${side}`,
      shape: 'box',
      position: f.point(along, legHeight / 2, mid + (side * (footOffset + topOffset)) / 2),
      size: f.size(5, length, 5),
      rotation: f.lean(side, angle),
    }))

    // The crossbar sits 30% of the way up, where the legs are this far apart:
    const barY = legHeight * 0.3
    const barHalf = footOffset * 0.7 + topOffset * 0.3
    return [
      ...legs,
      { key: `${key}-bar`, shape: 'box', position: f.point(along, barY, mid), size: f.size(4, 4, barHalf * 2 + 4) },
      { key: `${key}-cleat`, shape: 'box', position: f.point(along, legHeight - 2, mid), size: f.size(6, 4, across - 8) },
    ]
  }

  // Four-leg: one square leg in each corner.
  return [f.c0 + 6.5, f.c1 - 6.5].map((c, i) => ({
    key: `${key}-leg${i}`,
    shape: 'box',
    position: f.point(along, legHeight / 2, c),
    size: f.size(5, legHeight, 5),
  }))
}

// The bar that joins the two supports of a wing (none for four-leg desks).
function connectorParts(style, f, inset, legHeight, key) {
  const length = f.a1 - f.a0 - inset * 2
  const midAlong = (f.a0 + f.a1) / 2
  const midAcross = (f.c0 + f.c1) / 2

  if (style === 'standing') {
    return [{ key, shape: 'box', position: f.point(midAlong, legHeight - 3, midAcross), size: f.size(length, 4, 5) }]
  }
  if (style === 'trestle') {
    return [{ key, shape: 'box', position: f.point(midAlong, legHeight * 0.35, midAcross), size: f.size(length, 6, 4) }]
  }
  return []
}
