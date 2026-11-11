import { Link } from 'react-router-dom'
import TackButton from './TackButton.jsx'
import { tagName } from '../assets/tags.js'

// One published setup on the board: its picture, title, author, tacks, and
// tags. `badge` is an optional label over the picture (e.g. "Creator's pick"),
// `extra` anything to show at the bottom (e.g. the crown button).
export default function SetupCard({ card, index = 0, badge = null, extra = null, rank = null }) {
  return (
    <Link to={`/s/${card.id}`} className={`setup-card panel ${badge ? 'is-featured' : ''}`} style={{ '--i': index }}>
      <div className="setup-card-picture">
        {card.thumbnailUrl && <img className="setup-card-image" src={card.thumbnailUrl} alt="" loading="lazy" />}
        {rank !== null && <span className="rank-badge">#{rank}</span>}
        {badge && <span className="pick-badge">{badge}</span>}
      </div>
      <div className="setup-card-body">
        <div className="setup-card-title-row">
          <h3>{card.title}</h3>
          <TackButton card={card} />
        </div>
        <Author card={card} />
        {card.weekTacks !== undefined && (
          <span className="hint">
            +{card.weekTacks} {card.weekTacks === 1 ? 'tack' : 'tacks'} this week
          </span>
        )}
        {card.tags.length > 0 && (
          <div className="setup-card-tags">
            {card.tags.map((tag) => (
              <span key={tag} className="tag">
                {tagName(tag)}
              </span>
            ))}
          </div>
        )}
        {extra}
      </div>
    </Link>
  )
}

export function Author({ card }) {
  return (
    <span className="author">
      {card.avatarUrl && <img className="avatar" src={card.avatarUrl} alt="" />}@{card.username}
    </span>
  )
}
