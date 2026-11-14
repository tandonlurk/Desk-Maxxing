import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { playSfx } from '../sfx.js'

// The first screen: start a setup, or join a friend's challenge room.
export default function Landing() {
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const cleanCode = code.trim().toLowerCase()

  return (
    <div className="landing">
      <span className="logo-mark logo-mark-xl" aria-hidden="true" />
      <h1 className="brand" aria-label="No it HAS to go there">
        <span className="brand-row" aria-hidden="true">
          <span className="w-no">NO</span>
          <span className="w-it">IT</span>
        </span>
        <span className="w-has" aria-hidden="true">
          HAS
        </span>
        <span className="brand-row" aria-hidden="true">
          <span className="w-to">TO</span>
          <span className="w-go">GO</span>
          <span className="w-there">THERE</span>
        </span>
      </h1>
      <div className="landing-actions">
        <button
          type="button"
          className="btn btn-accent landing-btn"
          onClick={() => {
            playSfx('click')
            navigate('/plan')
          }}
        >
          Create a setup
        </button>
        {joining ? (
          <form
            className="landing-join"
            onSubmit={(event) => {
              event.preventDefault()
              if (cleanCode.length === 6) navigate(`/r/${cleanCode}`)
            }}
          >
            <input
              className="input room-code-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={6}
              placeholder="ROOM CODE"
              aria-label="Room code"
              autoFocus
            />
            <button type="submit" className="btn landing-go" disabled={cleanCode.length !== 6}>
              Go
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="btn landing-btn"
            onClick={() => {
              playSfx('click')
              setJoining(true)
            }}
          >
            Join a room
          </button>
        )}
      </div>
      <Link to="/explore" className="landing-link">
        Explore setups →
      </Link>
    </div>
  )
}
