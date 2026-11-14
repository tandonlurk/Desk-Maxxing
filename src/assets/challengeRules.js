// What a challenge creator locks down for the people designing on their room.
// The room and desk (and wall/floor paint) are always fixed; these are the
// extra limits the creator can choose.
//   allow: 'all' | 'categories' | 'items'   which library items challengers may use
//   categories / items: what 'allow' refers to
//   maxItems: most items a challenger may add (null = no limit)
export const DEFAULT_RULES = { allow: 'all', categories: [], items: [], maxItems: null }

export function readRules(raw) {
  const rules = raw && typeof raw === 'object' ? raw : {}
  const strings = (list) => (Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, 200) : [])
  const max = Math.round(Number(rules.maxItems))
  return {
    allow: ['categories', 'items'].includes(rules.allow) ? rules.allow : 'all',
    categories: strings(rules.categories),
    items: strings(rules.items),
    maxItems: Number.isFinite(max) && max >= 1 ? Math.min(max, 99) : null,
  }
}

// Wishlist items are always allowed, whatever the other limits say.
export function isAssetAllowed(asset, rules, wishlist = []) {
  if (rules.allow === 'all') return true
  if (wishlist.some((wish) => wish.assetId === asset.id)) return true
  if (rules.allow === 'categories') return rules.categories.includes(asset.category)
  return rules.items.includes(asset.id)
}

export function hasLimits(rules) {
  return rules.allow !== 'all' || rules.maxItems !== null
}
