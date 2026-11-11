import Segmented from './Segmented.jsx'
import ViewButtons from './ViewButtons.jsx'
import Icon from './Icon.jsx'

const MODES = [
  { id: 'snap', name: 'Snap' },
  { id: 'free', name: 'Free' },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// The bar across the top of the 3D view: placement mode, camera views,
// undo/redo, publish, and (in your own planner) starting a challenge.
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
      <div className="placement-mode" title="Snap: items lock into suggested spots. Free: drag anywhere, precisely.">
        <span className="toolbar-label">Placement</span>
        <Segmented label="Placement mode" options={MODES} value={mode} onChange={onModeChange} />
      </div>

      <ViewButtons onSelect={onView} />

      <div className="undo-redo">
        <button
          type="button"
          className="btn btn-small"
          onClick={onUndo}
          disabled={!canUndo}
          title={isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'}
        >
          <Icon name="undo" size={14} /> Undo
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={onRedo}
          disabled={!canRedo}
          title={isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)'}
        >
          Redo <Icon name="redo" size={14} />
        </button>
        {onChallenge && (
          <button
            type="button"
            className="btn btn-small btn-pink"
            onClick={onChallenge}
            title="Send friends a link to design something on top of your room"
          >
            Challenge
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
