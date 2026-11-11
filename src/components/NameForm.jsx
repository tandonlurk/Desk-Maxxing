import { useState } from 'react'
import { signInAsGuest, signInWithGitHub } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// "What should we call you?": the quickest way in. Picking a name signs you
// in as a guest; GitHub is there for people who want a lasting account.
// `prompt` is the line above the box.
export default function NameForm({ prompt = 'What should we call you?', onDone }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    event.stopPropagation() // may sit inside another form
    setBusy(true)
    setError(null)
    try {
      await signInAsGuest(name)
      playSfx('place')
      onDone?.()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function github() {
    try {
      await signInWithGitHub()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="name-form notice">
      <p>{prompt}</p>
      <form className="name-form-row" onSubmit={submit}>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={24}
          placeholder="Your name"
          aria-label="Your name"
          autoFocus
          required
        />
        <button type="submit" className="btn btn-accent" disabled={busy || !name.trim()}>
          {busy ? 'One sec…' : "Let's go"}
        </button>
      </form>
      {error && <p className="inspector-warning">{error}</p>}
      <p className="hint">
        No account needed.{' '}
        <button type="button" className="link-btn" onClick={github}>
          Or sign in with GitHub
        </button>
      </p>
    </div>
  )
}
