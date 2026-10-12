import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Desk from './Desk.jsx'
import Floor from './Floor.jsx'
import CameraRig from './CameraRig.jsx'
import ItemsLayer from './ItemsLayer.jsx'
import { Lights } from './PlannerScene.jsx'
import { DEFAULT_FOV } from './cameraViews.js'

const DEFAULT_VIEW = { name: 'default', id: 0, instant: true }
const NO_IDS = []

// A look-but-don't-touch 3D view of a setup: orbit and zoom, no editing.
export default function SetupViewer({ desk, items }) {
  return (
    <Canvas
      shadows="percentage"
      flat
      dpr={[1, 2]}
      camera={{ fov: DEFAULT_FOV, near: 1, far: 5000, position: [200, 200, 300] }}
      gl={{ alpha: true, antialias: true }}
    >
      <Lights />
      <Floor />
      <Desk desk={desk} />
      <ItemsLayer desk={desk} items={items} selectedId={null} misplacedIds={NO_IDS} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={20}
        maxDistance={1200}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
      <CameraRig desk={desk} request={DEFAULT_VIEW} />
    </Canvas>
  )
}
