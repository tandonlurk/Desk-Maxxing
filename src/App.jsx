import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Planner from './pages/Planner.jsx'
import './styles/app.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Planner />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
