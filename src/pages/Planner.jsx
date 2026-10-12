import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DeskEditor from '../components/DeskEditor.jsx'
import LibraryPanel from '../components/LibraryPanel.jsx'
import ItemInspector from '../components/ItemInspector.jsx'
import StageToolbar from '../components/StageToolbar.jsx'
import Segmented from '../components/Segmented.jsx'
import PublishDialog from '../components/PublishDialog.jsx'
import PlannerScene from '../scene/PlannerScene.jsx'
import { useSetupEditor } from '../hooks/useSetupEditor.js'
import { useItemDrag } from '../hooks/useItemDrag.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { useMessage } from '../hooks/useMessage.js'
import { getAsset } from '../assets/library.js'
import { getMisplacedIds } from '../scene/placement.js'
import { SPOT_LABELS } from '../scene/spots.js'
import { CM_PER_INCH } from '../units.js'
import { playSfx } from '../sfx.js'
import { loadDraft, readSetup, saveDraft } from '../data/storage.js'

const SIDEBAR_TABS = [
  { id: 'desk', name: 'Desk' },
  { id: 'items', name: 'Items' },
]

const HELP = {
  snap: 'Snap: items lock into glowing spots · R rotates · Delete removes',
  free: 'Free: drag anywhere · arrow keys nudge (Shift = bigger steps) · R rotates',
}

