// Small chunky line icons, drawn inline so no icon font or image is needed.
const PATHS = {
  // A curved arrow turning to the left (counterclockwise).
  'rotate-left': 'M9 4 4 9l5 5M4 9h9a6 6 0 1 1 0 12h-2',
  // A curved arrow turning to the right (clockwise).
  'rotate-right': 'M15 4l5 5-5 5M20 9h-9a6 6 0 1 0 0 12h2',
  undo: 'M9 5 4 10l5 5M4 10h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 5l5 5-5 5M20 10H9a5 5 0 0 0 0 10h3',
}

export default function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
