import { useState } from 'react'
import NameForm from './NameForm.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { BACKEND_READY, linkGitHub, signOut } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// "Join" (pick a name or use GitHub), or your name and a sign-out button.
// Guests also get a way to keep their account by linking GitHub.
export default function AuthButton() {
  const user = useAuth()
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)

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

  function leave() {
    // A guest who signs out can't get back in to that account.
    if (user.isGuest && !confirmingSignOut) {
      setConfirmingSignOut(true)
      return
    }
    run(signOut)
  }

  return (
    <div className="auth">
      {error && <span className="auth-error">{error}</span>}
      {user ? (
        <>
          <span className="auth-user">
            {user.avatarUrl && <img className="avatar" src={user.avatarUrl} alt="" />}@{user.username}
            {user.isGuest && <span className="tag">Guest</span>}
          </span>
          {user.isGuest && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => run(linkGitHub)}
              title="Guests are tied to this browser. Link GitHub to keep your stuff anywhere."
            >
              Keep my stuff
            </button>
          )}
          <button type="button" className="btn btn-small" onClick={leave} onBlur={() => setConfirmingSignOut(false)}>
            {confirmingSignOut ? 'Sure? Guest stuff is lost' : 'Sign out'}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-small btn-accent"
          onClick={() => {
            playSfx('click')
            setJoining(true)
          }}
        >
          Join
        </button>
      )}
      {joining && !user && <JoinDialog onClose={() => setJoining(false)} />}
    </div>
  )
}

function JoinDialog({ onClose }) {
  useKeyboardShortcuts((event) => {
    if (event.key === 'Escape') onClose()
  })
  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal panel" role="dialog" aria-labelledby="join-title">
        <div className="inspector-head">
          <h2 id="join-title">Join the fun</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <NameForm onDone={onClose} />
      </div>
    </div>
  )
}
