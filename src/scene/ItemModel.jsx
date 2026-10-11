// Draws one library item. Items are centered on x/z, sit on y = 0, and face
// +z (toward the person at the desk), all in cm.
//
// If the asset provides a `Model` component it's used; otherwise a simple
// placeholder block is drawn.
export default function ItemModel({ asset, color }) {
  if (asset.Model) {
    const Model = asset.Model
    return <Model color={color} size={asset.size} asset={asset} />
  }
  return <PlaceholderModel size={asset.size} color={color} />
}

function PlaceholderModel({ size, color }) {
  const { width, depth, height } = size
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.8} flatShading />
      </mesh>
      {/* A stripe on the front, so you can tell which way it faces. */}
      {height > 2 && (
        <mesh position={[0, height * 0.55, depth / 2 + 0.2]}>
          <boxGeometry args={[width * 0.6, Math.min(height * 0.2, 4), 0.4]} />
          <meshStandardMaterial color="#1b2541" />
        </mesh>
      )}
    </group>
  )
}
