import ViewButtons from './ViewButtons.jsx'
import Icon from './Icon.jsx'
import { playSfx } from '../sfx.js'

const MODES = [
  { id: 'snap', name: 'Snap' },
  { id: 'free', name: 'Free' },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// A two-way slider with words: the thumb slides between Snap and Free.
function ModeSlider({ value, onChange }) {
  const index = MODES.findIndex((m) => m.id === value)
  return (
    <div
      className="mode-slider"
      role="radiogroup"
      aria-label="Placement"
      title="Snap: items lock into suggested spots. Free: drag anywhere, precisely."
      style={{ '--index': index }}
    >
      <span className="mode-thumb" aria-hidden="true" />
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === value}
          className={m.id === value ? 'is-active' : ''}
          onClick={() => {
            playSfx('click')
            onChange(m.id)
          }}
        >
          {m.name}
        </button>
      ))}
    </div>
  )
}

// Floating controls over the 3D view. Top left: one compact cluster (undo/redo,
// camera views, placement). Top right: publish, and the challenge link set apart
// on its own.
export default function StageToolbar({
  mode,
  onModeChange,
  onView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canPublish,
  onPublish,
  publishLabel = 'Publish',
  onChallenge = null,
}) {
  return (
    <div className="stage-toolbar">
      <div className="tool-cluster">
        <div className="tool-pill">
          <button
            type="button"
            className="icon-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title={isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'}
            aria-label="Undo"
          >
            <Icon name="undo" size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title={isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)'}
            aria-label="Redo"
          >
            <Icon name="redo" size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="tool-pill">
          <ViewButtons onSelect={onView} />
        </div>
        <div className="tool-pill">
          <ModeSlider value={mode} onChange={onModeChange} />
        </div>
      </div>

      <div className="tool-actions">
        {onChallenge && (
          <button
            type="button"
            className="btn btn-pink challenge-cta"
            onClick={onChallenge}
            title="Send friends a link to design something on top of your room"
          >
            <Icon name="link" size={20} strokeWidth={2.5} />
            <span>
              Challenge link
              <small>Invite friends to redesign your room</small>
            </span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-small btn-accent"
          onClick={onPublish}
          disabled={!canPublish}
          title={canPublish ? 'Share this setup on the board' : 'Add some items first'}
        >
          {publishLabel}
        </button>
      </div>
    </div>
  )
}
