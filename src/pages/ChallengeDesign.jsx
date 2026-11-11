import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Planner from './Planner.jsx'
import { BACKEND_READY, getRoom } from '../data/storage.js'

// /r/:code/design: the planner, designing an entry for that room.
export default function ChallengeDesign() {
  const { code } = useParams()
  const [room, setRoom] = useState(undefined) // undefined = loading, null = not found
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!BACKEND_READY) return
    let ignore = false
    getRoom(code)
      .then((found) => !ignore && setRoom(found))
      .catch((err) => !ignore && setError(err.message))
    return () => {
      ignore = true
    }
  }, [code])

  if (!BACKEND_READY || error || room === null) {
    return (
      <div className="board">
        <div className="board-empty panel">
          <h2>{room === null ? 'No room with that code' : 'Couldn’t open this room'}</h2>
          <p>{error || (room === null ? 'Double-check the link.' : 'The board isn’t connected yet.')}</p>
          <Link to="/" className="btn">
            Go to the planner
          </Link>
        </div>
      </div>
    )
  }

  if (room === undefined) return <p className="hint page-loading">Opening the room…</p>
  return <Planner key={room.code} challenge={room} />
}
