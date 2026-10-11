import AnimatedPart from './AnimatedPart.jsx'
import { getDeskParts } from './deskGeometry.js'

// The desk is just a list of simple parts worked out in deskGeometry.js.
export default function Desk({ desk }) {
  const parts = getDeskParts(desk)
  return (
    <group>
      {parts.map((part) => (
        <AnimatedPart
          key={part.key}
          shape={part.shape}
          position={part.position}
          size={part.size}
          rotation={part.rotation}
          color={part.color}
        />
      ))}
    </group>
  )
}
