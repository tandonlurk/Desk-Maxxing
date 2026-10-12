// Tags people can put on a published setup, and filter the board by.
// Ids are what's stored: lowercase slugs, at most 5 per setup (the database
// enforces both).
export const MAX_TAGS = 5

export const TAGS = [
  { id: 'cozy', name: 'Cozy' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'gaming', name: 'Gaming' },
  { id: 'productivity', name: 'Productivity' },
  { id: 'creative', name: 'Creative' },
  { id: 'streaming', name: 'Streaming' },
  { id: 'wfh', name: 'Work from home' },
  { id: 'student', name: 'Student' },
  { id: 'standing', name: 'Standing desk' },
  { id: 'small-space', name: 'Small space' },
  { id: 'dual-monitor', name: 'Dual monitor' },
  { id: 'laptop-only', name: 'Laptop only' },
  { id: 'plants', name: 'Plants' },
  { id: 'colorful', name: 'Colorful' },
  { id: 'pastel', name: 'Pastel' },
  { id: 'dark', name: 'Dark mode' },
  { id: 'wood', name: 'Warm wood' },
  { id: 'budget', name: 'Budget' },
]

const names = new Map(TAGS.map((tag) => [tag.id, tag.name]))

export function tagName(id) {
  return names.get(id) || id
}
