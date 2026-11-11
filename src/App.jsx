import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Planner from './pages/Planner.jsx'
import Board from './pages/Board.jsx'
import SetupPage from './pages/SetupPage.jsx'
import RoomPage from './pages/RoomPage.jsx'
import RoomsPage from './pages/RoomsPage.jsx'
import ChallengeDesign from './pages/ChallengeDesign.jsx'
import './styles/app.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Planner />} />
            <Route path="/board" element={<Board />} />
            <Route path="/s/:id" element={<SetupPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/r/:code" element={<RoomPage />} />
            <Route path="/r/:code/design" element={<ChallengeDesign />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
