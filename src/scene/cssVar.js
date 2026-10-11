// Reads a color from src/styles/theme.css so the 3D scene uses the same
// palette as the rest of the UI. Example: cssVar('--floor-top')
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
