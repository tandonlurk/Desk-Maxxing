import LengthField from './LengthField.jsx'
import Icon from './Icon.jsx'
import { formatSize } from './LibraryPanel.jsx'
import { getDeskBounds } from '../scene/deskGeometry.js'
import { getEdgeOffsets } from '../scene/placement.js'
import { wallLength, wallRightSign } from '../scene/wallPlacement.js'
import { WALL_NAMES } from '../assets/roomOptions.js'
import { playSfx } from '../sfx.js'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl+'

// The card for the selected item: its real size, rotation, color, exact
// position, and duplicate/delete. Wall items show their spot on the wall
// instead of a rotation and desk edge distances.
export default function ItemInspector({
  item,
  asset,
  room,
  desk,
  units,
  misplaced,
  locked = false,
  onRotate,
  onColor,
  onEdgeOffsets,
  onWallSpot,
  onDuplicate,
  onDelete,
  onClose,
}) {
  const onDesk = asset.placement === 'desk'
  const onWall = asset.placement === 'wall'
  const offsets = onWall ? null : getEdgeOffsets(desk, item)
  const bounds = getDeskBounds(desk)
  const maxOffset = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)

  return (
    <div className="inspector panel" key={item.id}>
      <div className="inspector-head">
        <h3>{asset.name}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Deselect" title="Deselect (Esc)">
          ×
        </button>
      </div>
      <p className="inspector-size">{formatSize(asset.size, units)}</p>

      {misplaced && (
        <p className="inspector-warning">
          {onWall
            ? 'This isn’t on a wall anymore. Drag it onto one, or delete it.'
            : 'This doesn’t fit on the desk anymore. Drag it back on, or delete it.'}
        </p>
      )}

      {locked && <p className="hint">Part of the base. Design around it!</p>}

      {onWall && !locked && <WallSpotFields item={item} asset={asset} room={room} units={units} onWallSpot={onWallSpot} />}

      {!onWall && !locked && (
      <div className="inspector-row">
        <span className="field-label">Rotation</span>
        <div className="rotate-controls">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onRotate(15)}
            title="Turn left 15°"
            aria-label="Turn left 15 degrees"
          >
            <Icon name="rotate-left" />
          </button>
          <span className="rotation-value">{Math.round(item.rotation)}°</span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onRotate(-15)}
            title="Turn right 15° (R)"
            aria-label="Turn right 15 degrees"
          >
            <Icon name="rotate-right" />
          </button>
        </div>
      </div>
      )}

      {asset.colorOptions.length > 1 && !locked && (
        <div className="inspector-row">
          <span className="field-label">Color</span>
          <div className="color-dots">
            {asset.colorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`color-dot ${item.color === option.value ? 'is-active' : ''}`}
                style={{ '--dot': option.value }}
                title={option.name}
                aria-label={option.name}
                aria-pressed={item.color === option.value}
                onClick={() => {
                  playSfx('click')
                  onColor(option.value)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {onDesk && !locked && (
        <div className="field-row">
          <LengthField
            label="From left edge"
            value={offsets.fromLeft}
            units={units}
            min={0}
            max={maxOffset}
            commitOnBlur
            onChange={(cm) => onEdgeOffsets({ fromLeft: cm })}
          />
          <LengthField
            label="From back edge"
            value={offsets.fromBack}
            units={units}
            min={0}
            max={maxOffset}
            commitOnBlur
            onChange={(cm) => onEdgeOffsets({ fromBack: cm })}
          />
        </div>
      )}

      {!locked && (
        <div className="inspector-actions">
          <button type="button" className="btn" onClick={onDuplicate} title={`Duplicate (${MOD}D)`}>
            Duplicate
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete} title="Delete (Delete / Backspace)">
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// Exact spot on the wall: height off the floor, and distance from the
// wall's left end (as seen from inside the room).
function WallSpotFields({ item, asset, room, units, onWallSpot }) {
  const length = wallLength(room, item.wall)
  const sign = wallRightSign(item.wall)
  const fromLeft = length / 2 + sign * item.u - asset.size.width / 2
  return (
    <>
      <p className="hint">On the {WALL_NAMES[item.wall].toLowerCase()}</p>
      <div className="field-row">
        <LengthField
          label="From wall's left end"
          value={fromLeft}
          units={units}
          min={0}
          max={Math.max(0, length - asset.size.width)}
          commitOnBlur
          onChange={(cm) => onWallSpot({ u: sign * (cm + asset.size.width / 2 - length / 2) })}
        />
        <LengthField
          label="Off the floor"
          value={item.y}
          units={units}
          min={0}
          max={Math.max(0, room.height - asset.size.height)}
          commitOnBlur
          onChange={(cm) => onWallSpot({ y: cm })}
        />
      </div>
    </>
  )
}
