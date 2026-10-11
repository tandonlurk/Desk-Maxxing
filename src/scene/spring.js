// A tiny spring simulation used for the snappy, bouncy animations.
//
// A spring pulls `value` toward `target`. Stiffness is how hard it pulls;
// damping is friction. Low damping = more overshoot and wobble.

// The desk uses these settings. Anything that should move *with* the desk
// (like items sitting on it) uses the same ones so they stay glued together.
export const DESK_SPRING = { stiffness: 320, damping: 19 }

export function createSpring(value, { stiffness = 320, damping = 19 } = {}) {
  return { value, target: value, velocity: 0, stiffness, damping }
}

// Advance the spring by `delta` seconds, in small steps so it stays stable.
export function stepSpring(spring, delta) {
  const total = Math.min(delta, 0.1)
  const steps = Math.max(1, Math.ceil(total / (1 / 120)))
  const dt = total / steps
  for (let i = 0; i < steps; i++) {
    // Hooke's law: pull toward the target, with friction slowing it down.
    const force = spring.stiffness * (spring.target - spring.value) - spring.damping * spring.velocity
    spring.velocity += force * dt
    spring.value += spring.velocity * dt
  }
  // Close enough: rest exactly on the target.
  if (Math.abs(spring.target - spring.value) < 0.001 && Math.abs(spring.velocity) < 0.01) {
    spring.value = spring.target
    spring.velocity = 0
  }
}

// Jump straight to the target (used when the user prefers reduced motion).
export function settleSpring(spring) {
  spring.value = spring.target
  spring.velocity = 0
}
