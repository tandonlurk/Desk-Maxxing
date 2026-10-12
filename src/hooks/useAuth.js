import { useEffect, useState } from 'react'
import { onAuthChange } from '../data/storage.js'

// The signed-in user ({ id, username, avatarUrl }), null when signed out, or
// undefined while still checking.
export function useAuth() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthChange(setUser), [])
  return user
}
