// True when the user asked their OS for less motion. Animations check this
// and jump straight to the end instead of bouncing.
const query =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

export function prefersReducedMotion() {
  return query ? query.matches : false
}
