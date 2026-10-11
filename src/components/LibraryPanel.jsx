import { ASSETS, CATEGORIES, USING_PLACEHOLDERS } from '../assets/library.js'
import { formatNumber, toDisplay } from '../units.js'

// e.g. "24 × 8 × 18 in" (width × depth × height)
export function formatSize(size, units) {
  const n = (cm) => formatNumber(toDisplay(cm, units), units)
  return `${n(size.width)} × ${n(size.depth)} × ${n(size.height)} ${units}`
}

// The item library. Press on a card and drag it into the scene, or just
// click it to drop it in a good spot.
export default function LibraryPanel({ units, onCardPointerDown, onCardKeyboardAdd }) {
  return (
    <div className="library">
      <p className="hint">Click to add, or drag onto your desk.</p>
      {USING_PLACEHOLDERS && (
        <p className="library-note">These are stand-in blocks while the real item library is being made.</p>
      )}

      {CATEGORIES.map((category) => (
        <section key={category} className="library-section">
          <h3>{category}</h3>
          <div className="library-grid">
            {ASSETS.filter((asset) => asset.category === category).map((asset, index) => (
              <button
                key={asset.id}
                type="button"
                className="library-card"
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
                <span className="tag">{asset.placement === 'floor' ? 'Floor' : 'Desk'}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
