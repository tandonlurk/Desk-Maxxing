import LengthField from './LengthField.jsx'
import Segmented from './Segmented.jsx'
import {
  DESK_MATERIALS,
  DESK_SHAPES,
  LEG_STYLES,
  STANDING_RANGE,
  getDeskLimits,
  getMaterial,
} from '../assets/deskOptions.js'
import { formatLength } from '../units.js'
import { playSfx } from '../sfx.js'

const UNIT_OPTIONS = [
  { id: 'in', name: 'Inches' },
  { id: 'cm', name: 'cm' },
]

const SIDE_OPTIONS = [
  { id: 'left', name: 'Left' },
  { id: 'right', name: 'Right' },
]

// The desk settings panel. `onChange` receives just the fields that changed.
export default function DeskEditor({ desk, units, onChange, onUnitsChange }) {
  const limits = getDeskLimits(desk)

  // Shared props for every length box.
  const lengthProps = (key) => ({
    value: desk[key],
    units,
    min: limits[key].min,
    max: limits[key].max,
    onChange: (cm) => onChange({ [key]: cm }),
  })

  return (
    <div className="desk-editor">
      <div className="editor-title-row">
        <h2>Your desk</h2>
        <Segmented label="Units" options={UNIT_OPTIONS} value={units} onChange={onUnitsChange} />
      </div>

      <section className="editor-section">
        <h3>Size</h3>
        <div className="field-row">
          <LengthField label="Width" {...lengthProps('width')} />
          <LengthField label="Depth" {...lengthProps('depth')} />
          <LengthField label="Height" {...lengthProps('height')} />
        </div>
      </section>

      <section className="editor-section">
        <h3>Shape</h3>
        <Segmented label="Shape" options={DESK_SHAPES} value={desk.shape} onChange={(shape) => onChange({ shape })} />

        {desk.shape === 'l-shape' && (
          <div className="sub-fields">
            <div className="field-row">
              <LengthField label="Return length" {...lengthProps('returnLength')} />
              <LengthField label="Return depth" {...lengthProps('returnDepth')} />
            </div>
            <p className="hint">Return length is measured from the back edge of the desk.</p>
            <div className="field">
              <span className="field-label">Return side</span>
              <Segmented
                label="Return side"
                options={SIDE_OPTIONS}
                value={desk.returnSide}
                onChange={(returnSide) => onChange({ returnSide })}
              />
            </div>
          </div>
        )}

        {desk.shape === 'corner' && (
          <p className="hint">Two equal wings meet in a corner. Width sets each wing&apos;s length.</p>
        )}
      </section>

      <section className="editor-section">
        <h3>Material</h3>
        <div className="swatches">
          {DESK_MATERIALS.map((material) => (
            <button
              key={material.id}
              type="button"
              className={`swatch ${desk.material === material.id ? 'is-active' : ''}`}
              style={{ '--swatch-top': material.top, '--swatch-legs': material.legs }}
              title={material.name}
              aria-label={material.name}
              aria-pressed={desk.material === material.id}
              onClick={() => {
                playSfx('click')
                onChange({ material: material.id })
              }}
            />
          ))}
        </div>
        <p className="hint">{getMaterial(desk.material).name}</p>
      </section>

      <section className="editor-section">
        <h3>Legs</h3>
        <div className="leg-grid">
          {LEG_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`btn ${desk.legStyle === style.id ? 'is-active' : ''}`}
              aria-pressed={desk.legStyle === style.id}
              onClick={() => {
                playSfx('click')
                onChange({ legStyle: style.id })
              }}
            >
              {style.name}
            </button>
          ))}
        </div>

        {desk.legStyle === 'standing' && (
          <label className="field sit-stand">
            <span className="field-label">
              Sit / stand height: <strong>{formatLength(desk.height, units)}</strong>
            </span>
            <input
              className="range"
              type="range"
              min={STANDING_RANGE.min}
              max={STANDING_RANGE.max}
              step={0.5}
              value={desk.height}
              onChange={(event) => onChange({ height: Number(event.target.value) })}
            />
            <span className="range-labels">
              <span>Sit</span>
              <span>Stand</span>
            </span>
          </label>
        )}
      </section>
    </div>
  )
}
