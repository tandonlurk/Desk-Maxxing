import { useCallback } from 'react'
import { useUndoable } from './useUndoable.js'
import { normalizeDesk } from '../assets/deskOptions.js'
import { normalizeRoom } from '../assets/roomOptions.js'
import { DEFAULT_SETUP } from '../assets/setupShape.js'
import { getAsset } from '../assets/library.js'
import {
  ROTATION_STEP,
  findNearestFree,
  fitItemsToDesk,
  getEdgeOffsets,
  makePlacementChecker,
  normalizeAngle,
} from '../scene/placement.js'
import { findNearestFreeOnWall, findWallHome, makeWallChecker } from '../scene/wallPlacement.js'
import { getSuggestedSpots } from '../scene/spots.js'
import { getSeat, SEAT_DISTANCE } from '../scene/deskGeometry.js'
import { clampDeskInRoom, roomToDesk } from '../scene/roomGeometry.js'

export function makeItemId() {
  return window.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const isWallAsset = (assetId) => getAsset(assetId).placement === 'wall'

// After the room changes, wall items that ended up off their wall (it got
// shorter, or lower) get nudged back on if there's room. Items on a wall
// that was taken away stay where they are (and get flagged).
function fitWallItems(room, wallItems) {
  let result = wallItems
  for (const item of wallItems) {
    if (!room.walls[item.wall]) continue
    const isValid = makeWallChecker(room, result)
    if (isValid(item)) continue
    const spot = findNearestFreeOnWall(isValid, item, 120)
    if (spot) result = result.map((other) => (other.id === item.id ? { ...other, ...spot } : other))
  }
  return result
}

// Everything that changes the setup (the room, the desk, and the things in
// it), with undo/redo. Actions that can fail (no room) return false so the
// page can show a message.
export function useSetupEditor(initialSetup = null) {
  const history = useUndoable(initialSetup || DEFAULT_SETUP)
  const { room, desk, items, wallItems } = history.present
  const { update, presentRef } = history

  const updateDesk = useCallback(
    (changes) => {
      // Typing in a number box merges into one undo step; clicks don't.
      const [key, value] = Object.entries(changes)[0]
      const group = typeof value === 'number' ? `desk-${key}` : null
      update(
        (setup) => {
          const nextDesk = normalizeDesk({ ...setup.desk, ...changes })
          const nextRoom = clampDeskInRoom(setup.room, nextDesk)
          // Items that fell off the edge get nudged back on if there's room.
          return { ...setup, desk: nextDesk, room: nextRoom, items: fitItemsToDesk(nextDesk, setup.items, nextRoom) }
        },
        { group },
      )
    },
    [update],
  )

  // `changes` is either some room fields, or a function from the current
  // room to the next one (for moving the desk around in it).
  const updateRoom = useCallback(
    (changes, { group = null } = {}) => {
      update(
        (setup) => {
          const next = typeof changes === 'function' ? changes(setup.room, setup.desk) : { ...setup.room, ...changes }
          const nextRoom = clampDeskInRoom(normalizeRoom(next), setup.desk)
          return {
            ...setup,
            room: nextRoom,
            items: fitItemsToDesk(setup.desk, setup.items, nextRoom),
            wallItems: fitWallItems(nextRoom, setup.wallItems),
          }
        },
        { group },
      )
    },
    [update],
  )

  // Paint a wall ('back' | 'left' | 'right') or the floor.
  const paint = useCallback(
    (target, color) => {
      update((setup) => {
        const current = target === 'floor' ? setup.room.floor.color : setup.room.paint[target]
        if (current === color) return setup
        const nextRoom =
          target === 'floor'
            ? { ...setup.room, floor: { ...setup.room.floor, color } }
            : { ...setup.room, paint: { ...setup.room.paint, [target]: color } }
        return { ...setup, room: nextRoom }
      })
    },
    [update],
  )

  // Replace one item (desk, floor, or wall). `group` merges repeated changes
  // into one undo step.
  const changeItem = useCallback(
    (id, changes, options) => {
      const replace = (list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item))
      update((setup) => ({ ...setup, items: replace(setup.items), wallItems: replace(setup.wallItems) }), options)
    },
    [update],
  )

  // Where a new item should go when it's clicked in the library: its first
  // free suggested spot, or else the nearest free space to the middle front
  // of the desk (or beside the desk, for floor items).
  const findHomeFor = useCallback((setup, assetId) => {
    const asset = getAsset(assetId)
    const spot = getSuggestedSpots(setup.desk, setup.items, asset, null, setup.room).find((s) => s.free)
    if (spot) return { position: spot.position, rotation: spot.rotation }

    const seat = getSeat(setup.desk)
    const rotation = 0
    const start =
      asset.placement === 'floor'
        ? { x: setup.desk.width / 2 + 10 + asset.size.width / 2, z: 0 }
        : { x: seat.x + seat.dirX * (SEAT_DISTANCE + 25), z: seat.z + seat.dirZ * (SEAT_DISTANCE + 25) }
    const isValid = makePlacementChecker(setup.desk, setup.items, setup.room)
    const candidate = (position) => ({ id: null, assetId, position, rotation })
    let position = findNearestFree(isValid, candidate(start), 250)
    // Big floor things (beds, shelves) may only fit across the room: search
    // outward from the middle of the room, as far as the room goes.
    if (!position && asset.placement === 'floor') {
      const reach = Math.hypot(setup.room.width, setup.room.depth) / 2
      position = findNearestFree(isValid, candidate(roomToDesk(setup.room, { x: 0, z: 0 })), reach)
    }
    return position ? { position, rotation } : null
  }, [])

  // Add a wall item at `mount` ({ wall, u, y }), or wherever there's room.
  // Returns the new item's id, or null if there's no room.
  const addWallItem = useCallback(
    (assetId, mount = null, options = {}) => {
      const setup = presentRef.current
      const home = mount || findWallHome(setup.room, setup.desk, setup.wallItems, assetId)
      if (!home) return null
      const asset = getAsset(assetId)
      const item = {
        id: options.id || makeItemId(),
        assetId,
        wall: home.wall,
        u: home.u,
        y: home.y,
        color: asset.colorOptions[0].value,
      }
      update((s) => ({ ...s, wallItems: [...s.wallItems, item] }), options)
      return item.id
    },
    [update, presentRef],
  )

  // Add an item. If no position is given, find a good home for it.
  // Returns the new item's id, or null if there's no room.
  const addItem = useCallback(
    (assetId, placement = null, options = {}) => {
      if (isWallAsset(assetId)) return addWallItem(assetId, placement, options)
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
    [update, presentRef, findHomeFor, addWallItem],
  )

  const deleteItem = useCallback(
    (id) =>
      update((setup) => ({
        ...setup,
        items: setup.items.filter((item) => item.id !== id),
        wallItems: setup.wallItems.filter((item) => item.id !== id),
      })),
    [update],
  )

  // Copy an item into the nearest free space next to it.
  const duplicateItem = useCallback(
    (id) => {
      const setup = presentRef.current
      const onWall = setup.wallItems.find((item) => item.id === id)
      if (onWall) {
        const copy = { ...onWall, id: makeItemId(), u: onWall.u + 8 }
        const spot = findNearestFreeOnWall(makeWallChecker(setup.room, setup.wallItems), copy, 200)
        if (!spot) return null
        update((s) => ({ ...s, wallItems: [...s.wallItems, { ...copy, ...spot }] }))
        return copy.id
      }
      const original = setup.items.find((item) => item.id === id)
      if (!original) return null
      const copy = {
        ...original,
        id: makeItemId(),
        position: { x: original.position.x + 8, z: original.position.z + 8 },
      }
      const position = findNearestFree(makePlacementChecker(setup.desk, setup.items, setup.room), copy, 200)
      if (!position) return null
      update((s) => ({ ...s, items: [...s.items, { ...copy, position }] }))
      return copy.id
    },
    [update, presentRef],
  )

  // Turn an item by `delta` degrees (snapped to 15° unless `free`). If it no
  // longer fits where it is, it shuffles to the nearest free space. Wall
  // items always face into the room, so they don't turn.
  const rotateItem = useCallback(
    (id, delta, { free = false } = {}) => {
      const setup = presentRef.current
      const item = setup.items.find((i) => i.id === id)
      if (!item) return false
      let rotation = normalizeAngle(item.rotation + delta)
      if (!free) rotation = normalizeAngle(Math.round(rotation / ROTATION_STEP) * ROTATION_STEP)
      const turned = { ...item, rotation }
      const position = findNearestFree(makePlacementChecker(setup.desk, setup.items, setup.room), turned, 40)
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
      if (!makePlacementChecker(setup.desk, setup.items, setup.room)(moved)) return false
      changeItem(id, { position: moved.position }, { group: `nudge-${id}` })
      return true
    },
    [presentRef, changeItem],
  )

  // Move a wall item along its wall (du) and up/down (dy), if that's free.
  const nudgeWallItem = useCallback(
    (id, du, dy) => {
      const setup = presentRef.current
      const item = setup.wallItems.find((i) => i.id === id)
      if (!item) return false
      const moved = { ...item, u: item.u + du, y: item.y + dy }
      if (!makeWallChecker(setup.room, setup.wallItems)(moved)) return false
      changeItem(id, { u: moved.u, y: moved.y }, { group: `nudge-${id}` })
      return true
    },
    [presentRef, changeItem],
  )

  // Put a wall item at an exact spot ({ u, y }, either may be missing).
  const setWallItemSpot = useCallback(
    (id, spot) => {
      const item = presentRef.current.wallItems.find((i) => i.id === id)
      if (!item) return false
      return nudgeWallItem(id, (spot.u ?? item.u) - item.u, (spot.y ?? item.y) - item.y)
    },
    [presentRef, nudgeWallItem],
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

  // Swap in a whole different setup (e.g. remixing one from the board), as one undo step.
  const replaceSetup = useCallback((setup) => update(setup), [update])

  return {
    room,
    desk,
    items,
    wallItems,
    history,
    replaceSetup,
    updateDesk,
    updateRoom,
    paint,
    changeItem,
    addItem,
    addWallItem,
    deleteItem,
    duplicateItem,
    rotateItem,
    nudgeItem,
    nudgeWallItem,
    setWallItemSpot,
    setItemEdgeOffsets,
  }
}

