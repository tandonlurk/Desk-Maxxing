// Page backdrops the user can pick from. `bg` is the base color (also painted
// behind the 3D scene's thumbnail); `dots` is the lighter checker square, or
// null for a plain color.
export const BACKGROUNDS = [
  { id: 'sky', name: 'Sky', bg: '#9fdcff', dots: '#b2e4ff' },
  { id: 'mint', name: 'Mint', bg: '#a8ecd0', dots: '#bdf3de' },
  { id: 'peach', name: 'Peach', bg: '#ffcfa8', dots: '#ffdcbf' },
  { id: 'lavender', name: 'Lavender', bg: '#cdb8ff', dots: '#dccdff' },
  { id: 'butter', name: 'Butter', bg: '#fff0a0', dots: '#fff6c4' },
  { id: 'pink', name: 'Bubblegum', bg: '#ffb8d1', dots: '#ffcce0' },
  { id: 'ocean', name: 'Ocean', bg: '#7cc6f2', dots: '#92d2f7' },
  { id: 'plain', name: 'Plain', bg: '#e9f6ff', dots: null },
]

export const DEFAULT_BACKGROUND = 'sky'

export function applyBackground(id) {
  const choice = BACKGROUNDS.find((b) => b.id === id) || BACKGROUNDS[0]
  const root = document.documentElement.style
  root.setProperty('--bg', choice.bg)
  root.setProperty('--bg-dots', choice.dots || choice.bg)
}
