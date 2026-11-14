import { Link } from 'react-router-dom'
import { hasLimits } from '../assets/challengeRules.js'
import { Author } from './SetupCard.jsx'
import { playSfx } from '../sfx.js'

// The challenge brief while you design: what the creator wants, ticking off
// as you place things. Clicking a library wish drops one in.
// `placed` maps assetId → how many you've added (not counting the base).
export default function WishlistPanel({ challenge, placed, onAdd }) {
  const wanted = challenge.wishlist.filter((wish) => wish.assetId)
  const done = wanted.filter((wish) => (placed.get(wish.assetId) || 0) >= wish.qty).length

  return (
    <div className="desk-editor">
      <div className="editor-title-row">
        <h2>The brief</h2>
        <Link to={`/r/${challenge.code}`} className="back-link">
          Room {challenge.code.toUpperCase()} →
        </Link>
      </div>
      <p className="setup-description">
        <strong>{challenge.title}</strong>
      </p>
      <Author card={challenge} />
      {challenge.brief && <p className="hint">{challenge.brief}</p>}

      <section className="editor-section">
        <h3>
          Wishlist {wanted.length > 0 && `(${done}/${wanted.length})`}
        </h3>
        {challenge.wishlist.length === 0 ? (
          <p className="hint">No wishlist: total creative freedom.</p>
        ) : (
          <ul className="checklist">
            {challenge.wishlist.map((wish) => {
              const count = wish.assetId ? placed.get(wish.assetId) || 0 : 0
              const complete = wish.assetId && count >= wish.qty
              return (
                <li key={`${wish.assetId}-${wish.label}`} className={complete ? 'is-done' : ''}>
                  {wish.assetId ? (
                    <button
                      type="button"
                      className="check-btn"
                      onClick={() => {
                        playSfx('click')
                        onAdd(wish.assetId)
                      }}
                      title="Add one"
                    >
                      <span className="check-box" aria-hidden="true">
                        {complete ? '✓' : ''}
                      </span>
                      <span>
                        {wish.label}
                        <span className="item-count">
                          {Math.min(count, wish.qty)}/{wish.qty}
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className="check-btn is-idea">
                      <span className="check-box" aria-hidden="true">
                        ?
                      </span>
                      <span>{wish.label}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="hint">The room, desk, paint, and everything already in it are locked. Add items around it!</p>
        {hasLimits(challenge.rules) && (
          <p className="rules-note">
            {challenge.rules.maxItems !== null && `Up to ${challenge.rules.maxItems} items. `}
            {challenge.rules.allow === 'categories' && `Allowed: ${challenge.rules.categories.join(', ') || 'wishlist only'}. `}
            {challenge.rules.allow === 'items' && 'Only the items the creator picked are in your Items tab. '}
          </p>
        )}
      </section>
    </div>
  )
}
