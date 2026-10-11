import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Desk from './Desk.jsx'
import Floor from './Floor.jsx'
import CameraRig from './CameraRig.jsx'
import ItemsLayer from './ItemsLayer.jsx'
import SpotMarkers from './SpotMarkers.jsx'
import DistanceGuides from './DistanceGuides.jsx'
import PointerPicker from './PointerPicker.jsx'
import { DEFAULT_FOV } from './cameraViews.js'
import { getAsset } from '../assets/library.js'
import { surfaceHeight } from './placement.js'
import { cssVar } from './cssVar.js'

// The 3D view. The canvas is transparent so the page's baby-blue background
// shows through behind the scene.
export default function PlannerScene({
  desk,
  items,
  view,
  units,
  mode,
  selectedId,
  misplacedIds,
  dragView,
  picker,
  onItemPointerDown,
  onDeselect,
}) {
  const selected = items.find((item) => item.id === selectedId)
  // The spots belong to whatever's being dragged (even before a new item exists).
  const spotAsset = dragView ? getAsset(dragView.assetId) : null
  const showGuides = mode === 'free' && selected && getAsset(selected.assetId).placement === 'desk'

  return (
    <Canvas
      shadows="percentage" // PCF shadows (soft-edged since three r182)
      flat // plain colors, no film-style tone mapping
      dpr={[1, 2]}
      camera={{ fov: DEFAULT_FOV, near: 1, far: 5000, position: [200, 200, 300] }}
      gl={{ alpha: true, antialias: true }}
      // A click on empty space (not on an item) deselects.
      onPointerMissed={(event) => event.button === 0 && onDeselect()}
    >
      <Lights />
      <Floor />
      <Desk desk={desk} />

      <ItemsLayer
        desk={desk}
        items={items}
        selectedId={selectedId}
        liftedId={dragView?.itemId}
        misplacedIds={misplacedIds}
        onItemPointerDown={onItemPointerDown}
      />

      {spotAsset && dragView.spots.length > 0 && (
        <SpotMarkers
          spots={dragView.spots}
          activeSpotId={dragView.activeSpotId}
          size={spotAsset.size}
          surfaceY={surfaceHeight(desk, spotAsset)}
        />
      )}

      {showGuides && <DistanceGuides desk={desk} item={selected} units={units} />}

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
      <PointerPicker picker={picker} />
    </Canvas>
  )
}

function Lights() {
  return (
    <>
      {/* Soft fill: warm white from above, a little sky-blue bounce from below. */}
      <hemisphereLight args={['#fff8ee', '#b5d6ee', 1.55]} />
      {/* The warm "sun" casts the shadows. */}
      <directionalLight
        position={[160, 360, 220]}
        color={cssVar('--sun')}
        intensity={2.4}
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
