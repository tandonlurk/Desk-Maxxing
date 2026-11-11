import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'

// Fills `picker.current` with helpers the page uses while dragging:
//   pick(clientX, clientY, height) → the { x, z } point on a flat surface at
//     that height (desk top or floor) under the pointer, or null if the
//     pointer isn't over the 3D view.
//   ray(clientX, clientY) → { origin, direction } of the line from the camera
//     through the pointer (for hitting walls), or null if not over the view.
//   viewAxes() → which floor directions are "up" and "right" on screen,
//     snapped to the nearest axis, so arrow keys move items the way you'd expect.
export default function PointerPicker({ picker }) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const plane = new Plane()
    const up = new Vector3(0, 1, 0)
    const hit = new Vector3()

    // Aims the raycaster through the pointer. False if it's not over the view.
    function aim(clientX, clientY) {
      const rect = gl.domElement.getBoundingClientRect()
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
      if (!inside) return false
      // Screen position → -1..1 "normalized device coordinates".
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return true
    }

    picker.current = {
      pick(clientX, clientY, height) {
        if (!aim(clientX, clientY)) return null
        plane.set(up, -height) // the horizontal plane y = height
        return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null
      },

      ray(clientX, clientY) {
        if (!aim(clientX, clientY)) return null
        const { origin, direction } = raycaster.ray
        return {
          origin: { x: origin.x, y: origin.y, z: origin.z },
          direction: { x: direction.x, y: direction.y, z: direction.z },
        }
      },

      viewAxes() {
        const look = new Vector3()
        camera.getWorldDirection(look)
        // Looking straight down, the top of the screen is the camera's "up".
        if (Math.abs(look.y) > 0.95) look.copy(camera.up).applyQuaternion(camera.quaternion)
        const forward =
          Math.abs(look.x) > Math.abs(look.z) ? { x: Math.sign(look.x), z: 0 } : { x: 0, z: Math.sign(look.z) }
        return { forward, right: { x: -forward.z, z: forward.x } }
      },
    }
    return () => {
      picker.current = null
    }
  }, [camera, gl, picker])

  return null
}
