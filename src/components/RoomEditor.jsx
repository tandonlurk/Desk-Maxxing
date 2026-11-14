import Icon from './Icon.jsx'
import LengthField from './LengthField.jsx'
import Segmented from './Segmented.jsx'
import {
  FLOOR_COLORS,
  GLASS_COLORS,
  MAX_WINDOWS,
  WINDOW_SIZE,
  getWindowLimits,
  FLOOR_STYLES,
  PAINT_COLORS,
  WALLS,
  WALL_NAMES,
  getRoomLimits,
} from '../assets/roomOptions.js'
import { deskBoxInRoom, deskGap, deskWall, placeDeskAgainst, setDeskGap, slideDesk } from '../scene/roomGeometry.js'
import { findWindowSpot, wallLength, wallRightSign } from '../scene/wallPlacement.js'
import { makeItemId } from '../hooks/useSetupEditor.js'
import { formatLength } from '../units.js'
import { playSfx } from '../sfx.js'

const UNIT_OPTIONS = [
  { id: 'in', name: 'Inches' },
  { id: 'cm', name: 'cm' },
]

const DESK_WALL_OPTIONS = [
  { id: 'left', name: 'Left wall' },
  { id: 'back', name: 'Back wall' },
  { id: 'right', name: 'Right wall' },
]

const PAINT_TARGETS = [...WALLS.map((wall) => ({ id: wall, name: WALL_NAMES[wall].replace(' wall', '') })), { id: 'floor', name: 'Floor' }]

// The room settings panel: size, which walls are there, where the desk
// stands, and paint. `onChange` takes room fields or a function of
// (room, desk) → room. `bucket` is the paint color for clicking walls in the
// 3D view (null when off).
export default function RoomEditor({
  room,
  desk,
  units,
  onChange,
  onPaint,
  onUnitsChange,
  paintTarget,
  onPaintTarget,
  bucket,
  onBucket,
}) {
  const limits = getRoomLimits()
  const lengthProps = (key) => ({
    value: room[key],
    units,
    min: limits[key].min,
    max: limits[key].max,
    onChange: (cm) => onChange({ [key]: cm }, { group: `room-${key}` }),
  })

  const wall = deskWall(room) || 'back'
  const along = wall === 'back' ? room.width : room.depth
  const box = deskBoxInRoom(room, desk)
  const deskAlong = wall === 'back' ? box.maxX - box.minX : box.maxZ - box.minZ
  const slack = Math.max(0, (along - deskAlong) / 2)
  const offset = wall === 'back' ? (box.minX + box.maxX) / 2 : (box.minZ + box.maxZ) / 2
  // The slider always reads left → right as you face that wall.
  const sign = wall === 'left' ? -1 : 1
  const gap = deskGap(room, desk)

  return (
    <div className="desk-editor">
      <div className="editor-title-row">
        <h2>Your room</h2>
        <Segmented label="Units" options={UNIT_OPTIONS} value={units} onChange={onUnitsChange} />
      </div>

      <section className="editor-section">
        <h3>Size</h3>
        <div className="field-row">
          <LengthField label="Width" {...lengthProps('width')} />
          <LengthField label="Length" {...lengthProps('depth')} />
          <LengthField label="Ceiling" {...lengthProps('height')} />
        </div>
      </section>

      <section className="editor-section">
        <h3>Walls</h3>
        <div className="leg-grid">
          {WALLS.map((id) => (
            <button
              key={id}
              type="button"
              className={`btn ${room.walls[id] ? 'is-active' : ''}`}
              aria-pressed={room.walls[id]}
              onClick={() => {
                playSfx('click')
                onChange({ walls: { ...room.walls, [id]: !room.walls[id] } })
              }}
            >
              {WALL_NAMES[id]}
            </button>
          ))}
        </div>
      </section>

      <section className="editor-section">
        <h3>Desk goes against</h3>
        <Segmented
          label="Desk goes against"
          options={DESK_WALL_OPTIONS}
          value={wall}
          onChange={(id) => onChange((r, d) => placeDeskAgainst(r, d, id))}
        />
        {slack > 0 && (
          <label className="field sit-stand">
            <span className="field-label">
              Slide along the wall: <strong>{formatLength(slack + sign * offset, units)}</strong> from the left
            </span>
            <input
              className="range"
              type="range"
              min={-slack}
              max={slack}
              step={1}
              value={sign * offset}
              onChange={(event) => {
                const value = sign * Number(event.target.value)
                onChange((r, d) => slideDesk(r, d, value), { group: 'room-slide' })
              }}
            />
          </label>
        )}
        {gap.max > 0 && (
          <label className="field sit-stand">
            <span className="field-label">
              Out from the wall: <strong>{formatLength(gap.gap, units)}</strong>
            </span>
            <input
              className="range"
              type="range"
              min={0}
              max={Math.floor(gap.max)}
              step={1}
              value={Math.round(gap.gap)}
              onChange={(event) => {
                const value = Number(event.target.value)
                onChange((r, d) => setDeskGap(r, d, value), { group: 'room-gap' })
              }}
            />
          </label>
        )}
      </section>

      <WindowsSection room={room} units={units} onChange={onChange} />

      <PaintSection
        room={room}
        onChange={onChange}
        onPaint={onPaint}
        paintTarget={paintTarget}
        onPaintTarget={onPaintTarget}
        bucket={bucket}
        onBucket={onBucket}
      />
    </div>
  )
}

