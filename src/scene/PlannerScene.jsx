import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Desk from './Desk.jsx'
import Floor from './Floor.jsx'
import CameraRig from './CameraRig.jsx'
import { DEFAULT_FOV } from './cameraViews.js'

// The 3D view. The canvas is transparent so the page's baby-blue background
// shows through behind the scene.
export default function PlannerScene({ desk, view }) {
  return (
    <Canvas
      shadows="percentage" // PCF shadows (soft-edged since three r182)
      flat // plain colors, no film-style tone mapping
      dpr={[1, 2]}
      camera={{ fov: DEFAULT_FOV, near: 1, far: 5000, position: [200, 200, 300] }}
      gl={{ alpha: true, antialias: true }}
    >
      <Lights />
      <Floor />
      <Desk desk={desk} />

      {/* Left-drag orbits, right-drag pans, scroll zooms. */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={20}
        maxDistance={1200}
        maxPolarAngle={Math.PI / 2 - 0.04} // don't go below the floor
      />
      <CameraRig desk={desk} request={view} />
    </Canvas>
  )
}

function Lights() {
  return (
    <>
      {/* Soft fill: white from above, a blue bounce from below. */}
      <hemisphereLight args={['#ffffff', '#9fcbe8', 1.6]} />
      {/* The "sun": casts the shadows. */}
      <directionalLight
        position={[160, 360, 220]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-320}
        shadow-camera-right={320}
        shadow-camera-top={320}
        shadow-camera-bottom={-320}
        shadow-camera-near={10}
        shadow-camera-far={1200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.5}
      />
    </>
  )
}
