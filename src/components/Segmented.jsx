import { playSfx } from '../sfx.js'

// A row of joined buttons where exactly one is selected.
// options: [{ id, name }]
export default function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          className={option.id === value ? 'is-active' : ''}
          onClick={() => {
            playSfx('click')
            onChange(option.id)
          }}
        >
          {option.name}
        </button>
      ))}
    </div>
  )
}
