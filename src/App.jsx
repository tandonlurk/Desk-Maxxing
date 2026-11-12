import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import Landing from './pages/Landing.jsx'
import Explore from './pages/Explore.jsx'
import Planner from './pages/Planner.jsx'
import SetupPage from './pages/SetupPage.jsx'
import RoomPage from './pages/RoomPage.jsx'
import SharePage from './pages/SharePage.jsx'
import ChallengeDesign from './pages/ChallengeDesign.jsx'
import { applyBackground } from './assets/backgrounds.js'
import { loadBackground } from './data/storage.js'
import './styles/app.css'

applyBackground(loadBackground())

// Old /board and /rooms links land on the matching Explore tab.
function ToExplore({ tab }) {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  if (tab !== 'board') params.set('tab', tab)
  const query = params.toString()
  return <Navigate to={`/explore${query ? `?${query}` : ''}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/plan" element={<Planner />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/board" element={<ToExplore tab="board" />} />
            <Route path="/s/:id" element={<SetupPage />} />
            <Route path="/rooms" element={<ToExplore tab="rooms" />} />
            <Route path="/r/:code" element={<RoomPage />} />
            <Route path="/r/:code/share" element={<SharePage />} />
            <Route path="/r/:code/design" element={<ChallengeDesign />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
