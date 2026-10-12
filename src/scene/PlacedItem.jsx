import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Billboard, Outlines } from '@react-three/drei'
import ItemModel from './ItemModel.jsx'
import RectFrame from './RectFrame.jsx'
import { DESK_SPRING, createSpring, settleSpring, stepSpring } from './spring.js'
import { toRadians } from './placement.js'
import { prefersReducedMotion } from '../motion.js'
import { cssVar } from './cssVar.js'

const LIFT_HEIGHT = 6 // how high an item floats while being dragged (cm)
const DROP_HEIGHT = 16 // new items drop in from this high
const PUFF_TIME = 0.45 // seconds
const HOVER_LIFT = 1.5 // items rise a touch when the pointer is over them
const PUFF_COUNT = 8
const SPARKLE_COUNT = 4

// One item on the desk or floor, with all its little animations:
//   - pops in (grows with an overshoot) and drops onto the surface
//   - lands with a squash and a puff of dust (plus sparkles when new)
//   - floats up while dragged, and squashes back down when dropped
//   - hops when selected, then gently "breathes"
//   - wobbles when turned, and shrinks away with a spin when deleted
export default function PlacedItem({ item, asset, surfaceY, selected, lifted, flagged, exiting, onPointerDown }) {
  const baseRef = useRef() // position + rotation on the surface
  const bodyRef = useRef() // lift + squash/stretch; holds the model
  const puffRef = useRef()
  const sparkleRef = useRef()
  const ringRef = useRef()
  const controls = useThree((state) => state.controls)

  // Animation state lives in a ref: it changes every frame, which shouldn't
  // re-render React.
  const anim = useRef(null)
  if (anim.current === null) {
    anim.current = {
      x: createSpring(item.position.x, { stiffness: 900, damping: 52 }),
      z: createSpring(item.position.z, { stiffness: 900, damping: 52 }),
      y: createSpring(surfaceY, DESK_SPRING), // same spring as the desk, so items ride along with it
      turn: createSpring(toRadians(item.rotation), { stiffness: 420, damping: 17 }), // a little wobble
      scale: createSpring(0, { stiffness: 380, damping: 15 }), // pop with overshoot
      lift: createSpring(DROP_HEIGHT, { stiffness: 300, damping: 36 }),
      squash: createSpring(1, { stiffness: 520, damping: 13 }),
      airborne: true, // in the air; squash + puff when it lands
      landing: 'place', // 'place' | 'drop' | 'hop'
      puffTime: -1, // seconds since the puff started (-1 = no puff)
      sparkles: false,
      wasLifted: false,
      wasSelected: false,
      exitStarted: false,
      hovered: false,
      clock: Math.random() * 10,
    }
  }

  useFrame((_, delta) => {
    const a = anim.current
    a.clock += delta

    // --- Targets ---
    a.x.target = item.position.x
    a.z.target = item.position.z
    a.y.target = surfaceY
    // Turn the short way round (from 350° to 10° is +20°, not -340°).
    const wanted = toRadians(item.rotation)
    const diff = ((((wanted - a.turn.target) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
    a.turn.target += diff

    if (lifted && !a.wasLifted) {
      a.airborne = true
      a.landing = 'drop'
      a.squash.velocity += 3 // stretch a little as it's picked up
    }
    if (selected && !a.wasSelected && !lifted) {
      a.lift.velocity += 150 // a happy little hop
      a.airborne = true
      a.landing = 'hop'
    }
    a.wasLifted = lifted
    a.wasSelected = selected
    a.lift.target = lifted ? LIFT_HEIGHT : a.hovered && !exiting ? HOVER_LIFT : 0

    a.scale.target = exiting ? 0 : 1
    if (exiting && !a.exitStarted) {
      a.exitStarted = true
      a.turn.target += Math.PI / 2 // spin away
      a.puffTime = 0
      a.sparkles = false
    }

    // Selected items gently breathe.
    a.squash.target = selected && !lifted ? 1 + 0.018 * Math.sin(a.clock * 5) : 1

    // --- Step ---
    const springs = [a.x, a.z, a.y, a.turn, a.scale, a.lift, a.squash]
    if (prefersReducedMotion()) {
      springs.forEach(settleSpring)
      a.airborne = false
      a.puffTime = -1
    } else {
      springs.forEach((spring) => stepSpring(spring, delta))
    }

    // Landed? Squash, and puff unless it was just a hop.
    if (a.airborne && !lifted && a.lift.value < a.lift.target + 0.4) {
      a.airborne = false
      a.squash.velocity -= a.landing === 'hop' ? 2.5 : 5.5
      if (a.landing !== 'hop') {
        a.puffTime = 0
        a.sparkles = a.landing === 'place'
      }
    }

    // --- Apply ---
    baseRef.current.position.set(a.x.value, a.y.value, a.z.value)
    baseRef.current.rotation.y = a.turn.value
    const scale = Math.max(a.scale.value, 0.001)
    const squash = Math.max(a.squash.value, 0.3)
    const wide = scale / Math.sqrt(squash) // keep the volume about the same
    bodyRef.current.position.y = a.lift.value
    bodyRef.current.scale.set(wide, scale * squash, wide)

    animatePuff(a, delta, puffRef.current, sparkleRef.current, ringRef.current, asset)
  })

  function handlePointerDown(event) {
    if (event.button !== 0 || exiting) return
    event.stopPropagation()
    // Stop the camera from orbiting while an item is dragged.
    if (controls) {
      controls.enabled = false
      window.addEventListener('pointerup', () => (controls.enabled = true), { once: true })
    }
    onPointerDown(item, event.nativeEvent)
  }

  const { width, depth, height } = asset.size
  const padColor = flagged ? cssVar('--danger') : lifted ? cssVar('--accent-3') : cssVar('--accent')
  const showPad = (selected || lifted || flagged) && !exiting

  return (
    <group
      ref={baseRef}
      // Without onPointerDown (e.g. viewing someone else's setup) items can't be grabbed.
      onPointerDown={onPointerDown && handlePointerDown}
      onPointerOver={(event) => {
        if (!onPointerDown) return
        event.stopPropagation()
        if (exiting) return
        anim.current.hovered = true
        document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        anim.current.hovered = false
        document.body.style.cursor = ''
      }}
    >
      <group ref={bodyRef}>
        <ItemModel asset={asset} color={item.color} />
        {(selected || flagged) && !exiting && (
          <MeshOutlines rootRef={bodyRef} color={flagged ? cssVar('--danger') : cssVar('--ink')} />
        )}
      </group>

      {showPad && (
        <group position={[0, 0.25, 0]}>
          <RectFrame width={width + 4} depth={depth + 4} thickness={1.2} color={padColor} />
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[width + 4, depth + 4]} />
            <meshBasicMaterial color={padColor} transparent opacity={0.22} depthWrite={false} />
          </mesh>
        </group>
      )}

      <Puff innerRef={puffRef} />
      <Ripple innerRef={ringRef} />
      <Sparkles innerRef={sparkleRef} />
      {flagged && !exiting && <FlagMarker height={height} />}
    </group>
  )
}

// Moves the puff, ripple, and sparkle particles for the current moment of the burst.
function animatePuff(a, delta, puff, sparkles, ring, asset) {
  if (a.puffTime < 0) {
    puff.visible = false
    sparkles.visible = false
    ring.visible = false
    return
  }
  a.puffTime += delta
  const t = a.puffTime / PUFF_TIME
  if (t >= 1) {
    a.puffTime = -1
    return
  }
  const ease = 1 - (1 - t) * (1 - t) // fast at first, then slowing down
  const spread = Math.max(asset.size.width, asset.size.depth) / 2

  puff.visible = true
  puff.children.forEach((cube, i) => {
    const angle = (i / PUFF_COUNT) * Math.PI * 2 + 0.4
    const distance = spread * 0.7 + 12 * ease
    cube.position.set(Math.cos(angle) * distance, 1.5 + 8 * t * (1 - t), Math.sin(angle) * distance)
    cube.scale.setScalar(Math.max(0.001, 2.6 * (1 - t)))
    cube.rotation.set(t * 3, t * 4, 0)
  })

  // A soft ring spreading out across the surface, like a gentle "plop".
  ring.visible = true
  ring.scale.setScalar(spread * 0.9 + 22 * ease)
  ring.material.opacity = 0.55 * (1 - t)

  sparkles.visible = a.sparkles
  sparkles.children.forEach((star, i) => {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2
    star.position.set(Math.cos(angle) * (6 + 10 * ease), asset.size.height + 4 + 18 * ease, Math.sin(angle) * (6 + 10 * ease))
    star.scale.setScalar(Math.max(0.001, 2.2 * Math.sin(Math.PI * t)))
    star.rotation.y = t * 6
  })
}

// Little dust cubes that burst out from under an item when it lands.
function Puff({ innerRef }) {
  return (
    <group ref={innerRef} visible={false}>
      {Array.from({ length: PUFF_COUNT }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#fff6e6" flatShading />
        </mesh>
      ))}
    </group>
  )
}

// A flat ring lying on the surface (scaled up as it spreads out).
function Ripple({ innerRef }) {
  return (
    <mesh ref={innerRef} rotation-x={-Math.PI / 2} position={[0, 0.3, 0]} visible={false}>
      <ringGeometry args={[0.86, 1, 40]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  )
}

// Yellow diamonds that float up when a new item is placed.
function Sparkles({ innerRef }) {
  return (
    <group ref={innerRef} visible={false}>
      {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={cssVar('--accent')} />
        </mesh>
      ))}
    </group>
  )
}

