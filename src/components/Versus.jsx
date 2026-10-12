import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Author } from './SetupCard.jsx'
import { tagName } from '../assets/tags.js'
import { castVote, getMatchup } from '../data/storage.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { playSfx } from '../sfx.js'

const NEXT_PAIR_DELAY = 1200 // ms to enjoy the result before the next pair

// 1v1: two setups (matching the chosen tags) side by side. Pick the one you'd
// rather sit at; the winner takes points from the loser. Points stay hidden
// until you vote, so they don't sway you.
export default function Versus({ tags }) {
  const [pair, setPair] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | voting | done | empty | error
  const [result, setResult] = useState(null) // { winnerId, delta, winnerPoints, loserPoints }
  const [error, setError] = useState(null)
  const request = useRef(0)
  const timer = useRef(null)
  const tagsKey = tags.join(',')

  const load = useCallback(async () => {
    const id = ++request.current
    clearTimeout(timer.current)
    setStatus('loading')
    setResult(null)
    setError(null)
    try {
      const next = await getMatchup(tagsKey ? tagsKey.split(',') : [])
      if (id !== request.current) return
      setPair(next)
      setStatus(next.length === 2 ? 'ready' : 'empty')
    } catch (err) {
      if (id !== request.current) return
      setError(err.message)
      setStatus('error')
    }
  }, [tagsKey])

  useEffect(() => {
    load()
    return () => clearTimeout(timer.current)
  }, [load])

  async function vote(winner, loser) {
    if (status !== 'ready') return
    setStatus('voting')
    try {
      const outcome = await castVote(winner.id, loser.id)
      playSfx('vote')
      setResult({ winnerId: winner.id, ...outcome })
      setStatus('done')
      timer.current = setTimeout(load, NEXT_PAIR_DELAY)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  useKeyboardShortcuts((event) => {
    if (status !== 'ready' || pair.length < 2) return
    if (event.key === 'ArrowLeft') vote(pair[0], pair[1])
    else if (event.key === 'ArrowRight') vote(pair[1], pair[0])
    else if (event.key.toLowerCase() === 's') load()
  })

  if (status === 'empty') {
    return (
      <div className="board-empty panel">
        <h2>No matchups left{tags.length > 0 ? ' for these tags' : ''}</h2>
        <p>
          {tags.length > 0
            ? 'Try different tags, or clear them to see everything.'
            : 'You’ve voted on every pair (or there aren’t two setups yet). Publish yours from the planner!'}
        </p>
      </div>
    )
  }

  return (
    <div className="versus">
      <p className="versus-prompt">Which desk would you rather sit at?</p>
      <div className="versus-pair">
        {pair.length === 2 ? (
          <>
            <Contender card={pair[0]} other={pair[1]} side="left" status={status} result={result} onPick={vote} />
            <span className="versus-badge" aria-hidden="true">
              VS
            </span>
            <Contender card={pair[1]} other={pair[0]} side="right" status={status} result={result} onPick={vote} />
          </>
        ) : (
          <p className="hint">Finding a matchup…</p>
        )}
      </div>
      <div className="versus-footer">
        {error ? <p className="inspector-warning">{error}</p> : <p className="hint">← / → to pick · S to skip</p>}
        <button type="button" className="btn btn-small" onClick={load} disabled={status === 'loading' || status === 'voting'}>
          {status === 'error' ? 'Try another pair' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

function Contender({ card, other, side, status, result, onPick }) {
  const won = result?.winnerId === card.id
  const lost = result && !won
  const points = won ? result.winnerPoints : lost ? result.loserPoints : null
  const className = `contender panel ${won ? 'is-winner' : ''} ${lost ? 'is-loser' : ''} ${status === 'loading' ? 'is-loading' : ''}`

  return (
    <div className={className}>
      <button
        type="button"
        className="contender-pick"
        onClick={() => onPick(card, other)}
        disabled={status !== 'ready'}
        aria-label={`Pick ${card.title} (${side})`}
      >
        {card.thumbnailUrl && <img src={card.thumbnailUrl} alt="" />}
        <span className="contender-body">
          <span className="contender-title">{card.title}</span>
          <Author card={card} />
          <span className="setup-card-tags">
            {card.tags.map((tag) => (
              <span key={tag} className="tag">
                {tagName(tag)}
              </span>
            ))}
          </span>
        </span>
      </button>
      {result && (
        <div className="contender-after">
          <span className={`contender-result ${won ? 'is-up' : 'is-down'}`}>
            {won ? `+${result.delta}` : `−${result.delta}`} · {points} pts
          </span>
          <Link to={`/s/${card.id}`}>See it in 3D →</Link>
        </div>
      )}
    </div>
  )
}
