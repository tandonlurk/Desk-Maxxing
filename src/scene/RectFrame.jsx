// A flat rectangular outline lying on a surface, made of 4 thin boxes.
// Used for selection pads and suggested spots.
export default function RectFrame({ width, depth, thickness = 1, height = 0.4, color }) {
  const sides = [
    { position: [0, 0, -depth / 2], size: [width + thickness, height, thickness] },
    { position: [0, 0, depth / 2], size: [width + thickness, height, thickness] },
    { position: [-width / 2, 0, 0], size: [thickness, height, depth] },
    { position: [width / 2, 0, 0], size: [thickness, height, depth] },
  ]
  return (
    <group>
      {sides.map((side, i) => (
        <mesh key={i} position={side.position}>
          <boxGeometry args={side.size} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}
