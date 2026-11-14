import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { tiledTexture } from './pixelTexture.js'
import { FLOOR_STYLES } from '../assets/roomOptions.js'
import { cssVar } from './cssVar.js'
import { SILL } from './wallPlacement.js'

const WALL_THICKNESS = 10
const BASE_THICKNESS = 12 // the chunky diorama block under the floor
const FLOOR_THICKNESS = 0.6
const BASEBOARD = { height: 8, depth: 1.5 }
const TILE = 40 // cm per texture repeat
const FADED = 0.14
const FRAME = { size: 6, depth: 5, color: '#a8703f' } // wood window frames

// The room around the desk: a floor on a chunky diorama base, plus the back
// and side walls (the front is open so you can see in). Drawn in room
// coordinates, so the scene wraps it in a group that moves it to where the
// desk is (see RoomGroup).
//
// A wall between the camera and the room fades out so it doesn't block the
// view. With `onPaint`, clicking a wall or the floor paints it.
export default function Room({ room, onPaint }) {
  const { width: W, depth: D, height: H } = room
  const pattern = FLOOR_STYLES.find((style) => style.id === room.floor.style)?.pattern || 'wood'
  const floorMap = useMemo(() => tiledTexture(pattern, W / TILE, D / TILE, 5), [pattern, W, D])
  const side = cssVar('--floor-side')

  const paintHandlers = (target) =>
    onPaint && {
      onClick: (event) => {
        event.stopPropagation()
        onPaint(target)
      },
      onPointerOver: (event) => {
        event.stopPropagation()
        document.body.style.cursor = 'copy'
      },
      onPointerOut: () => {
        document.body.style.cursor = ''
      },
    }

  // Side walls run the full depth; the back wall also covers the corners
  // where it meets them.
  const backLeft = room.walls.left ? WALL_THICKNESS : 0
  const backRight = room.walls.right ? WALL_THICKNESS : 0
  const backLength = W + backLeft + backRight
  const backCenter = (backRight - backLeft) / 2
  // A wall's windows with `x` along the wall in its own (local) coordinates.
  const windowsOn = (wall, toLocal) =>
    (room.windows || []).filter((w) => w.wall === wall).map((w) => ({ ...w, x: toLocal(w.u) }))

  return (
    <group>
      {/* Base block, a little wider than the floor so it frames the room. */}
      <mesh position={[0, -FLOOR_THICKNESS - BASE_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[W + 2 * WALL_THICKNESS, BASE_THICKNESS, D + 2 * WALL_THICKNESS]} />
        <meshStandardMaterial color={side} flatShading />
      </mesh>

      <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow {...paintHandlers('floor')}>
        <boxGeometry args={[W, FLOOR_THICKNESS, D]} />
        <meshStandardMaterial attach="material-0" color={room.floor.color} flatShading />
        <meshStandardMaterial attach="material-1" color={room.floor.color} flatShading />
        <meshStandardMaterial attach="material-2" color={room.floor.color} map={floorMap} roughness={0.9} flatShading />
        <meshStandardMaterial attach="material-3" color={room.floor.color} flatShading />
        <meshStandardMaterial attach="material-4" color={room.floor.color} flatShading />
        <meshStandardMaterial attach="material-5" color={room.floor.color} flatShading />
      </mesh>

      {room.walls.back && (
        <Wall
          name="back"
          color={room.paint.back}
          length={backLength}
          inner={W}
          height={H}
          position={[backCenter, H / 2, -D / 2 - WALL_THICKNESS / 2]}
          rotation={0}
          isOutside={(camera) => camera.z < -D / 2}
          handlers={paintHandlers('back')}
          windows={windowsOn('back', (u) => u - backCenter)}
        />
      )}
      {room.walls.left && (
        <Wall
          name="left"
          color={room.paint.left}
          length={D}
          inner={D}
          height={H}
          position={[-W / 2 - WALL_THICKNESS / 2, H / 2, 0]}
          rotation={Math.PI / 2}
          isOutside={(camera) => camera.x < -W / 2}
          handlers={paintHandlers('left')}
          windows={windowsOn('left', (u) => -u)}
        />
      )}
      {room.walls.right && (
        <Wall
          name="right"
          color={room.paint.right}
          length={D}
          inner={D}
          height={H}
          position={[W / 2 + WALL_THICKNESS / 2, H / 2, 0]}
          rotation={-Math.PI / 2}
          isOutside={(camera) => camera.x > W / 2}
          handlers={paintHandlers('right')}
          windows={windowsOn('right', (u) => u)}
        />
      )}
    </group>
  )
}

// One wall: a thick slab with a plaster texture and a baseboard along the
// bottom. Its inside face points along its local +z.
function Wall({ color, length, inner, height, position, rotation, isOutside, handlers, windows = [] }) {
  const groupRef = useRef()
  const materials = useRef({})
  const map = useMemo(() => tiledTexture('plaster', length / TILE, height / TILE, 11), [length, height])
  const camera = useMemo(() => new Vector3(), [])

  // Fade when the camera is outside the room on this wall's side.
  useFrame((state, delta) => {
    const parent = groupRef.current?.parent
    if (!parent) return
    camera.copy(state.camera.position)
    parent.worldToLocal(camera) // into room coordinates
    const target = isOutside(camera) && camera.y < height * 2.2 ? FADED : 1
    for (const material of Object.values(materials.current)) {
      if (!material) continue
      material.opacity += (target - material.opacity) * Math.min(1, delta * 10)
      const faded = material.opacity < 0.99
      if (material.transparent !== faded) {
        material.transparent = faded
        material.depthWrite = !faded
        material.needsUpdate = true
      }
    }
  })

  const setMaterial = (key) => (material) => {
    if (material) materials.current[key] = material
    else delete materials.current[key]
  }

  return (
    <group ref={groupRef} position={position} rotation-y={rotation}>
      <mesh castShadow receiveShadow {...handlers}>
        <boxGeometry args={[length, height, WALL_THICKNESS]} />
        <meshStandardMaterial ref={setMaterial(0)} color={color} map={map} roughness={0.95} flatShading />
      </mesh>
      {/* Baseboard on the inside face. */}
      <mesh position={[0, -height / 2 + BASEBOARD.height / 2, WALL_THICKNESS / 2 + BASEBOARD.depth / 2]} receiveShadow>
        <boxGeometry args={[inner, BASEBOARD.height, BASEBOARD.depth]} />
        <meshStandardMaterial ref={setMaterial(1)} color="#fffdf6" flatShading />
      </mesh>
      {/* A darker cap on top reads as the wall's thickness from above. */}
      <mesh position={[0, height / 2 + 0.5, 0]}>
        <boxGeometry args={[length, 1, WALL_THICKNESS]} />
        <meshStandardMaterial ref={setMaterial(2)} color={cssVar('--ink')} flatShading />
      </mesh>
      {windows.map((w) => (
        <group key={w.id} position={[w.x, -height / 2 + w.y, WALL_THICKNESS / 2]}>
          <WindowModel win={w} setMaterial={(part) => setMaterial(`${w.id}-${part}`)} />
        </group>
      ))}
    </group>
  )
}

// A four-pane window on a wall's inside face: wood frame and cross bars,
// tinted glass, and a sill under it. Drawn from its bottom center, with +z
// pointing into the room.
function WindowModel({ win, setMaterial }) {
  const { width: w, height: h } = win
  const f = FRAME.size
  const bar = f * 0.7
  const z = FRAME.depth / 2
  const bars = [
    { key: 'top', pos: [0, h - f / 2, z], size: [w, f, FRAME.depth] },
    { key: 'bottom', pos: [0, f / 2, z], size: [w, f, FRAME.depth] },
    { key: 'left', pos: [-w / 2 + f / 2, h / 2, z], size: [f, h - 2 * f, FRAME.depth] },
    { key: 'right', pos: [w / 2 - f / 2, h / 2, z], size: [f, h - 2 * f, FRAME.depth] },
    { key: 'mullion', pos: [0, h / 2, z * 0.8], size: [bar, h - 2 * f, FRAME.depth * 0.8] },
    { key: 'transom', pos: [0, h / 2, z * 0.8], size: [w - 2 * f, bar, FRAME.depth * 0.8] },
  ]
  return (
    <group>
      <mesh position={[0, h / 2, 0.6]}>
        <boxGeometry args={[w - 2 * f, h - 2 * f, 1]} />
        <meshStandardMaterial
          ref={setMaterial('glass')}
          color={win.glass}
          emissive={win.glass}
          emissiveIntensity={0.35}
          roughness={0.15}
          metalness={0.1}
          flatShading
        />
      </mesh>
      {bars.map((b) => (
        <mesh key={b.key} position={b.pos} castShadow receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial ref={setMaterial(b.key)} color={FRAME.color} roughness={0.8} flatShading />
        </mesh>
      ))}
      <mesh position={[0, -SILL.height / 2, SILL.depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[w + 2 * SILL.overhang, SILL.height, SILL.depth]} />
        <meshStandardMaterial ref={setMaterial('sill')} color="#fffdf6" flatShading />
      </mesh>
    </group>
  )
}

// Puts the room where it belongs around the desk: the scene is drawn in desk
// coordinates, so the room is turned and shifted the opposite way from the
// desk's placement in it.
export function RoomGroup({ room, children }) {
  const { x, z, rotation } = room.deskAt
  return (
    <group rotation-y={(-rotation * Math.PI) / 180}>
      <group position={[-x, 0, -(z ?? 0)]}>{children}</group>
    </group>
  )
}
