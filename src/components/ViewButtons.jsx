import { Fragment } from 'react'
import { VIEW_PRESETS } from '../scene/cameraViews.js'
import Icon from './Icon.jsx'

// Camera presets as small icons separated by dashes: Room - Front - Top - Side - Seated.
export default function ViewButtons({ onSelect }) {
  return (
    <div className="view-buttons" role="toolbar" aria-label="Camera views">
      {VIEW_PRESETS.map((view, index) => (
        <Fragment key={view.id}>
          {index > 0 && (
            <span className="view-dash" aria-hidden="true">
              -
            </span>
          )}
          <button
            type="button"
            className="icon-btn"
            title={view.name}
            aria-label={`${view.name} view`}
            onClick={() => onSelect(view.id)}
          >
            <Icon name={`view-${view.id}`} size={18} strokeWidth={2.5} />
          </button>
        </Fragment>
      ))}
    </div>
  )
}
