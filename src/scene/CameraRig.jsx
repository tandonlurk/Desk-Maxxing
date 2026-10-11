import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { getCameraView } from './cameraViews.js'
import { prefersReducedMotion } from '../motion.js'

// Glides the camera to a preset view whenever `request` changes.
// request = { name: 'front' | 'top' | 'side' | 'seated' | 'default', id, instant }
export default function CameraRig({ desk, request }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const controls = useThree((state) => state.controls)
  const goal = useRef(null) // { position, target, fov } while gliding

  // Only react to a new request, not to every desk edit.
  const deskRef = useRef(desk)
  deskRef.current = desk

  useEffect(() => {
    if (!controls) return
    const view = getCameraView(request.name, deskRef.current, size.width / size.height)
    const position = new Vector3(...view.position)
    const target = new Vector3(...view.target)

    if (request.instant || prefersReducedMotion()) {
      camera.position.copy(position)
      camera.fov = view.fov
      camera.updateProjectionMatrix()
      controls.target.copy(target)
      controls.update()
      goal.current = null
    } else {
      goal.current = { position, target, fov: view.fov }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, controls])

  // Let go as soon as the user grabs the camera themselves.
  useEffect(() => {
    if (!controls) return
    const stop = () => {
      goal.current = null
    }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, delta) => {
    if (!goal.current || !controls) return
    // Ease out: cover a fixed fraction of the remaining distance each frame,
    // adjusted for frame time so it feels the same at any frame rate.
    const t = 1 - Math.exp(-delta * 9)
    camera.position.lerp(goal.current.position, t)
    controls.target.lerp(goal.current.target, t)
    camera.fov += (goal.current.fov - camera.fov) * t
    camera.updateProjectionMatrix()
    controls.update()

    const done =
      camera.position.distanceTo(goal.current.position) < 0.5 &&
      controls.target.distanceTo(goal.current.target) < 0.5 &&
      Math.abs(camera.fov - goal.current.fov) < 0.1
    if (done) {
      camera.fov = goal.current.fov
      camera.updateProjectionMatrix()
      goal.current = null
    }
  })

  return null
}
