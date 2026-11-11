import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NameForm from '../components/NameForm.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { BACKEND_READY, listMyRooms } from '../data/storage.js'

// Challenge rooms you made and rooms you joined, plus a box to jump into a
// room by its code.
export default function RoomsPage() {
  const user = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState(null)
  const [error, setError] = useState(null)
  const [code, setCode] = useState('')

  const userId = user?.id
  useEffect(() => {
    if (!BACKEND_READY || !userId) return
    let ignore = false
    listMyRooms()
      .then((found) => !ignore && setRooms(found))
      .catch((err) => !ignore && setError(err.message))
    return () => {
      ignore = true
    }
  }, [userId])

  if (!BACKEND_READY) {
    return (
      <div className="board">
        <div className="board-empty panel">
          <h2>Rooms aren&apos;t connected yet</h2>
          <p>They need a Supabase project. Follow supabase/README.md, then restart the dev server.</p>
        </div>
      </div>
    )
  }

  const cleanCode = code.trim().toLowerCase()

  return (
    <div className="board">
      <div className="board-head">
        <h1>Rooms</h1>
        <form
          className="name-form-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (cleanCode) navigate(`/r/${cleanCode}`)
          }}
        >
          <input
            className="input room-code-input"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={6}
            placeholder="ROOM CODE"
            aria-label="Room code"
          />
          <button type="submit" className="btn" disabled={cleanCode.length !== 6}>
            Join
          </button>
        </form>
      </div>

      <p className="hint">
        Start a challenge from the <Link to="/">planner</Link>: set up your room and desk, hit <strong>Challenge</strong>,
        and send the link to friends.
      </p>

      {user === undefined ? null : user === null ? (
        <div className="board-empty panel">
          <NameForm prompt="Pick a name to see your rooms." />
        </div>
      ) : error ? (
        <p className="inspector-warning">{error}</p>
      ) : !rooms ? (
        <p className="hint">Loading rooms…</p>
      ) : (
        <>
          <RoomList title="Your challenges" rooms={rooms.created} empty="You haven't started one yet." />
          <RoomList title="Rooms you joined" rooms={rooms.joined} empty="Open a friend's link to join their room." />
        </>
      )}
    </div>
  )
}

function RoomList({ title, rooms, empty }) {
  return (
    <section className="room-list">
      <h2>{title}</h2>
      {rooms.length === 0 ? (
        <p className="hint">{empty}</p>
      ) : (
        <div className="masonry">
          {rooms.map((room, index) => (
            <Link key={room.id} to={`/r/${room.code}`} className="setup-card panel" style={{ '--i': index }}>
              <div className="setup-card-picture">
                {room.thumbnailUrl && <img className="setup-card-image" src={room.thumbnailUrl} alt="" loading="lazy" />}
                {room.winnerId && <span className="pick-badge">👑 Winner picked</span>}
              </div>
              <div className="setup-card-body">
                <div className="setup-card-title-row">
                  <h3>{room.title}</h3>
                  <span className="points">{room.entryCount} {room.entryCount === 1 ? 'entry' : 'entries'}</span>
                </div>
                <span className="author">
                  @{room.username} · {room.code.toUpperCase()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
