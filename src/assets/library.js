// The item library, as the rest of the app sees it.
//
// Item definitions live in src/assets/registry.js (format: see AGENTS.md).
// This file reads them and fills in sensible defaults, so the planner can rely
// on every asset having:
//   id, name, category, placement ('desk' | 'floor'),
//   size: { width, depth, height } (cm), colorOptions: [{ name, value }],
//   flat (true for thin things like mats and rugs, which other items can sit on)
// and optionally Model: a React component that draws the item.
//
// Until registry.js exists, a few placeholder blocks are used instead.
import { PLACEHOLDER_ITEMS } from './placeholderItems.js'

// import.meta.glob gives {} (instead of a build error) if registry.js doesn't exist yet.
const registryModules = import.meta.glob('./registry.js', { eager: true })

function readRegistry() {
  const module = Object.values(registryModules)[0]
  if (!module) return null
  const list = module.ASSETS || module.assets || module.REGISTRY || module.registry || module.default
  if (!list) return null
  return Array.isArray(list) ? list : Object.values(list)
}

// Accept size as { width, depth, height } or [width, depth, height].
function readSize(size) {
  if (Array.isArray(size)) return { width: size[0], depth: size[1], height: size[2] }
  return { width: size?.width ?? 10, depth: size?.depth ?? 10, height: size?.height ?? 10 }
}

// Accept colors as '#hex' strings or { name, value | hex } objects.
function readColors(colorOptions) {
  const list = Array.isArray(colorOptions) && colorOptions.length > 0 ? colorOptions : ['#9aa4bf']
  return list.map((color, i) =>
    typeof color === 'string'
      ? { name: `Color ${i + 1}`, value: color }
      : { name: color.name || `Color ${i + 1}`, value: color.value || color.hex || color.color },
  )
}

function normalizeAsset(asset) {
  const size = readSize(asset.size)
  return {
    ...asset,
    category: asset.category || 'Other',
    placement: asset.placement === 'floor' ? 'floor' : 'desk',
    size,
    colorOptions: readColors(asset.colorOptions),
    // Thin things (mats, rugs) don't block other items from sitting on them.
    flat: asset.flat ?? size.height <= 1.5,
  }
}

const registry = readRegistry()

export const USING_PLACEHOLDERS = !registry
export const ASSETS = (registry || PLACEHOLDER_ITEMS).map(normalizeAsset)

const byId = new Map(ASSETS.map((asset) => [asset.id, asset]))

// Shown if a saved setup mentions an item that's no longer in the library.
const MISSING_ASSET = normalizeAsset({
  id: 'missing',
  name: 'Missing item',
  category: 'Other',
  placement: 'desk',
  size: { width: 10, depth: 10, height: 10 },
  colorOptions: ['#c4c9d6'],
})

export function getAsset(id) {
  return byId.get(id) || MISSING_ASSET
}

// Categories in the order they first appear in the library.
export const CATEGORIES = [...new Set(ASSETS.map((asset) => asset.category))]
