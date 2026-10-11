import { useCallback, useEffect, useState } from 'react'

// A short friendly message that disappears on its own.
export function useMessage(duration = 2800) {
  const [message, setMessage] = useState(null) // { text, id }

  const notify = useCallback((text) => setMessage({ text, id: Date.now() }), [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), duration)
    return () => clearTimeout(timer)
  }, [message, duration])

  return [message, notify]
}
