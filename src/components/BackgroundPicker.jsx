import { useState } from 'react'
import { BACKGROUNDS, applyBackground } from '../assets/backgrounds.js'
import { loadBackground, saveBackground } from '../data/storage.js'
import { playSfx } from '../sfx.js'
import Icon from './Icon.jsx'

// A collapsible "Backdrop" section for the planner menu: page background swatches.
export default function BackdropSection() {
  const [current, setCurrent] = useState(loadBackground)

  function pick(id) {
    playSfx('click')
    setCurrent(id)
    applyBackground(id)
    saveBackground(id)
  }

  return (
    <details className="editor-section backdrop-section">
      <summary>
        <Icon name="image" size={16} strokeWidth={2.5} />
        <h3>Backdrop</h3>
        <Icon name="chevron-down" size={14} strokeWidth={3} />
      </summary>
      <div className="backdrop-grid" role="radiogroup" aria-label="Background">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={b.id === current}
            aria-label={b.name}
            title={b.name}
            className={`bg-swatch${b.id === current ? ' is-active' : ''}`}
            style={{
              backgroundColor: b.bg,
              backgroundImage: b.dots
                ? `conic-gradient(${b.dots} 25%, transparent 0 50%, ${b.dots} 0 75%, transparent 0)`
                : 'none',
            }}
            onClick={() => pick(b.id)}
          />
        ))}
      </div>
    </details>
  )
}
