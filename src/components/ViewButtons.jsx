import { VIEW_PRESETS } from '../scene/cameraViews.js'

// Camera preset buttons that float over the 3D view.
export default function ViewButtons({ onSelect }) {
  return (
    <div className="view-buttons" role="toolbar" aria-label="Camera views">
      {VIEW_PRESETS.map((view) => (
        <button key={view.id} type="button" className="btn" onClick={() => onSelect(view.id)}>
          {view.name}
        </button>
      ))}
    </div>
  )
}