// A bobbing red "!" sign above items that no longer fit on the desk.
function FlagMarker({ height }) {
  const ref = useRef()
  useFrame((state) => {
    if (!prefersReducedMotion()) ref.current.position.y = height + 14 + Math.sin(state.clock.elapsedTime * 4) * 1.5
  })
  return (
    <group ref={ref} position={[0, height + 14, 0]}>
      <Billboard>
        <mesh>
          <boxGeometry args={[8, 11, 2]} />
          <meshBasicMaterial color={cssVar('--danger')} />
        </mesh>
        <mesh position={[0, 1.5, 1.1]}>
          <boxGeometry args={[2, 5, 0.4]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, -3, 1.1]}>
          <boxGeometry args={[2, 2, 0.4]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </Billboard>
    </group>
  )
}

// Chunky outlines around every mesh in the item's model, whatever it's made
// of. drei's <Outlines> has to live inside the mesh it outlines, so each one
// is "portaled" into a mesh found in the model.
function MeshOutlines({ rootRef, color }) {
  const [meshes, setMeshes] = useState([])

  // A regular effect (not a layout effect): it runs after the parent group's
  // ref is attached.
  useEffect(() => {
    const found = []
    rootRef.current.traverse((object) => {
      if (object.isMesh) found.push(object)
    })
    setMeshes(found)
  }, [rootRef])

  return meshes.map((mesh) => (
    <Fragment key={mesh.uuid}>{createPortal(<Outlines thickness={4} color={color} />, mesh)}</Fragment>
  ))
}
