import { useEffect, useState } from 'react'
import { clamp, formatNumber, fromDisplay, toDisplay } from '../units.js'

// A number box for a length. The value is always in cm; the box shows it in
// the current unit (in or cm).
//
// While you type, the text is kept as-is (so "60." doesn't get erased), and
// the desk updates live whenever the text is a valid number in range. When you
// leave the box, out-of-range numbers are pulled back into range.
export default function LengthField({ label, value, units, min, max, onChange }) {
  const shown = formatNumber(toDisplay(value, units), units)
  const [text, setText] = useState(shown)
  const [focused, setFocused] = useState(false)

  // Show outside changes (unit toggle, clamping) when not typing.
  useEffect(() => {
    if (!focused) setText(shown)
  }, [shown, focused])

  function handleChange(event) {
    setText(event.target.value)
    const cm = fromDisplay(parseFloat(event.target.value), units)
    if (Number.isFinite(cm) && cm >= min && cm <= max) onChange(cm)
  }

  function handleBlur() {
    setFocused(false)
    const cm = fromDisplay(parseFloat(text), units)
    if (Number.isFinite(cm)) onChange(clamp(cm, min, max))
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-with-unit">
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step={units === 'in' ? 0.5 : 1}
          min={formatNumber(toDisplay(min, units), units)}
          max={formatNumber(toDisplay(max, units), units)}
          value={text}
          onFocus={() => setFocused(true)}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className="unit">{units}</span>
      </span>
    </label>
  )
}