// Paint for the walls and floor: 8 colors (plus wood tones for floors), and
// a paint bucket for clicking walls right in the 3D view.
export function PaintSection({ room, onChange, onPaint, paintTarget, onPaintTarget, bucket, onBucket }) {
  const current = paintTarget === 'floor' ? room.floor.color : room.paint[paintTarget]
  const colors = paintTarget === 'floor' ? FLOOR_COLORS : PAINT_COLORS
  return (
    <section className="editor-section">
      <div className="section-head">
        <h3>Paint</h3>
        <button
          type="button"
          className={`icon-btn ${bucket ? 'is-active' : ''}`}
          aria-pressed={Boolean(bucket)}
          aria-label="Paint bucket"
          title={bucket ? 'Paint bucket on: click walls in the view' : 'Paint bucket: click walls to paint'}
          onClick={() => {
            playSfx('click')
            onBucket(bucket ? null : current)
          }}
        >
          <Icon name="bucket" size={18} strokeWidth={2.5} />
        </button>
      </div>
      <Segmented label="What to paint" options={PAINT_TARGETS} value={paintTarget} onChange={onPaintTarget} />
      <div className="paint-swatches">
        {colors.map((color) => (
          <button
            key={color.value}
            type="button"
            className={`paint-swatch ${current === color.value ? 'is-active' : ''}`}
            style={{ '--paint': color.value }}
            title={color.name}
            aria-label={color.name}
            aria-pressed={current === color.value}
            onClick={() => {
              playSfx('click')
              onPaint(paintTarget, color.value)
              if (bucket) onBucket(color.value)
            }}
          />
        ))}
      </div>
      {paintTarget === 'floor' && (
        <Segmented
          label="Floor style"
          options={FLOOR_STYLES}
          value={room.floor.style}
          onChange={(style) => onChange({ floor: { ...room.floor, style } })}
        />
      )}
    </section>
  )
}

const WALL_OPTIONS = WALLS.map((id) => ({ id, name: WALL_NAMES[id].replace(' wall', '') }))

// Windows: four-pane, wood-framed, with a sill. Each one picks its wall,
// size, and spot on that wall.
function WindowsSection({ room, units, onChange }) {
  const windows = room.windows
  const canAdd = windows.length < MAX_WINDOWS && WALLS.some((w) => room.walls[w])
  const setWindows = (next, group = null) => onChange({ windows: next }, { group })
  const changeWindow = (id, changes, group) =>
    setWindows(
      windows.map((w) => (w.id === id ? { ...w, ...changes } : w)),
      group,
    )

  function addWindow() {
    const { width, height, y } = WINDOW_SIZE
    const spot = findWindowSpot(room, width, height, y)
    if (!spot) return
    playSfx('place')
    setWindows([...windows, { id: makeItemId(), ...spot, width, height, y }])
  }

  return (
    <section className="editor-section">
      <div className="section-head">
        <h3>Windows</h3>
        <button type="button" className="btn" onClick={addWindow} disabled={!canAdd}>
          + Add window
        </button>
      </div>
      {windows.length === 0 && <p className="hint">Optional. Adds a four-pane window with a sill.</p>}
      {windows.map((w, index) => (
        <WindowFields
          key={w.id}
          index={index}
          win={w}
          room={room}
          units={units}
          onChange={(changes, group) => changeWindow(w.id, changes, group)}
          onRemove={() => {
            playSfx('delete')
            setWindows(windows.filter((other) => other.id !== w.id))
          }}
        />
      ))}
    </section>
  )
}

function WindowFields({ index, win, room, units, onChange, onRemove }) {
  const limits = getWindowLimits(room)
  const length = wallLength(room, win.wall)
  const sign = wallRightSign(win.wall)
  const slack = Math.max(0, length - win.width)
  const fromLeft = length / 2 + sign * win.u - win.width / 2
  const sizeField = (key, label) => (
    <LengthField
      label={label}
      value={win[key]}
      units={units}
      min={limits[key].min}
      max={key === 'width' ? Math.min(limits.width.max, length) : limits.height.max}
      onChange={(cm) => onChange({ [key]: cm }, `window-${win.id}-${key}`)}
    />
  )
  return (
    <div className="sub-fields">
      <div className="section-head">
        <strong>Window {index + 1}</strong>
        <button type="button" className="btn" onClick={onRemove} aria-label={`Remove window ${index + 1}`}>
          Remove
        </button>
      </div>
      <Segmented
        label={`Window ${index + 1} wall`}
        options={WALL_OPTIONS.filter((o) => room.walls[o.id] || o.id === win.wall)}
        value={win.wall}
        onChange={(wall) => onChange({ wall, u: 0 })}
      />
      {!room.walls[win.wall] && <p className="hint">That wall is hidden, so this window is too.</p>}
      <div className="field-row">
        {sizeField('width', 'Width')}
        {sizeField('height', 'Height')}
        <LengthField
          label="Off the floor"
          value={win.y}
          units={units}
          min={0}
          max={Math.max(0, room.height - win.height)}
          onChange={(cm) => onChange({ y: cm }, `window-${win.id}-y`)}
        />
      </div>
      {slack > 0 && (
        <label className="field sit-stand">
          <span className="field-label">
            From the wall's left end: <strong>{formatLength(fromLeft, units)}</strong>
          </span>
          <input
            className="range"
            type="range"
            min={0}
            max={Math.floor(slack)}
            step={1}
            value={Math.round(fromLeft)}
            onChange={(event) => {
              const cm = Number(event.target.value)
              onChange({ u: sign * (cm + win.width / 2 - length / 2) }, `window-${win.id}-u`)
            }}
          />
        </label>
      )}
      <div className="glass-swatches">
        {GLASS_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            className={`paint-swatch ${win.glass === color.value ? 'is-active' : ''}`}
            style={{ '--paint': color.value }}
            title={`${color.name} glass`}
            aria-label={`${color.name} glass`}
            aria-pressed={win.glass === color.value}
            onClick={() => {
              playSfx('click')
              onChange({ glass: color.value })
            }}
          />
        ))}
      </div>
    </div>
  )
}
