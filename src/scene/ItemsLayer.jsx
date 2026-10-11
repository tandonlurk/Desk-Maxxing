import { useEffect, useRef, useState } from 'react'
import PlacedItem from './PlacedItem.jsx'
import { getAsset } from '../assets/library.js'
import { surfaceHeight } from './placement.js'

const EXIT_TIME = 350 // ms to let a removed item shrink away

// All the items in the scene. Removed items stick around for a moment so
// they can animate out instead of vanishing.
export default function ItemsLayer({ desk, items, selectedId, liftedId, misplacedIds, onItemPointerDown }) {
  const [exiting, setExiting] = useState([])
  const previous = useRef(items)
  const timers = useRef([])

  useEffect(() => {
    const ids = new Set(items.map((item) => item.id))
    const removed = previous.current.filter((item) => !ids.has(item.id))
    previous.current = items
    if (removed.length === 0) return
    setExiting((list) => [...list, ...removed])
    const timer = setTimeout(() => {
      setExiting((list) => list.filter((item) => !removed.includes(item)))
    }, EXIT_TIME)
    timers.current.push(timer)
  }, [items])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // An item that came back (undo) before finishing its exit is just live again.
  const liveIds = new Set(items.map((item) => item.id))
  const leaving = exiting.filter((item) => !liveIds.has(item.id))

  return (
    <group>
      {[...items, ...leaving].map((item) => {
        const asset = getAsset(item.assetId)
        const isLeaving = !liveIds.has(item.id)
        return (
          // Same key while leaving, so the same animation carries on.
          <PlacedItem
            key={item.id}
            item={item}
            asset={asset}
            surfaceY={surfaceHeight(desk, asset)}
            selected={!isLeaving && item.id === selectedId}
            lifted={!isLeaving && item.id === liftedId}
            flagged={!isLeaving && misplacedIds.includes(item.id)}
            exiting={isLeaving}
            onPointerDown={onItemPointerDown}
          />
        )
      })}
    </group>
  )
}
