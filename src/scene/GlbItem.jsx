// Draws a library item from its GLB file (asset.modelUrl), repainting its body
// parts (those in asset.baseColor) in the chosen color. Each placed item gets
// its own copy of the materials. Used as `Model` by src/assets/registry.js.
import { Suspense, useLayoutEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

export default function GlbItem({ asset, color, size }) {
  return (
    <Suspense fallback={<LoadingBlock size={size} color={color} />}>
      <GlbModel url={asset.modelUrl} baseColor={asset.baseColor} color={color} />
    </Suspense>
  )
}

function GlbModel({ url, baseColor, color }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      object.material = object.material.clone()
      object.userData.isBody = `#${object.material.color.getHexString()}` === baseColor
    })
    return copy
  }, [scene, baseColor])

  useLayoutEffect(() => {
    model.traverse((object) => {
      if (object.isMesh && object.userData.isBody) object.material.color.set(color || baseColor)
    })
  }, [model, color, baseColor])

  return <primitive object={model} />
}

// Shown for the moment a model is still downloading.
function LoadingBlock({ size, color }) {
  return (
    <mesh position={[0, size.height / 2, 0]}>
      <boxGeometry args={[size.width, size.height, size.depth]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} />
    </mesh>
  )
}
