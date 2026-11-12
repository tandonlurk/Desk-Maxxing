// Small chunky line icons, drawn inline so no icon font or image is needed.
const PATHS = {
  // A curved arrow turning to the left (counterclockwise).
  'rotate-left': 'M9 4 4 9l5 5M4 9h9a6 6 0 1 1 0 12h-2',
  // A curved arrow turning to the right (clockwise).
  'rotate-right': 'M15 4l5 5-5 5M20 9h-9a6 6 0 1 0 0 12h2',
  undo: 'M9 5 4 10l5 5M4 10h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 5l5 5-5 5M20 10H9a5 5 0 0 0 0 10h3',
  // Camera views
  'view-room': 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  'view-front': 'M5 6h14v12H5z',
  'view-top': 'M4 4h16v16H4zM8.5 8.5h7v7h-7z',
  'view-side': 'M5 18V6h5l9 12z',
  'view-seated': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  bucket: 'M5 12 12 5l7 7-7 7zM21 16s-2 2.2-2 3.5a2 2 0 0 0 4 0C23 18.2 21 16 21 16z',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-down': 'M5 9l7 7 7-7',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4',
}

export default function Icon({ name, size = 16, strokeWidth = 3 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
