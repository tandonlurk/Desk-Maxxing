import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import RectFrame from './RectFrame.jsx'
import { createSpring, settleSpring, stepSpring } from './spring.js'
import { toRadians } from './placement.js'
import { prefersReducedMotion } from '../motion.js'
import { cssVar } from './cssVar.js'

// The glowing suggested spots shown while dragging in Snap mode. Each one is
// the size of the item being placed. The spot the item has locked into is
// brighter and puffs up a little.
export default function SpotMarkers({ spots, activeSpotId, size, surfaceY }) {
  return (
    <group>
      {spots.map((spot, index) => (
        <SpotMarker
          key={spot.id}
          spot={spot}
          index={index}
          size={size}
          surfaceY={surfaceY}
          active={spot.id === activeSpotId}
        />
      ))}
    </group>
  )
}

function SpotMarker({ spot, index, size, surfaceY, active }) {
  const scaleRef = useRef()
  const fillRef = useRef()
  const anim = useRef(null)
  if (anim.current === null) {
    anim.current = { scale: createSpring(0, { stiffness: 420, damping: 14 }), age: 0 }
  }

  useFrame((_, delta) => {
    const a = anim.current
    a.age += delta
    // Spots pop in one after another.
    if (a.age > index * 0.05) a.scale.target = active ? 1.1 : 1
    if (prefersReducedMotion()) settleSpring(a.scale)
    else stepSpring(a.scale, delta)
    scaleRef.current.scale.setScalar(Math.max(a.scale.value, 0.001))
    // A soft pulse, brighter when locked in.
    fillRef.current.opacity = active ? 0.55 : 0.28 + 0.1 * Math.sin(a.age * 5)
  })

  const width = size.width + 4
  const depth = size.depth + 4
  const color = active ? cssVar('--accent') : cssVar('--accent-3')

  return (
    <group position={[spot.position.x, surfaceY + 0.3, spot.position.z]} rotation-y={toRadians(spot.rotation)}>
      <group ref={scaleRef}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial ref={fillRef} color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <RectFrame width={width} depth={depth} thickness={1} color={active ? cssVar('--ink') : '#ffffff'} />
      </group>
    </group>
  )
}
