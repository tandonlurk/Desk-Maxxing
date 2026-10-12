import { TAGS } from '../assets/tags.js'
import { playSfx } from '../sfx.js'

// A wrap of tag chips you can toggle on and off. `max` limits how many can be on.
export default function TagPicker({ selected, onChange, max = Infinity, label }) {
  function toggle(id) {
    playSfx('click')
    if (selected.includes(id)) onChange(selected.filter((tag) => tag !== id))
    else if (selected.length < max) onChange([...selected, id])
  }

  return (
    <div className="tag-picker" role="group" aria-label={label}>
      {TAGS.map((tag) => {
        const on = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            className={`chip ${on ? 'is-active' : ''}`}
            aria-pressed={on}
            disabled={!on && selected.length >= max}
            onClick={() => toggle(tag.id)}
          >
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