export default function Planner() {
  // Pick up where you left off (also after signing in, which reloads the page).
  const [draft] = useState(loadDraft)
  const editor = useSetupEditor(draft)
  const { desk, items, history } = editor
  const location = useLocation()
  const navigate = useNavigate()

  const [units, setUnits] = useState('in')
  const [tab, setTab] = useState('desk')
  const [mode, setMode] = useState('snap')
  const [selectedId, setSelectedId] = useState(null)
  // Bumping `id` re-triggers a view even if it's the same one clicked twice.
  const [view, setView] = useState({ name: 'default', id: 0, instant: true })
  const [message, notify] = useMessage()
  const picker = useRef(null) // filled in by the 3D scene
  const snapshot = useRef(null) // also filled in by the 3D scene
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => saveDraft({ desk, items }), 300)
    return () => clearTimeout(timer)
  }, [desk, items])

  // "Remix" on a board setup comes here with that setup. Loading it is one
  // undo step, so Undo brings your own desk back.
  const remixed = useRef(null)
  useEffect(() => {
    const remix = location.state?.remix
    if (!remix || remixed.current === location.key) return
    remixed.current = location.key
    editor.replaceSetup(readSetup(remix.setup))
    setSelectedId(null)
    notify(`Remixing “${remix.title}”. Undo brings your old desk back.`)
    navigate('.', { replace: true, state: null })
  }, [location, editor, navigate, notify])

  const drag = useItemDrag({ editor, picker, mode, units, select: setSelectedId, notify })

  const selectedItem = items.find((item) => item.id === selectedId) || null
  const selectedAsset = selectedItem ? getAsset(selectedItem.assetId) : null
  const misplacedIds = useMemo(() => getMisplacedIds(desk, items), [desk, items])

  function showView(name) {
    playSfx('click')
    setView((current) => ({ name, id: current.id + 1 }))
  }

  function deleteSelected() {
    if (!selectedId) return
    playSfx('delete')
    editor.deleteItem(selectedId)
    setSelectedId(null)
  }

  function duplicateSelected() {
    if (!selectedId) return
    const copyId = editor.duplicateItem(selectedId)
    if (copyId) {
      playSfx('place')
      setSelectedId(copyId)
    } else {
      notify('No room for a copy right next to it.')
    }
  }

  function rotateSelected(delta, options) {
    if (!selectedId) return
    if (editor.rotateItem(selectedId, delta, options)) playSfx('rotate')
    else notify('Not enough room to turn that.')
  }

  function addFromKeyboard(assetId) {
    const id = editor.addItem(assetId)
    if (id) {
      playSfx('place')
      setSelectedId(id)
    } else {
      notify('No room for that one. Try moving something first.')
    }
  }

  useKeyboardShortcuts((event) => {
    if (publishing) return // the dialog handles its own keys
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()

    if (mod && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) history.redo()
      else history.undo()
    } else if (mod && key === 'y') {
      event.preventDefault()
      history.redo()
    } else if (mod && key === 'd') {
      event.preventDefault() // not "bookmark this page"
      duplicateSelected()
    } else if (key === 'escape') {
      if (!drag.cancel()) setSelectedId(null)
    } else if (mod || !selectedId) {
      return
    } else if (key === 'r') {
      // R turns 15° clockwise; Shift+R turns 1° at a time (hold it to turn freely).
      rotateSelected(event.shiftKey ? -1 : -15, { free: event.shiftKey })
    } else if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      deleteSelected()
    } else if (key.startsWith('arrow')) {
      event.preventDefault()
      nudgeSelected(key, event.shiftKey)
    }
  })

  // Arrow keys move the selected item one step (1 in or 1 cm; Shift = 5),
  // in the direction that matches the screen.
  function nudgeSelected(key, big) {
    const axes = picker.current?.viewAxes()
    if (!axes) return
    const step = (units === 'in' ? CM_PER_INCH : 1) * (big ? 5 : 1)
    const directions = {
      arrowup: axes.forward,
      arrowdown: { x: -axes.forward.x, z: -axes.forward.z },
      arrowright: axes.right,
      arrowleft: { x: -axes.right.x, z: -axes.right.z },
    }
    const dir = directions[key]
    editor.nudgeItem(selectedId, dir.x * step, dir.z * step)
  }

  // The 3D view can still be starting up right after the page opens, so give
  // it up to ~4 seconds.
  const takePicture = useMemo(
    () => async () => {
      for (let frame = 0; frame < 240 && !snapshot.current; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      if (!snapshot.current) throw new Error('The 3D view isn’t ready yet. Try again in a moment.')
      return snapshot.current()
    },
    [],
  )

  const stageClass = `planner-stage ${drag.dragView ? 'is-dragging' : ''}`

  return (
    <div className="planner">
      <aside className="planner-sidebar panel">
        <Segmented label="Sidebar" options={SIDEBAR_TABS} value={tab} onChange={setTab} />
        {tab === 'desk' ? (
          <>
            <DeskEditor desk={desk} units={units} onChange={editor.updateDesk} onUnitsChange={setUnits} />
            <button type="button" className="btn btn-accent next-step" onClick={() => setTab('items')}>
              Next: add items →
            </button>
          </>
        ) : (
          <LibraryPanel units={units} onCardPointerDown={drag.startNew} onCardKeyboardAdd={addFromKeyboard} />
        )}
      </aside>

      <section className={stageClass} aria-label="3D desk view">
        <PlannerScene
          desk={desk}
          items={items}
          view={view}
          units={units}
          mode={mode}
          selectedId={selectedId}
          misplacedIds={misplacedIds}
          dragView={drag.dragView}
          picker={picker}
          snapshot={snapshot}
          onItemPointerDown={drag.startMove}
          onDeselect={() => setSelectedId(null)}
        />

        <StageToolbar
          mode={mode}
          onModeChange={setMode}
          onView={showView}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={history.undo}
          onRedo={history.redo}
          canPublish={items.length > 0}
          onPublish={() => {
            playSfx('click')
            setSelectedId(null) // no selection outline in the picture
            setPublishing(true)
          }}
        />

        {items.length === 0 && !drag.dragView && (
          <div className="empty-hint panel">
            <span className="empty-hint-mark" aria-hidden="true" />
            <p>Your desk is looking a little bare. Let&apos;s make it cozy!</p>
            {tab !== 'items' && (
              <button type="button" className="btn btn-accent" onClick={() => setTab('items')}>
                Add items
              </button>
            )}
          </div>
        )}

        {selectedItem && (
          <ItemInspector
            item={selectedItem}
            asset={selectedAsset}
            desk={desk}
            units={units}
            misplaced={misplacedIds.includes(selectedItem.id)}
            onRotate={(delta) => rotateSelected(delta)}
            onColor={(color) => editor.changeItem(selectedItem.id, { color })}
            onEdgeOffsets={(offsets) => {
              if (!editor.setItemEdgeOffsets(selectedItem.id, offsets)) {
                notify("Can't go there: it would hang off the desk or bump into something.")
              }
            }}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClose={() => setSelectedId(null)}
          />
        )}

        {publishing && (
          <PublishDialog
            setup={{ desk, items }}
            takePicture={takePicture}
            onPublished={(id) => navigate(`/s/${id}`)}
            onClose={() => setPublishing(false)}
          />
        )}

        <div className="stage-bottom">
          {misplacedIds.length > 0 && (
            <button type="button" className="misplaced-banner" onClick={() => setSelectedId(misplacedIds[0])}>
              {misplacedIds.length === 1 ? '1 item doesn’t fit' : `${misplacedIds.length} items don’t fit`} on the
              desk. Show me
            </button>
          )}
          {message ? (
            <p className="toast" key={message.id} role="status">
              {message.text}
            </p>
          ) : drag.dragView?.activeSpotId ? (
            <p className="spot-status">Locked into: {SPOT_LABELS[drag.dragView.activeSpotId]}</p>
          ) : (
            <p className="stage-help">{HELP[mode]}</p>
          )}
        </div>
      </section>
    </div>
  )
}
