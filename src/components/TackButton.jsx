import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { toggleTack } from '../data/storage.js'
import { playSfx } from '../sfx.js'

// A pixel-art thumbtack, drawn on an 8×8 grid.
export function TackIcon({ size = 16 }) {
  return (
    <svg className="tack-icon" width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="2" y="0" width="4" height="1" fill="var(--ink)" />
      <rect x="2" y="1" width="4" height="3" fill="var(--accent-2)" />
      <rect x="3" y="1" width="1" height="2" fill="#fff" opacity="0.7" />
      <rect x="1" y="4" width="6" height="1" fill="var(--ink)" />
      <rect x="3" y="5" width="2" height="1" fill="var(--ink-soft)" />
      <rect x="3.5" y="6" width="1" height="2" fill="var(--ink-soft)" />
    </svg>
  )
}

// Tack a setup (the board's currency), or take your tack back. Shows the
// count. Works inside a card link without opening it.
export default function TackButton({ card, size = 'small' }) {
  const user = useAuth()
  const [state, setState] = useState({ tacked: card.tackedByMe, tacks: card.tacks })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const isMine = user?.id === card.ownerId

  useEffect(() => setState({ tacked: card.tackedByMe, tacks: card.tacks }), [card.tackedByMe, card.tacks])

  async function toggle(event) {
    event.preventDefault()
    event.stopPropagation()
    setError(null)
    if (!user) {
      setError('Join (top right) to tack.')
      return
    }
    if (isMine) {
      setError('Can’t tack your own.')
      return
    }
    setBusy(true)
    // Show it right away; the server has the final say.
    const before = state
    setState({ tacked: !before.tacked, tacks: before.tacks + (before.tacked ? -1 : 1) })
    playSfx(before.tacked ? 'click' : 'place')
    try {
      setState(await toggleTack(card.id))
    } catch (err) {
      setState(before)
      setError(err.message)
    }
    setBusy(false)
  }

  const label = `${state.tacks} ${state.tacks === 1 ? 'tack' : 'tacks'}`
  return (
    <span className="tack-wrap">
      <button
        type="button"
        className={`tack-btn ${size === 'big' ? 'is-big' : ''} ${state.tacked ? 'is-tacked' : ''}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={state.tacked}
        title={state.tacked ? 'Take your tack back' : isMine ? label : 'Tack it! (pin it to the board)'}
        aria-label={`${state.tacked ? 'Untack' : 'Tack'} (${label})`}
      >
        <TackIcon size={size === 'big' ? 22 : 16} />
        <span>{state.tacks}</span>
      </button>
      {error && <span className="tack-error">{error}</span>}
    </span>
  )
}
