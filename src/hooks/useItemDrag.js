import { useCallback, useEffect, useRef, useState } from 'react'
import { getAsset } from '../assets/library.js'
import {
  findNearestFree,
  makePlacementChecker,
  slideToward,
  snapToGrid,
  surfaceHeight,
} from '../scene/placement.js'
import { getSuggestedSpots } from '../scene/spots.js'
import { CM_PER_INCH } from '../units.js'
import { playSfx } from '../sfx.js'
import { makeItemId } from './useSetupEditor.js'

// The pointer has to move this many pixels before a press becomes a drag
// (so a plain click still just selects, or adds from the library).
const DRAG_THRESHOLD = 5

// In Snap mode, items lock into a suggested spot when dragged this close (cm).
function snapDistance(asset) {
  return 18 + Math.min(asset.size.width, asset.size.depth) * 0.25
}

// Snap mode also keeps items on a grid: 1 inch, or 2 cm.
function gridSize(units) {
  return units === 'in' ? CM_PER_INCH : 2
}

// Drag-and-drop for items: moving items that are already in the scene, and
// dragging new ones in from the library.
//
//   mode 'snap': glowing suggested spots appear; items lock into them when
//                close, and otherwise move on a grid.
//   mode 'free': items follow the pointer smoothly; they slide along desk
//                edges and other items instead of overlapping them.
//
// `picker` is a ref filled in by the 3D scene (see PointerPicker.jsx) that
// turns a screen position into a point on the desk or floor.
export function useItemDrag({ editor, picker, mode, units, select, notify }) {
  const dragRef = useRef(null)
  // What the scene needs to draw: which item is lifted and which spots glow.
  const [dragView, setDragView] = useState(null)

  // Event listeners are added once, so they read the latest values from here.
  const latest = useRef({})
  latest.current = { editor, picker, mode, units, select, notify }

  const begin = useCallback((drag, event) => {
    dragRef.current = {
      ...drag,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      overCanvas: false,
      group: `drag-${makeItemId()}`, // the whole drag is one undo step
    }
  }, [])

  // Pressing on an item in the scene.
  const startMove = useCallback(
    (item, event) => {
      latest.current.select(item.id)
      begin({ kind: 'move', itemId: item.id, assetId: item.assetId, startRotation: item.rotation }, event)
    },
    [begin],
  )

  // Pressing on an item card in the library.
  const startNew = useCallback(
    (assetId, event) => begin({ kind: 'new', itemId: null, assetId, startRotation: 0 }, event),
    [begin],
  )

  // Escape: put things back the way they were before the drag.
  const cancel = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return false
    dragRef.current = null
    setDragView(null)
    if (drag.started) latest.current.editor.history.cancelGroup(drag.group)
    return true
  }, [])

  useEffect(() => {
    function handleMove(event) {
      const drag = dragRef.current
      if (!drag) return
      const { editor, picker, mode, units } = latest.current
      const setup = editor.history.presentRef.current
      const asset = getAsset(drag.assetId)
      const planeY = surfaceHeight(setup.desk, asset)

      if (!drag.started) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return
        drag.started = true
        drag.spots =
          mode === 'snap'
            ? getSuggestedSpots(setup.desk, setup.items, asset, drag.itemId).filter((spot) => spot.free)
            : []
        // Remember where on the item it was grabbed, so it doesn't jump to
        // center itself under the pointer.
        drag.offset = { x: 0, z: 0 }
        if (drag.kind === 'move') {
          const item = setup.items.find((i) => i.id === drag.itemId)
          const grab = picker.current?.pick(drag.startX, drag.startY, planeY)
          if (item && grab) drag.offset = { x: grab.x - item.position.x, z: grab.z - item.position.z }
          playSfx('pickup')
        }
        setDragView({ itemId: drag.itemId, assetId: drag.assetId, spots: drag.spots, activeSpotId: null })
      }

      const hit = picker.current?.pick(event.clientX, event.clientY, planeY)
      drag.overCanvas = Boolean(hit)
      if (!hit) return
      const wanted = { x: hit.x - drag.offset.x, z: hit.z - drag.offset.z }

      // Snap mode: is there a free suggested spot close enough to lock into?
      let spot = null
      if (mode === 'snap') {
        let best = snapDistance(asset)
        for (const s of drag.spots) {
          const distance = Math.hypot(s.position.x - wanted.x, s.position.z - wanted.z)
          if (distance < best) {
            best = distance
            spot = s
          }
        }
      }
      const target = spot ? spot.position : mode === 'snap' ? snapToGrid(wanted, gridSize(units)) : wanted
      const rotation = spot ? spot.rotation : drag.startRotation

      if (drag.itemId === null) {
        // A new item appears (pops in) the first time the pointer is over the scene.
        const isValid = makePlacementChecker(setup.desk, setup.items)
        const position = findNearestFree(isValid, { id: null, assetId: drag.assetId, position: target, rotation }, 120)
        if (!position) return
        drag.itemId = editor.addItem(drag.assetId, { position, rotation }, { group: drag.group, mergeWindow: Infinity })
        setDragView((view) => view && { ...view, itemId: drag.itemId })
      } else {
        editor.history.update(
          (current) => {
            const item = current.items.find((i) => i.id === drag.itemId)
            if (!item) return current
            const isValid = makePlacementChecker(current.desk, current.items)

            // Turn first (when locking into or leaving a spot). If the turned
            // item doesn't fit where it is, find room nearby or don't turn.
            let moving = { ...item, rotation }
            if (!isValid(moving)) {
              const room = findNearestFree(isValid, moving, 40)
              moving = room ? { ...moving, position: room } : item
            }
            const position = spot && isValid({ ...moving, position: spot.position })
              ? spot.position
              : slideToward(isValid, moving, target)

            const unchanged =
              position.x === item.position.x && position.z === item.position.z && moving.rotation === item.rotation
            if (unchanged) return current
            const moved = { ...item, position, rotation: moving.rotation }
            return { ...current, items: current.items.map((i) => (i.id === item.id ? moved : i)) }
          },
          { group: drag.group, mergeWindow: Infinity },
        )
      }

      const spotId = spot ? spot.id : null
      if (spotId !== drag.activeSpotId) {
        drag.activeSpotId = spotId
        setDragView((view) => view && { ...view, activeSpotId: spotId })
      }
    }

    function handleUp() {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      setDragView(null)
      const { editor, select, notify } = latest.current

      // A click, not a drag.
      if (!drag.started) {
        if (drag.kind === 'new') {
          const id = editor.addItem(drag.assetId)
          if (id) {
            playSfx('place')
            select(id)
          } else {
            notify('No room for that one. Try moving something first.')
          }
        }
        return
      }

      if (drag.kind === 'new') {
        if (!drag.itemId) {
          if (drag.overCanvas) notify('No room for that one. Try moving something first.')
          return
        }
        // Dropped back over the library (not the scene): never mind.
        if (!drag.overCanvas) {
          editor.history.cancelGroup(drag.group)
          return
        }
        playSfx('place')
        select(drag.itemId)
        return
      }
      playSfx('drop')
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [])

  return { dragView, startMove, startNew, cancel }
}
