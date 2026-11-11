import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Desk from './Desk.jsx'
import Room, { RoomGroup } from './Room.jsx'
import CameraRig from './CameraRig.jsx'
import ItemsLayer from './ItemsLayer.jsx'
import { Lights } from './PlannerScene.jsx'
import { DEFAULT_FOV } from './cameraViews.js'
import { posedWallItems } from './wallPlacement.js'

const DEFAULT_VIEW = { name: 'room', id: 0, instant: true }
const NO_IDS = []

// A look-but-don't-touch 3D view of a setup: orbit and zoom, no editing.
export default function SetupViewer({ setup }) {
  const { room, desk, items, wallItems } = setup
  return (
    <Canvas
      shadows="percentage"
      flat
      dpr={[1, 2]}
      camera={{ fov: DEFAULT_FOV, near: 1, far: 5000, position: [200, 200, 300] }}
      gl={{ alpha: true, antialias: true }}
    >
      <Lights />
      <RoomGroup room={room}>
        <Room room={room} />
      </RoomGroup>
      <Desk desk={desk} />
      <ItemsLayer desk={desk} items={[...items, ...posedWallItems(room, wallItems)]} selectedId={null} misplacedIds={NO_IDS} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={20}
        maxDistance={1200}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
      <CameraRig desk={desk} room={room} request={DEFAULT_VIEW} />
    </Canvas>
  )
}
