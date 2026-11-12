import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DeskEditor from '../components/DeskEditor.jsx'
import RoomEditor, { PaintSection } from '../components/RoomEditor.jsx'
import WishlistPanel from '../components/WishlistPanel.jsx'
import ChallengeDialog from '../components/ChallengeDialog.jsx'
import LibraryPanel from '../components/LibraryPanel.jsx'
import ItemInspector from '../components/ItemInspector.jsx'
import StageToolbar from '../components/StageToolbar.jsx'
import BackdropSection from '../components/BackgroundPicker.jsx'
import Icon from '../components/Icon.jsx'
import Segmented from '../components/Segmented.jsx'
import PublishDialog from '../components/PublishDialog.jsx'
import PlannerScene from '../scene/PlannerScene.jsx'
import { useSetupEditor } from '../hooks/useSetupEditor.js'
import { useItemDrag } from '../hooks/useItemDrag.js'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { useMessage } from '../hooks/useMessage.js'
import { getAsset } from '../assets/library.js'
import { isAssetAllowed } from '../assets/challengeRules.js'
import { getMisplacedIds } from '../scene/placement.js'
import { getMisplacedWallIds, wallRightSign } from '../scene/wallPlacement.js'
import { SPOT_LABELS } from '../scene/spots.js'
import { CM_PER_INCH } from '../units.js'
import { playSfx } from '../sfx.js'
import { loadDraft, readSetup, saveDraft } from '../data/storage.js'

const SIDEBAR_TABS = [
  { id: 'room', name: 'Room' },
  { id: 'desk', name: 'Desk' },
  { id: 'items', name: 'Items' },
]

// Designing for someone else's challenge: their room and desk are fixed.
const CHALLENGE_TABS = [
  { id: 'brief', name: 'Brief' },
  { id: 'items', name: 'Items' },
]

const ids = (setup) => new Set([...setup.items, ...setup.wallItems].map((item) => item.id))

// Your entry in progress for a challenge: the creator's base (always as it
// is in the room, locked, paint included) plus what you've added.
function startingEntry(base, draft) {
  if (!draft) return base
  const baseIds = ids(base)
  return {
    ...base,
    items: [...base.items, ...draft.items.filter((item) => !baseIds.has(item.id))],
    wallItems: [...base.wallItems, ...draft.wallItems.filter((item) => !baseIds.has(item.id))],
  }
}

const HELP = {
  snap: 'Snap: items lock into glowing spots · R rotates · Delete removes',
  free: 'Free: drag anywhere · arrow keys nudge (Shift = bigger steps) · R rotates',
}

