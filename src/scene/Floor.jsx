import { useMemo } from 'react'
import { cssVar } from './cssVar.js'

const FLOOR_SIZE = 520 // cm, a bit over 17 ft square
const BASE_THICKNESS = 12
const PLANK_WIDTH = 20
const GAP = 0.6 // the little gaps between planks
const PLANK_THICKNESS = 0.6

// A tiny repeatable random number generator, so the planks come out the
// same every time instead of reshuffling on each visit.
function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}

// Rows of planks running left to right. Each row is split into two planks at
// a random point, so the joints are staggered like a real wood floor.
function makePlanks() {
  const random = seededRandom(7)
  const planks = []
  const rows = Math.floor(FLOOR_SIZE / PLANK_WIDTH)
  for (let row = 0; row < rows; row++) {
    const z = -FLOOR_SIZE / 2 + PLANK_WIDTH * (row + 0.5)
    const split = -FLOOR_SIZE / 2 + FLOOR_SIZE * (0.2 + random() * 0.6)
    const pieces = [
      [-FLOOR_SIZE / 2, split],
      [split, FLOOR_SIZE / 2],
    ]
    for (const [x0, x1] of pieces) {
      planks.push({
        key: `${row}-${x0}`,
        position: [(x0 + x1) / 2, -PLANK_THICKNESS / 2, z],
        size: [x1 - x0 - GAP, PLANK_THICKNESS, PLANK_WIDTH - GAP],
        shade: Math.floor(random() * 3), // which of the 3 plank colors
      })
    }
  }
  return planks
}

// A chunky square floor tile, like a diorama base, covered in pale wooden
// planks. The top of the planks is exactly y = 0.
export default function Floor() {
  const planks = useMemo(makePlanks, [])
  const shades = [cssVar('--floor-plank-1'), cssVar('--floor-plank-2'), cssVar('--floor-plank-3')]
  const gap = cssVar('--floor-gap')
  const side = cssVar('--floor-side')

  return (
    <group>
      {/* The base. The gap color shows between the planks. */}
      <mesh position={[0, -PLANK_THICKNESS - BASE_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[FLOOR_SIZE, BASE_THICKNESS, FLOOR_SIZE]} />
        {/* A box has 6 faces: +x, -x, +y (top), -y, +z, -z */}
        <meshStandardMaterial attach="material-0" color={side} flatShading />
        <meshStandardMaterial attach="material-1" color={side} flatShading />
        <meshStandardMaterial attach="material-2" color={gap} flatShading />
        <meshStandardMaterial attach="material-3" color={side} flatShading />
        <meshStandardMaterial attach="material-4" color={side} flatShading />
        <meshStandardMaterial attach="material-5" color={side} flatShading />
      </mesh>

      {planks.map((plank) => (
        <mesh key={plank.key} position={plank.position} receiveShadow>
          <boxGeometry args={plank.size} />
          <meshStandardMaterial color={shades[plank.shade]} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}
