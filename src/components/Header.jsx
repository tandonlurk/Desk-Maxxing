import { NavLink } from 'react-router-dom'
import AuthButton from './AuthButton.jsx'

export default function Header() {
  return (
    <header className="header">
      <NavLink to="/" className="logo">
        <span className="logo-mark" aria-hidden="true" />
        Desk Maxxing
      </NavLink>
      <nav className="nav">
        <NavLink to="/" end className="nav-link">
          Planner
        </NavLink>
        <NavLink to="/board" className="nav-link">
          Board
        </NavLink>
      </nav>
      <AuthButton />
    </header>
  )
}
