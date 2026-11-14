import { useState } from 'react'
import { ASSETS, CATEGORIES, USING_PLACEHOLDERS } from '../assets/library.js'
import { playSfx } from '../sfx.js'
import { formatNumber, toDisplay } from '../units.js'

// e.g. "24 × 8 × 18 in" (width × depth × height)
export function formatSize(size, units) {
  const n = (cm) => formatNumber(toDisplay(cm, units), units)
  return `${n(size.width)} × ${n(size.depth)} × ${n(size.height)} ${units}`
}

const PLACEMENT_TAGS = { desk: 'Desk', floor: 'Floor', wall: 'Wall' }

// The item library. Press on a card and drag it into the scene, or just
// click it to drop it in a good spot. Chips at the top narrow it to one
// category. `highlight` (a Set of asset ids) marks wishlist items.
export default function LibraryPanel({ units, onCardPointerDown, onCardKeyboardAdd, highlight = null, isAllowed = null, limitText = null }) {
  const [filter, setFilter] = useState('all')
  const assets = isAllowed ? ASSETS.filter(isAllowed) : ASSETS
  const categories = CATEGORIES.filter((category) => assets.some((asset) => asset.category === category))
  const shown = filter === 'all' ? categories : categories.filter((category) => category === filter)

  return (
    <div className="library">
      <p className="hint">Click to add, or drag onto your desk, floor, or walls.</p>
      {limitText && <p className="rules-note">{limitText}</p>}
      <div className="chip-row" role="radiogroup" aria-label="Item categories">
        {['all', ...categories].map((category) => (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={filter === category}
            className={`chip ${filter === category ? 'is-active' : ''}`}
            onClick={() => {
              playSfx('click')
              setFilter(category)
            }}
          >
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>
      {USING_PLACEHOLDERS && (
        <p className="library-note">These are stand-in blocks while the real item library is being made.</p>
      )}

      {shown.map((category) => (
        <section key={category} className="library-section">
          <h3>{category}</h3>
          <div className="library-grid">
            {assets.filter((asset) => asset.category === category).map((asset, index) => (
              <button
                key={asset.id}
                type="button"
                className={`library-card ${highlight?.has(asset.id) ? 'is-wanted' : ''}`}
                style={{ '--item-color': asset.colorOptions[0].value, '--i': index }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.preventDefault() // no text selection while dragging
                  onCardPointerDown(asset.id, event)
                }}
                onClick={(event) => {
                  // Pointer clicks are handled by the drag code; this is for
                  // keyboard users pressing Enter or Space.
                  if (event.detail === 0) onCardKeyboardAdd(asset.id)
                }}
              >
                <span className="library-icon" aria-hidden="true" />
                <span className="library-card-text">
                  <span className="library-card-name">{asset.name}</span>
                  <span className="library-card-size">{formatSize(asset.size, units)}</span>
                </span>
                <span className="tag">{highlight?.has(asset.id) ? '★ Wanted' : PLACEMENT_TAGS[asset.placement]}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
