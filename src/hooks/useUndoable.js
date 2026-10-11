import { useCallback, useRef, useState } from 'react'

const MAX_STEPS = 100

// State with undo and redo.
//
// update(next, { group }) records a change. Changes with the same `group`
// that come close together are merged into ONE undo step, so dragging an
// item or typing "152" counts as a single change, not dozens. Pass
// mergeWindow: Infinity to merge everything in the group (used for drags).
export function useUndoable(initialPresent) {
  const [history, setHistory] = useState(() => ({
    past: [],
    present: initialPresent,
    future: [],
    group: null, // group of the most recent change
    time: 0, // when it happened
  }))

  // Always holds the latest state, for event handlers that need it right now.
  const presentRef = useRef(history.present)
  presentRef.current = history.present

  const update = useCallback((next, { group = null, mergeWindow = 1000 } = {}) => {
    const now = Date.now()
    setHistory((h) => {
      const value = typeof next === 'function' ? next(h.present) : next
      if (value === h.present) return h
      const merge = group !== null && h.group === group && now - h.time < mergeWindow
      return {
        past: merge ? h.past : [...h.past, h.present].slice(-MAX_STEPS),
        present: value,
        future: [],
        group,
        time: now,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      return { past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future], group: null, time: 0 }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), group: null, time: 0 }
    })
  }, [])

  // Throw away the change in progress (e.g. a drag that was cancelled), as if
  // it never happened. Only works if it's still the most recent change.
  const cancelGroup = useCallback((group) => {
    setHistory((h) => {
      if (h.group !== group || h.past.length === 0) return h
      return { ...h, past: h.past.slice(0, -1), present: h.past.at(-1), group: null, time: 0 }
    })
  }, [])

  return {
    present: history.present,
    presentRef,
    update,
    undo,
    redo,
    cancelGroup,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
