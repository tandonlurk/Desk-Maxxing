import { Html } from '@react-three/drei'
import { distancesToDeskEdges } from './placement.js'
import { formatLength } from '../units.js'
import { cssVar } from './cssVar.js'

// Measuring lines from a desk item to the desk edges (left, right, back,
// front), each labeled with the distance. Shown in Free mode for precision.
export default function DistanceGuides({ desk, item, units }) {
  const guides = distancesToDeskEdges(desk, item)
  const y = desk.height + 0.4
  return (
    <group>
      {Object.entries(guides).map(([side, guide]) =>
        Number.isFinite(guide.distance) && guide.distance >= 0.5 ? (
          <Guide key={side} guide={guide} y={y} units={units} />
        ) : null,
      )}
    </group>
  )
}

function Guide({ guide, y, units }) {
  const { from, distance, axis, sign } = guide
  const [x, z] = from
  const along = (d) => (axis === 'x' ? [x + sign * d, y, z] : [x, y, z + sign * d])
  // Box sizes: the line runs along `axis`; ticks cross it at both ends.
  const lineScale = axis === 'x' ? [distance, 0.3, 0.5] : [0.5, 0.3, distance]
  const tickScale = axis === 'x' ? [0.5, 0.3, 4] : [4, 0.3, 0.5]
  const color = cssVar('--ink')

  return (
    <group>
      <mesh position={along(distance / 2)} scale={lineScale}>
        <boxGeometry />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={along(0)} scale={tickScale}>
        <boxGeometry />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={along(distance)} scale={tickScale}>
        <boxGeometry />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html position={along(distance / 2)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="guide-label">{formatLength(distance, units)}</div>
      </Html>
    </group>
  )
}
