import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NameForm from './NameForm.jsx'
import { ASSETS, CATEGORIES, getAsset } from '../assets/library.js'
import { useAuth } from '../hooks/useAuth.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { BACKEND_READY, createRoom } from '../data/storage.js'
import { playSfx } from '../sfx.js'

const MAX_WISHES = 30

// Start a challenge: your current room and desk become the "base" that
// friends design on top of, plus a wishlist of what you want. Ends with a
// link to send them.
export default function ChallengeDialog({ setup, takePicture, onClose }) {
  const user = useAuth()
  const [picture, setPicture] = useState(null) // { blob, url }
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [wishlist, setWishlist] = useState([]) // [{ assetId, label, qty }]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [code, setCode] = useState(null) // set once the room exists

  // Same as publishing: wait two frames so the scene has redrawn, then take a picture.
  useEffect(() => {
    let url = null
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        try {
          const blob = await takePicture()
          url = URL.createObjectURL(blob)
          setPicture({ blob, url })
        } catch (err) {
          setError(err.message)
        }
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      if (url) URL.revokeObjectURL(url)
    }
  }, [takePicture])

  useKeyboardShortcuts((event) => {
    if (event.key === 'Escape' && !busy) onClose()
  })

  async function create(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const roomCode = await createRoom({
        title: title.trim(),
        brief: brief.trim(),
        wishlist,
        base: setup,
        thumbnail: picture.blob,
      })
      playSfx('publish')
      setCode(roomCode)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      {code ? (
        <ShareRoom code={code} title={title.trim()} onClose={onClose} />
      ) : (
        <form className="modal panel" onSubmit={create} aria-labelledby="challenge-title">
          <div className="inspector-head">
            <h2 id="challenge-title">Start a challenge</h2>
            <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
              ×
            </button>
          </div>
          <p className="hint">
            Friends get a link, start from this exact room and desk (they can&apos;t move what&apos;s already here), and
            design something for you. You crown your favorite.
          </p>

          <div className="publish-preview">
            {picture ? <img src={picture.url} alt="Your room as it is now" /> : <span>Taking a picture…</span>}
          </div>

          {!BACKEND_READY ? (
            <p className="notice">Challenges need the backend, which isn&apos;t set up yet (see supabase/README.md).</p>
          ) : user === null ? (
            <NameForm prompt="Pick a name so friends know whose desk this is." />
          ) : (
            <>
              <label className="field">
                <span className="field-label">Title</span>
                <input
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={60}
                  placeholder="Help me set up my dorm desk"
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="field-label">The brief (optional)</span>
                <textarea
                  className="input"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  maxLength={280}
                  rows={2}
                  placeholder="Small room, I game and study, love plants, budget-ish."
                />
              </label>
              <WishlistEditor wishlist={wishlist} onChange={setWishlist} />
            </>
          )}

          {error && <p className="inspector-warning">{error}</p>}

          {BACKEND_READY && user && (
            <button type="submit" className="btn btn-accent" disabled={busy || !picture || !title.trim()}>
              {busy ? 'Making the room…' : 'Make my challenge link'}
            </button>
          )}
        </form>
      )}
    </div>
  )
}

// Build the wishlist: library items (with how many), or free-text ideas.
function WishlistEditor({ wishlist, onChange }) {
  const [assetId, setAssetId] = useState('')
  const [idea, setIdea] = useState('')
  const full = wishlist.length >= MAX_WISHES

  function addAsset(id) {
    if (!id) return
    playSfx('click')
    const existing = wishlist.find((wish) => wish.assetId === id)
    if (existing) onChange(wishlist.map((wish) => (wish === existing ? { ...wish, qty: Math.min(9, wish.qty + 1) } : wish)))
    else if (!full) onChange([...wishlist, { assetId: id, label: getAsset(id).name, qty: 1 }])
    setAssetId('')
  }

  function addIdea() {
    const label = idea.trim()
    if (!label || full) return
    playSfx('click')
    onChange([...wishlist, { assetId: null, label, qty: 1 }])
    setIdea('')
  }

  const setQty = (index, qty) =>
    onChange(qty < 1 ? wishlist.filter((_, i) => i !== index) : wishlist.map((wish, i) => (i === index ? { ...wish, qty } : wish)))

  return (
    <div className="field">
      <span className="field-label">What you want ({wishlist.length}/{MAX_WISHES})</span>
      {wishlist.length > 0 && (
        <ul className="wishlist">
          {wishlist.map((wish, index) => (
            <li key={`${wish.assetId}-${wish.label}`} className="wish">
              <span className="wish-label">
                {wish.label}
                {!wish.assetId && <span className="tag">Idea</span>}
              </span>
              {wish.assetId && (
                <span className="wish-qty">
                  <button type="button" className="btn btn-small" onClick={() => setQty(index, wish.qty - 1)} aria-label="One fewer">
                    −
                  </button>
                  <strong>{wish.qty}</strong>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setQty(index, Math.min(9, wish.qty + 1))}
                    aria-label="One more"
                  >
                    +
                  </button>
                </span>
              )}
              <button type="button" className="icon-btn" onClick={() => setQty(index, 0)} aria-label={`Remove ${wish.label}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="name-form-row">
        <select
          className="input"
          value={assetId}
          onChange={(event) => addAsset(event.target.value)}
          aria-label="Add an item from the library"
          disabled={full}
        >
          <option value="">+ Add an item…</option>
          {CATEGORIES.map((category) => (
            <optgroup key={category} label={category}>
              {ASSETS.filter((asset) => asset.category === category).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="name-form-row">
        <input
          className="input"
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addIdea()
            }
          }}
          maxLength={60}
          placeholder="Or an idea: somewhere for my guitar"
          aria-label="Add an idea"
          disabled={full}
        />
        <button type="button" className="btn" onClick={addIdea} disabled={full || !idea.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

// The room exists: copy or share the link.
export function ShareRoom({ code, title, onClose }) {
  const url = `${window.location.origin}/r/${code}`
  const [copied, setCopied] = useState(false)
  const text = `Design my desk! ${title}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      playSfx('place')
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="modal panel" role="dialog" aria-labelledby="share-title">
      <div className="inspector-head">
        <h2 id="share-title">Your challenge is live!</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="hint">Send this to your friends. Anyone with the link can join and design for you.</p>
      <div className="share-link">
        <input className="input" value={url} readOnly onFocus={(event) => event.target.select()} aria-label="Challenge link" />
        <button type="button" className="btn btn-accent" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="room-code">
        Room code <strong>{code.toUpperCase()}</strong>
      </p>
      <div className="inspector-actions">
        {typeof navigator.share === 'function' && (
          <button type="button" className="btn" onClick={() => navigator.share({ title: text, text, url }).catch(() => {})}>
            Share…
          </button>
        )}
        <Link to={`/r/${code}`} className="btn btn-accent" onClick={onClose}>
          Go to the room →
        </Link>
      </div>
    </div>
  )
}
