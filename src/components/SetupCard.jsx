import { Link } from 'react-router-dom'
import { tagName } from '../assets/tags.js'

// One published setup on the board: its picture, title, author, points, and tags.
export default function SetupCard({ card, index = 0 }) {
  return (
    <Link to={`/s/${card.id}`} className="setup-card panel" style={{ '--i': index }}>
      {card.thumbnailUrl && <img className="setup-card-image" src={card.thumbnailUrl} alt="" loading="lazy" />}
      <div className="setup-card-body">
        <div className="setup-card-title-row">
          <h3>{card.title}</h3>
          <span className="points" title={`${card.wins} wins, ${card.losses} losses in 1v1s`}>
            {card.points} pts
          </span>
        </div>
        <Author card={card} />
        {card.tags.length > 0 && (
          <div className="setup-card-tags">
            {card.tags.map((tag) => (
              <span key={tag} className="tag">
                {tagName(tag)}
              </span>
            ))}
          </div>
        )}
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
