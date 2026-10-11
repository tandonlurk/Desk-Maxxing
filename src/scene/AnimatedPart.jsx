import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from 'three'
import { prefersReducedMotion } from '../motion.js'

// One shared 1×1×1 geometry per shape. Each part scales it to its real size,
// which lets the size animate smoothly without rebuilding geometry.
function makeWedge() {
  // A right triangle with its short sides along +x and +z, 1 unit tall.
  const triangle = new Shape()
  triangle.moveTo(0, 0)
  triangle.lineTo(1, 0)
  triangle.lineTo(0, 1)
  triangle.closePath()
  const geometry = new ExtrudeGeometry(triangle, { depth: 1, bevelEnabled: false })
  geometry.rotateX(Math.PI / 2) // lay it flat: the triangle now lies in x/z
  geometry.translate(0, 0.5, 0) // center it vertically like the box
  return geometry
}

const GEOMETRIES = {
  box: new BoxGeometry(1, 1, 1),
  cylinder: new CylinderGeometry(0.5, 0.5, 1, 12),
  wedge: makeWedge(),
}

// Spring settings. Low damping means a little overshoot, which gives the
// snappy, physical "blocky" feel when the desk changes.
const STIFFNESS = 320
const DAMPING = 19

// The 9 animated numbers are: position xyz, size xyz, rotation xyz.
function toArray(position, size, rotation) {
  return [...position, ...size, ...rotation]
}

function applyToMesh(mesh, v) {
  mesh.position.set(v[0], v[1], v[2])
  // Never scale to exactly 0: three.js can't invert a zero-size matrix.
  mesh.scale.set(Math.max(v[3], 0.001), Math.max(v[4], 0.001), Math.max(v[5], 0.001))
  mesh.rotation.set(v[6], v[7], v[8])
}

// A box/cylinder/wedge that springs to its new position, size, and rotation
// whenever they change, and pops in when it first appears.
export default function AnimatedPart({ shape = 'box', position, size, rotation = [0, 0, 0], color }) {
  const meshRef = useRef()
  const target = toArray(position, size, rotation)

  // Current values and velocities. Starts at the target but with zero width
  // and depth, so new parts pop in sideways. (Growing the height too would let
  // legs overshoot up through the desktop.)
  const current = useRef(null)
  const velocity = useRef(new Array(9).fill(0))
  if (current.current === null) {
    current.current = [...target]
    current.current[3] = current.current[5] = 0
  }

  // Place the mesh before the first frame is drawn. Position/scale are set
  // here and in useFrame only, never as JSX props, so React re-renders don't
  // snap the mesh and cut the animation short.
  useLayoutEffect(() => {
    applyToMesh(meshRef.current, current.current)
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const cur = current.current
    const vel = velocity.current

    if (prefersReducedMotion()) {
      target.forEach((value, i) => {
        cur[i] = value
        vel[i] = 0
      })
      applyToMesh(mesh, cur)
      return
    }

    // Small fixed steps keep the spring stable even if a frame takes long.
    const steps = Math.ceil(Math.min(delta, 0.1) / (1 / 120))
    const dt = Math.min(delta, 0.1) / steps
    let moving = false
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < 9; i++) {
        // Hooke's law: pull toward the target, with friction slowing it down.
        const force = STIFFNESS * (target[i] - cur[i]) - DAMPING * vel[i]
        vel[i] += force * dt
        cur[i] += vel[i] * dt
      }
    }
    for (let i = 0; i < 9; i++) {
      if (Math.abs(target[i] - cur[i]) > 0.01 || Math.abs(vel[i]) > 0.01) moving = true
    }
    if (!moving) {
      // Close enough: snap exactly onto the target and rest.
      target.forEach((value, i) => {
        cur[i] = value
        vel[i] = 0
      })
    }
    applyToMesh(mesh, cur)
  })

  return (
    <mesh ref={meshRef} geometry={GEOMETRIES[shape]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} flatShading />
    </mesh>
  )
}
