import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SetupViewer from '../scene/SetupViewer.jsx'
import { Author } from '../components/SetupCard.jsx'
import TackButton from '../components/TackButton.jsx'
import { tagName } from '../assets/tags.js'
import { getAsset } from '../assets/library.js'
import { useAuth } from '../hooks/useAuth.js'
import { BACKEND_READY, deleteSetup, getRoomLink, getSetup } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// One published setup: walk around it in 3D, see what's on it, and remix it
// into your own planner.
export default function SetupPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuth()
  const [card, setCard] = useState(undefined) // undefined = loading, null = not found
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [roomLink, setRoomLink] = useState(null) // { code, title } when it's a challenge entry

  useEffect(() => {
    if (!BACKEND_READY) return
    let ignore = false
    setCard(undefined)
    getSetup(id)
      .then((found) => !ignore && setCard(found))
      .catch((err) => !ignore && setError(err.message))
    return () => {
      ignore = true
    }
  }, [id])

  const roomId = card?.roomId
  useEffect(() => {
    if (!roomId) return
    getRoomLink(roomId)
      .then(setRoomLink)
      .catch(() => setRoomLink(null))
  }, [roomId])

  // "27-inch monitor ×2", in the order they were added.
  const itemCounts = useMemo(() => {
    const counts = new Map()
    const all = card ? [...card.setup.items, ...card.setup.wallItems] : []
    for (const item of all) counts.set(item.assetId, (counts.get(item.assetId) || 0) + 1)
    return [...counts].map(([assetId, count]) => ({ name: getAsset(assetId).name, count }))
  }, [card])

  if (!BACKEND_READY || error || card === null) {
    return (
      <div className="board">
        <div className="board-empty panel">
          <h2>{card === null ? 'This setup isn’t here anymore' : 'Couldn’t load this setup'}</h2>
          <p>{error || (card === null ? 'It may have been deleted.' : 'The board isn’t connected yet.')}</p>
          <Link to="/explore" className="btn">
            Back to the board
          </Link>
        </div>
      </div>
    )
  }

  if (card === undefined) return <p className="hint page-loading">Loading setup…</p>

  const isMine = user?.id === card.ownerId

  function remix() {
    playSfx('click')
    navigate('/', { state: { remix: { title: card.title, setup: card.setup } } })
  }

  async function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    try {
      await deleteSetup(card)
      playSfx('delete')
      navigate('/explore')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="planner setup-page">
      <section className="planner-stage" aria-label="3D view of this setup">
        <SetupViewer setup={card.setup} />
        <div className="stage-bottom">
          <p className="stage-help">Drag to look around · scroll to zoom</p>
        </div>
      </section>

      <aside className="planner-sidebar panel setup-info">
        <Link to="/explore" className="back-link">
          ← Board
        </Link>
        <h1>{card.title}</h1>
        <Author card={card} />
        {roomLink && (
          <Link to={`/r/${roomLink.code}`} className="made-for">
            Made for the challenge “{roomLink.title}” →
          </Link>
        )}
        {card.description && <p className="setup-description">{card.description}</p>}

        <div className="setup-stats">
          <TackButton card={card} size="big" />
          <span className="points">{card.points} pts</span>
          <span>
            {card.wins} {card.wins === 1 ? 'win' : 'wins'} · {card.losses} {card.losses === 1 ? 'loss' : 'losses'}
          </span>
        </div>

        {card.tags.length > 0 && (
          <div className="setup-card-tags">
            {card.tags.map((tag) => (
              <Link key={tag} to={`/explore?tags=${tag}`} className="tag">
                {tagName(tag)}
              </Link>
            ))}
          </div>
        )}

        <section className="editor-section">
          <h3>In this setup</h3>
          <ul className="item-list">
            {itemCounts.map(({ name, count }) => (
              <li key={name}>
                {name}
                {count > 1 && <span className="item-count">×{count}</span>}
              </li>
            ))}
          </ul>
        </section>

        <button type="button" className="btn btn-accent" onClick={remix}>
          Remix in my planner
        </button>
        {isMine && (
          <button type="button" className="btn btn-danger" onClick={remove} onBlur={() => setConfirmingDelete(false)}>
            {confirmingDelete ? 'Click again to delete for good' : 'Delete'}
          </button>
        )}
      </aside>
    </div>
  )
}
