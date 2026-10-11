import { Grid } from '@react-three/drei'
import { cssVar } from './cssVar.js'

const FLOOR_SIZE = 520 // cm, a bit over 17 ft square
const FLOOR_THICKNESS = 12

// A chunky square floor tile, like a diorama base, with a faint grid on top.
// Its top surface is exactly y = 0.
export default function Floor() {
  const top = cssVar('--floor-top')
  const side = cssVar('--floor-side')

  return (
    <group>
      <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[FLOOR_SIZE, FLOOR_THICKNESS, FLOOR_SIZE]} />
        {/* A box has 6 faces: +x, -x, +y (top), -y, +z, -z */}
        <meshStandardMaterial attach="material-0" color={side} flatShading />
        <meshStandardMaterial attach="material-1" color={side} flatShading />
        <meshStandardMaterial attach="material-2" color={top} flatShading />
        <meshStandardMaterial attach="material-3" color={side} flatShading />
        <meshStandardMaterial attach="material-4" color={side} flatShading />
        <meshStandardMaterial attach="material-5" color={side} flatShading />
      </mesh>
      <Grid
        position={[0, 0.05, 0]}
        args={[FLOOR_SIZE, FLOOR_SIZE]}
        cellSize={25}
        cellThickness={0.6}
        cellColor={cssVar('--grid-cell')}
        sectionSize={100}
        sectionThickness={1}
        sectionColor={cssVar('--grid-section')}
        fadeDistance={FLOOR_SIZE * 0.7}
        fadeStrength={1.5}
        fadeFrom={0}
      />
    </group>
  )
}
