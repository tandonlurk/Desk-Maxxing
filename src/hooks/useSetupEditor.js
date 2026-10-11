import { useCallback } from 'react'
import { useUndoable } from './useUndoable.js'
import { DEFAULT_DESK, normalizeDesk } from '../assets/deskOptions.js'
import { getAsset } from '../assets/library.js'
import {
  ROTATION_STEP,
  findNearestFree,
  fitItemsToDesk,
  getEdgeOffsets,
  makePlacementChecker,
  normalizeAngle,
} from '../scene/placement.js'
import { getSuggestedSpots } from '../scene/spots.js'
import { getSeat, SEAT_DISTANCE } from '../scene/deskGeometry.js'

export function makeItemId() {
  return window.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Everything that changes the setup (the desk and the items on it), with
// undo/redo. Actions that can fail (no room) return false so the page can
// show a message.
export function useSetupEditor() {
  const history = useUndoable({ desk: DEFAULT_DESK, items: [] })
  const { desk, items } = history.present
  const { update, presentRef } = history

  const updateDesk = useCallback(
    (changes) => {
      // Typing in a number box merges into one undo step; clicks don't.
      const [key, value] = Object.entries(changes)[0]
      const group = typeof value === 'number' ? `desk-${key}` : null
      update(
        (setup) => {
          const nextDesk = normalizeDesk({ ...setup.desk, ...changes })
          // Items that fell off the edge get nudged back on if there's room.
          return { desk: nextDesk, items: fitItemsToDesk(nextDesk, setup.items) }
        },
        { group },
      )
    },
    [update],
  )

  // Replace one item. `group` merges repeated changes into one undo step.
  const changeItem = useCallback(
    (id, changes, options) => {
      update(
        (setup) => ({
          ...setup,
          items: setup.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
        }),
        options,
      )
    },
    [update],
  )

  // Where a new item should go when it's clicked in the library: its first
  // free suggested spot, or else the nearest free space to the middle front
  // of the desk (or beside the desk, for floor items).
  const findHomeFor = useCallback((setup, assetId) => {
    const asset = getAsset(assetId)
    const spot = getSuggestedSpots(setup.desk, setup.items, asset).find((s) => s.free)
    if (spot) return { position: spot.position, rotation: spot.rotation }

    const seat = getSeat(setup.desk)
    const rotation = 0
    const start =
      asset.placement === 'floor'
        ? { x: setup.desk.width / 2 + 10 + asset.size.width / 2, z: 0 }
        : { x: seat.x + seat.dirX * (SEAT_DISTANCE + 25), z: seat.z + seat.dirZ * (SEAT_DISTANCE + 25) }
    const isValid = makePlacementChecker(setup.desk, setup.items)
    const position = findNearestFree(isValid, { id: null, assetId, position: start, rotation }, 250)
    return position ? { position, rotation } : null
  }, [])

  // Add an item. If no position is given, find a good home for it.
  // Returns the new item's id, or null if there's no room.
  const addItem = useCallback(
    (assetId, placement = null, options = {}) => {
      const setup = presentRef.current
      const home = placement || findHomeFor(setup, assetId)
      if (!home) return null
      const asset = getAsset(assetId)
      const item = {
        id: options.id || makeItemId(),
        assetId,
        position: home.position,
        rotation: home.rotation ?? 0,
        color: asset.colorOptions[0].value,
      }
      update((s) => ({ ...s, items: [...s.items, item] }), options)
      return item.id
    },
    [update, presentRef, findHomeFor],
  )

  const deleteItem = useCallback(
    (id) => update((setup) => ({ ...setup, items: setup.items.filter((item) => item.id !== id) })),
    [update],
  )

  // Copy an item into the nearest free space next to it.
  const duplicateItem = useCallback(
    (id) => {
      const setup = presentRef.current
      const original = setup.items.find((item) => item.id === id)
      if (!original) return null
      const copy = {
        ...original,
        id: makeItemId(),
        position: { x: original.position.x + 8, z: original.position.z + 8 },
      }
      const position = findNearestFree(makePlacementChecker(setup.desk, setup.items), copy, 200)
      if (!position) return null
      update((s) => ({ ...s, items: [...s.items, { ...copy, position }] }))
      return copy.id
    },
    [update, presentRef],
  )

  // Turn an item by `delta` degrees (snapped to 15° unless `free`). If it no
  // longer fits where it is, it shuffles to the nearest free space.
  const rotateItem = useCallback(
    (id, delta, { free = false } = {}) => {
      const setup = presentRef.current
      const item = setup.items.find((i) => i.id === id)
      if (!item) return false
      let rotation = normalizeAngle(item.rotation + delta)
      if (!free) rotation = normalizeAngle(Math.round(rotation / ROTATION_STEP) * ROTATION_STEP)
      const turned = { ...item, rotation }
      const position = findNearestFree(makePlacementChecker(setup.desk, setup.items), turned, 40)
      if (!position) return false
      changeItem(id, { rotation, position }, { group: `rotate-${id}` })
      return true
    },
    [presentRef, changeItem],
  )

  // Move an item by (dx, dz) cm, if that spot is free.
  const nudgeItem = useCallback(
    (id, dx, dz) => {
      const setup = presentRef.current
      const item = setup.items.find((i) => i.id === id)
      if (!item) return false
      const moved = { ...item, position: { x: item.position.x + dx, z: item.position.z + dz } }
      if (!makePlacementChecker(setup.desk, setup.items)(moved)) return false
      changeItem(id, { position: moved.position }, { group: `nudge-${id}` })
      return true
    },
    [presentRef, changeItem],
  )

  // Set an item's distance from the desk's left/back edges exactly.
  const setItemEdgeOffsets = useCallback(
    (id, { fromLeft, fromBack }) => {
      const setup = presentRef.current
      const item = setup.items.find((i) => i.id === id)
      if (!item) return false
      const current = getEdgeOffsets(setup.desk, item)
      const dx = fromLeft === undefined ? 0 : fromLeft - current.fromLeft
      const dz = fromBack === undefined ? 0 : fromBack - current.fromBack
      return nudgeItem(id, dx, dz)
    },
    [presentRef, nudgeItem],
  )

  return {
    desk,
    items,
    history,
    updateDesk,
    changeItem,
    addItem,
    deleteItem,
    duplicateItem,
    rotateItem,
    nudgeItem,
    setItemEdgeOffsets,
  }
}
