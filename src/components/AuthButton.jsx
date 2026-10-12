import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { BACKEND_READY, signInWithGitHub, signOut } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// "Sign in with GitHub", or your avatar and a sign-out button.
export default function AuthButton() {
  const user = useAuth()
  const [error, setError] = useState(null)

  if (!BACKEND_READY || user === undefined) return null

  async function run(action) {
    playSfx('click')
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth">
      {error && <span className="auth-error">{error}</span>}
      {user ? (
        <>
          <span className="auth-user">
            {user.avatarUrl && <img className="avatar" src={user.avatarUrl} alt="" />}@{user.username}
          </span>
          <button type="button" className="btn btn-small" onClick={() => run(signOut)}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-small btn-accent" onClick={() => run(signInWithGitHub)}>
          Sign in with GitHub
        </button>
      )}
    </div>
  )
}
