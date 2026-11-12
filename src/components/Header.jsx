import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import AuthButton from './AuthButton.jsx'
import Icon from './Icon.jsx'

// On the planner the header tucks away so the 3D view gets the whole screen:
// click the little arrow to bring it back (and again to put it away).
const PLANNER_PATH = /^\/(plan|r\/[^/]+\/design)$/

export default function Header() {
  const { pathname } = useLocation()
  // On the planner the bar only opens and closes when the arrow is clicked.
  const [open, setOpen] = useState(false)

  // The landing page shows its own big logo.
  if (pathname === '/') return null

  const bar = (
    <>
      <NavLink to="/" className="logo" aria-label="No It HAS To Go There home">
        <span className="logo-mark" aria-hidden="true" />
      </NavLink>
      <nav className="nav">
        <NavLink to="/plan" className="nav-link">
          Plan
        </NavLink>
        <NavLink to="/explore" className="nav-link">
          Explore
        </NavLink>
      </nav>
      <div className="header-end">
        <AuthButton />
      </div>
    </>
  )

  if (!PLANNER_PATH.test(pathname)) return <header className="header">{bar}</header>

  return (
    <header className={`header header-autohide${open ? ' is-open' : ''}`}>
      {bar}
      <button
        type="button"
        className="header-handle"
        aria-label={open ? 'Close top bar' : 'Open top bar'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="chevron-down" size={14} strokeWidth={3} />
      </button>
    </header>
  )
}
