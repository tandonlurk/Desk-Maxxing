import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SetupViewer from '../scene/SetupViewer.jsx'
import SetupCard, { Author } from '../components/SetupCard.jsx'
import NameForm from '../components/NameForm.jsx'
import { ShareRoom } from '../components/ChallengeDialog.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { BACKEND_READY, crownEntry, deleteRoom, getRoom, joinRoom, listEntries } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// A challenge room: the creator's base in 3D, their brief and wishlist, and
// everyone's entries (most tacked first). Friends hit "Design for …";
// the creator crowns a winner.
export default function RoomPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const user = useAuth()
  const [room, setRoom] = useState(undefined) // undefined = loading, null = not found
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const loadEntries = useCallback((roomId) => {
    listEntries(roomId)
      .then(setEntries)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!BACKEND_READY) return
    let ignore = false
    setRoom(undefined)
    getRoom(code)
      .then((found) => {
        if (ignore) return
        setRoom(found)
        if (found) loadEntries(found.id)
      })
      .catch((err) => !ignore && setError(err.message))
    return () => {
      ignore = true
    }
  }, [code, loadEntries])

  // Once you're signed in, remember you're in this room (for My rooms).
  // Tacks shown on entries depend on who's looking, so reload them too.
  const userId = user?.id
  useEffect(() => {
    if (!room || !userId) return
    if (room.ownerId !== userId) joinRoom(room.id).catch(() => {})
    loadEntries(room.id)
  }, [room, userId, loadEntries])

  useKeyboardShortcuts((event) => {
    if (event.key === 'Escape') setSharing(false)
  })

  if (!BACKEND_READY || error || room === null) {
    return (
      <div className="board">
        <div className="board-empty panel">
          <h2>{room === null ? 'No room with that code' : 'Couldn’t load this room'}</h2>
          <p>{error || (room === null ? 'Double-check the link, or ask for a new one.' : 'The board isn’t connected yet.')}</p>
          <Link to="/" className="btn">
            Go to the planner
          </Link>
        </div>
      </div>
    )
  }

  if (room === undefined) return <p className="hint page-loading">Opening the room…</p>

  const isCreator = user?.id === room.ownerId
  const myEntry = entries?.find((entry) => entry.ownerId === user?.id)

  async function crown(entryId) {
    const next = room.winnerId === entryId ? null : entryId
    try {
      await crownEntry(room.id, next)
      playSfx(next ? 'publish' : 'click')
      setRoom({ ...room, winnerId: next })
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    try {
      await deleteRoom(room)
      playSfx('delete')
      navigate('/rooms')
    } catch (err) {
      setError(err.message)
    }
  }

  // The winner goes first, then by tacks.
  const sorted = entries && [...entries].sort((a, b) => (b.id === room.winnerId) - (a.id === room.winnerId))

  return (
    <div className="room-page">
      <div className="planner room-top">
        <section className="planner-stage" aria-label="3D view of the base">
          <SetupViewer setup={room.base} />
          <div className="stage-bottom">
            <p className="stage-help">The base: drag to look around · scroll to zoom</p>
          </div>
        </section>

        <aside className="planner-sidebar panel setup-info">
          <Link to="/rooms" className="back-link">
            ← My rooms
          </Link>
          <span className="room-code">
            Room <strong>{room.code.toUpperCase()}</strong>
          </span>
          <h1>{room.title}</h1>
          <Author card={room} />
          {room.brief && <p className="setup-description">{room.brief}</p>}

          {room.wishlist.length > 0 && (
            <section className="editor-section">
              <h3>Wishlist</h3>
              <ul className="item-list">
                {room.wishlist.map((wish) => (
                  <li key={`${wish.assetId}-${wish.label}`}>
                    {wish.label}
                    {wish.qty > 1 && <span className="item-count">×{wish.qty}</span>}
                    {!wish.assetId && <span className="item-count">(idea)</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="editor-section">
            {user === null ? (
              <NameForm prompt={`Want to design for @${room.username}? Pick a name.`} />
            ) : (
              <Link to={`/r/${room.code}/design`} className="btn btn-accent" onClick={() => playSfx('click')}>
                {isCreator ? 'Try designing on your base' : myEntry ? 'Keep working on my entry' : `Design for @${room.username}`}
              </Link>
            )}
            <button type="button" className="btn" onClick={() => setSharing(true)}>
              Invite friends
            </button>
            {isCreator && (
              <button type="button" className="btn btn-danger" onClick={remove} onBlur={() => setConfirmingDelete(false)}>
                {confirmingDelete ? 'Click again: entries stay on the board' : 'Delete room'}
              </button>
            )}
          </section>
        </aside>
      </div>

      <section className="room-entries">
        <div className="board-head">
          <h2>
            Entries {entries ? `(${entries.length})` : ''}
          </h2>
          {isCreator && entries?.length > 0 && <p className="hint">Crown your favorite to make it the winner.</p>}
        </div>
        {!entries ? (
          <p className="hint">Loading entries…</p>
        ) : entries.length === 0 ? (
          <div className="board-empty panel">
            <h2>No entries yet</h2>
            <p>{isCreator ? 'Send the link to your friends!' : 'Be the first to design something.'}</p>
          </div>
        ) : (
          <div className="masonry">
            {sorted.map((entry, index) => (
              <SetupCard
                key={entry.id}
                card={entry}
                index={index}
                badge={entry.id === room.winnerId ? '👑 Creator’s pick' : null}
                extra={
                  isCreator && (
                    <button
                      type="button"
                      className={`btn btn-small ${entry.id === room.winnerId ? 'is-active' : ''}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        crown(entry.id)
                      }}
                    >
                      {entry.id === room.winnerId ? 'Un-crown' : '👑 Crown it'}
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {sharing && (
        <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && setSharing(false)}>
          <ShareRoom code={room.code} title={room.title} onClose={() => setSharing(false)} />
        </div>
      )}
    </div>
  )
}