// The planner. With a `challenge` (a room from the database), you're designing
// an entry on top of that room's base instead of your own setup.
export default function Planner({ challenge = null }) {
  const roomCode = challenge?.code ?? null
  // Pick up where you left off (also after signing in, which reloads the page).
  const [draft] = useState(() =>
    challenge ? startingEntry(challenge.base, loadDraft(roomCode)) : loadDraft(),
  )
  const [lockedIds] = useState(() => (challenge ? ids(challenge.base) : null))
  const editor = useSetupEditor(draft)
  const { room, desk, items, wallItems, history } = editor
  const location = useLocation()
  const navigate = useNavigate()

  const [units, setUnits] = useState('in')
  const [tab, setTab] = useState(challenge ? 'brief' : 'room')
  const [menuOpen, setMenuOpen] = useState(true)
  const [mode, setMode] = useState('snap')
  const [selectedId, setSelectedId] = useState(null)
  // Bumping `id` re-triggers a view even if it's the same one clicked twice.
  const [view, setView] = useState({ name: 'room', id: 0, instant: true })
  const [paintTarget, setPaintTarget] = useState('back')
  const [bucket, setBucket] = useState(null) // paint color for clicking walls, or null
  const [message, notify] = useMessage()
  const picker = useRef(null) // filled in by the 3D scene
  const snapshot = useRef(null) // also filled in by the 3D scene
  const [publishing, setPublishing] = useState(false)
  const [challenging, setChallenging] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => saveDraft({ room, desk, items, wallItems }, roomCode), 300)
    return () => clearTimeout(timer)
  }, [room, desk, items, wallItems, roomCode])

  // "Remix" on a board setup comes here with that setup. Loading it is one
  // undo step, so Undo brings your own desk back.
  const remixed = useRef(null)
  useEffect(() => {
    const remix = location.state?.remix
    if (!remix || challenge || remixed.current === location.key) return
    remixed.current = location.key
    editor.replaceSetup(readSetup(remix.setup))
    setSelectedId(null)
    notify(`Remixing “${remix.title}”. Undo brings your old desk back.`)
    navigate('.', { replace: true, state: null })
  }, [location, editor, navigate, notify, challenge])

  const drag = useItemDrag({ editor, picker, mode, units, select: setSelectedId, notify })

  const selectedItem = items.find((item) => item.id === selectedId) || wallItems.find((item) => item.id === selectedId) || null
  const selectedAsset = selectedItem ? getAsset(selectedItem.assetId) : null
  const selectedOnWall = selectedAsset?.placement === 'wall'
  const misplacedIds = useMemo(
    () => [...getMisplacedIds(desk, items, room), ...getMisplacedWallIds(room, wallItems)],
    [desk, items, room, wallItems],
  )
  // In a challenge, what you added (the base doesn't count).
  const itemCount = items.length + wallItems.length - (lockedIds?.size ?? 0)
  const placed = useMemo(() => {
    const counts = new Map()
    for (const item of [...items, ...wallItems]) {
      if (lockedIds?.has(item.id)) continue
      counts.set(item.assetId, (counts.get(item.assetId) || 0) + 1)
    }
    return counts
  }, [items, wallItems, lockedIds])
  const rules = challenge?.rules ?? null
  const atLimit = Boolean(rules?.maxItems && itemCount >= rules.maxItems)
  const isAllowed = useMemo(
    () => (challenge ? (asset) => isAssetAllowed(asset, challenge.rules, challenge.wishlist) : null),
    [challenge],
  )
  function limitReached() {
    if (!atLimit) return false
    notify(`That's the limit: ${rules.maxItems} items. Remove one to add another.`)
    return true
  }
  const wanted = useMemo(
    () => (challenge ? new Set(challenge.wishlist.map((wish) => wish.assetId).filter(Boolean)) : null),
    [challenge],
  )

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
    if (!selectedId || limitReached()) return
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
    if (selectedOnWall) {
      notify('Wall pieces always face into the room.')
      return
    }
    if (editor.rotateItem(selectedId, delta, options)) playSfx('rotate')
    else notify('Not enough room to turn that.')
  }

  function addFromKeyboard(assetId) {
    if (limitReached()) return
    const id = editor.addItem(assetId)
    if (id) {
      playSfx('place')
      setSelectedId(id)
    } else {
      notify('No room for that one. Try moving something first.')
    }
  }

  useKeyboardShortcuts((event) => {
    if (publishing || challenging) return // the dialog handles its own keys
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
    if (selectedOnWall) {
      // On a wall, up/down move it up and down, left/right move it along the wall.
      const sign = wallRightSign(selectedItem.wall)
      const moves = { arrowup: [0, step], arrowdown: [0, -step], arrowright: [sign * step, 0], arrowleft: [-sign * step, 0] }
      editor.nudgeWallItem(selectedId, ...moves[key])
      return
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
      <aside className={`planner-sidebar panel${menuOpen ? '' : ' is-collapsed'}`}>
        <div className="sidebar-head">
          <Segmented label="Sidebar" options={challenge ? CHALLENGE_TABS : SIDEBAR_TABS} value={tab} onChange={setTab} />
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Collapse menu' : 'Expand menu'}
            title={menuOpen ? 'Collapse menu' : 'Expand menu'}
            onClick={() => {
              playSfx('click')
              setMenuOpen(!menuOpen)
            }}
          >
            <Icon name={menuOpen ? 'chevron-left' : 'chevron-right'} size={18} strokeWidth={3} />
          </button>
        </div>
        {tab === 'brief' ? (
          <>
            <WishlistPanel challenge={challenge} placed={placed} onAdd={addFromKeyboard} />
            <button type="button" className="btn btn-accent next-step" onClick={() => setTab('items')}>
              Start adding items →
            </button>
          </>
        ) : tab === 'room' ? (
          <>
            <RoomEditor
              room={room}
              desk={desk}
              units={units}
              onChange={editor.updateRoom}
              onPaint={editor.paint}
              onUnitsChange={setUnits}
              paintTarget={paintTarget}
              onPaintTarget={setPaintTarget}
              bucket={bucket}
              onBucket={setBucket}
            />
            <button type="button" className="btn btn-accent next-step" onClick={() => setTab('desk')}>
              Next: your desk →
            </button>
          </>
        ) : tab === 'desk' ? (
          <>
            <DeskEditor desk={desk} units={units} onChange={editor.updateDesk} onUnitsChange={setUnits} />
            <button type="button" className="btn btn-accent next-step" onClick={() => setTab('items')}>
              Next: add items →
            </button>
          </>
        ) : (
          <LibraryPanel
            units={units}
            onCardPointerDown={(assetId, event) => {
              if (!limitReached()) drag.startNew(assetId, event)
            }}
            isAllowed={isAllowed}
            limitText={rules?.maxItems ? `${itemCount}/${rules.maxItems} items added` : null}
            onCardKeyboardAdd={addFromKeyboard}
            highlight={wanted}
          />
        )}
        <BackdropSection />
      </aside>

      <section className={stageClass} aria-label="3D desk view">
        <PlannerScene
          room={room}
          desk={desk}
          items={items}
          wallItems={wallItems}
          lockedIds={lockedIds}
          onPaint={
            bucket &&
            ((target) => {
              playSfx('place')
              editor.paint(target, bucket)
            })
          }
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
          canPublish={itemCount > 0}
          publishLabel={challenge ? 'Submit entry' : 'Publish'}
          onChallenge={
            challenge
              ? null
              : () => {
                  playSfx('click')
                  setSelectedId(null)
                  setChallenging(true)
                }
          }
          onPublish={() => {
            playSfx('click')
            setSelectedId(null) // no selection outline in the picture
            setPublishing(true)
          }}
        />

        {itemCount === 0 && !drag.dragView && !['room', 'brief'].includes(tab) && (
          <div className="empty-hint panel">
            <span className="empty-hint-mark" aria-hidden="true" />
            <p>
              {challenge
                ? `Make @${challenge.username}'s space amazing!`
                : 'Your desk is looking a little bare. Let’s make it cozy!'}
            </p>
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
            room={room}
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
            onWallSpot={(spot) => {
              if (!editor.setWallItemSpot(selectedItem.id, spot)) {
                notify("Can't go there: it would hang off the wall or bump into something.")
              }
            }}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClose={() => setSelectedId(null)}
          />
        )}

        {publishing && (
          <PublishDialog
            setup={{ room, desk, items, wallItems }}
            takePicture={takePicture}
            onPublished={(id) => navigate(challenge ? `/r/${challenge.code}` : `/s/${id}`)}
            onClose={() => setPublishing(false)}
            challenge={challenge}
          />
        )}

        {challenging && (
          <ChallengeDialog
            setup={{ room, desk, items, wallItems }}
            takePicture={takePicture}
            onClose={() => setChallenging(false)}
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
