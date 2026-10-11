import { useState } from 'react'
import DeskEditor from '../components/DeskEditor.jsx'
import ViewButtons from '../components/ViewButtons.jsx'
import PlannerScene from '../scene/PlannerScene.jsx'
import { DEFAULT_DESK, normalizeDesk } from '../assets/deskOptions.js'
import { playSfx } from '../sfx.js'

export default function Planner() {
  const [desk, setDesk] = useState(DEFAULT_DESK)
  const [units, setUnits] = useState('in')
  // Bumping `id` re-triggers a view even if it's the same one clicked twice.
  const [view, setView] = useState({ name: 'default', id: 0, instant: true })

  function updateDesk(changes) {
    setDesk((current) => normalizeDesk({ ...current, ...changes }))
  }

  function showView(name) {
    playSfx('click')
    setView((current) => ({ name, id: current.id + 1 }))
  }

  return (
    <div className="planner">
      <aside className="planner-sidebar panel">
        <DeskEditor desk={desk} units={units} onChange={updateDesk} onUnitsChange={setUnits} />
      </aside>

      <section className="planner-stage" aria-label="3D desk view">
        <PlannerScene desk={desk} view={view} />
        <ViewButtons onSelect={showView} />
        <p className="stage-help">Drag to orbit · Right-drag to pan · Scroll to zoom</p>
      </section>
    </div>
  )
}
