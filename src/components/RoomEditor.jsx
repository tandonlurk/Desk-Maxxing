import LengthField from './LengthField.jsx'
import Segmented from './Segmented.jsx'
import {
  FLOOR_COLORS,
  FLOOR_STYLES,
  PAINT_COLORS,
  WALLS,
  WALL_NAMES,
  getRoomLimits,
} from '../assets/roomOptions.js'
import { deskBoxInRoom, deskWall, placeDeskAgainst, slideDesk } from '../scene/roomGeometry.js'
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
        <p className="hint">Measure wall to wall. The front stays open so you can see in.</p>
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
      </section>

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
      <h3>Paint</h3>
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
      <button
        type="button"
        className={`btn btn-small ${bucket ? 'is-active' : ''}`}
        aria-pressed={Boolean(bucket)}
        onClick={() => {
          playSfx('click')
          onBucket(bucket ? null : current)
        }}
      >
        {bucket ? 'Paint bucket on: click walls in the view' : 'Paint bucket: click walls to paint'}
      </button>
    </section>
  )
}
