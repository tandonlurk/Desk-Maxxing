import { useSearchParams } from 'react-router-dom'
import Segmented from '../components/Segmented.jsx'
import Board from './Board.jsx'
import RoomsPage from './RoomsPage.jsx'

const TABS = [
  { id: 'board', name: 'Board' },
  { id: 'rooms', name: 'My rooms' },
]

// Everything about other people's work: the inspiration board and your rooms.
export default function Explore() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'board'

  return (
    <div className="explore">
      <div className="explore-head">
        <h1>Explore</h1>
        <Segmented
          label="Explore section"
          options={TABS}
          value={tab}
          onChange={(id) => setParams(id === 'board' ? {} : { tab: id }, { replace: true })}
        />
      </div>
      <div className="explore-body">{tab === 'board' ? <Board /> : <RoomsPage />}</div>
    </div>
  )
}
