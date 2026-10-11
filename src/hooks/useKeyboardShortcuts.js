import { useEffect, useRef } from 'react'

// Calls handler(event) for key presses anywhere on the page, except while
// typing in a text box (so Backspace edits the text instead of deleting
// the selected item).
export function useKeyboardShortcuts(handler) {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (typing) return
      latest.current(event)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
